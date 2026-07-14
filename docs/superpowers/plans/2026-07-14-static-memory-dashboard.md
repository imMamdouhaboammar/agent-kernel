# Static Memory Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `agent-kernel dashboard`, a self-contained read-only HTML snapshot that opens locally and exposes copy-only review commands for pending Agent Kernel records.

**Architecture:** Extend the existing routed portability helper so dashboard generation reuses its local store paths, redaction, atomic writes, audit trail, and smoke-test vertical slice. Build a normalized adaptive snapshot in memory, render one inline-CSS HTML file with a minimal filtering/clipboard script, and invoke a platform-specific browser opener only after the file is safely written.

**Tech Stack:** Node.js ESM, Node standard library only, static HTML/CSS/JavaScript, existing public router, existing smoke test harness, GitHub Actions Node 18/20/22 matrix.

## Global Constraints

- Keep Node.js support at `>=18.18.0`.
- Add no runtime dependency, frontend build pipeline, daemon requirement, local server, remote API, or external asset.
- Keep the dashboard read-only; browser code may filter records and copy text only.
- Keep approval, rejection, publication, deletion, pruning, imports, updater application, policy changes, and trust changes outside the browser.
- Reuse `bin/agent-kernel-portability.mjs`; do not add production code to unwired `src/*` placeholder directories.
- Do not hand-edit `dist/cli.mjs`.
- Redact secrets and sensitive keys before normalization and HTML rendering.
- Reject symbolic or non-regular output targets before writing.
- Use atomic file replacement.
- Preserve `agent-kernel report <file.html>` compatibility.
- Use the Agent Kernel palette: `#050505`, `#0B0B0B`, `#2A2A2A`, `#F4F4F1`, `#8E8E88`, `#F8F46A`.
- No gradients, external fonts, images, analytics, telemetry, network calls, or remote URLs.
- No version bump, release, publish, tag, merge, or default-branch write.

---

### Task 1: Lock the dashboard CLI contract with failing smoke coverage

**Files:**
- Modify: `test/public-cli-portability.mjs`

**Interfaces:**
- Consumes: existing `runPublic(env, ...args)`, `runPublicFailure(env, ...args)`, `writeJson(filePath, value)`, and isolated `makeEnv()` fixtures.
- Produces: a failing behavioral contract for `agent-kernel dashboard` that later tasks must satisfy.

- [ ] **Step 1: Add a fake browser fixture**

Add a helper that writes a small executable Node script under the isolated home and records received arguments:

```js
function createFakeBrowser(homeDir) {
  const browserPath = path.join(homeDir, process.platform === 'win32' ? 'fake-browser.cmd' : 'fake-browser.mjs');
  const logPath = path.join(homeDir, 'browser-open.json');
  const script = `#!/usr/bin/env node\nimport fs from 'node:fs';\nfs.writeFileSync(process.env.AGENT_KERNEL_BROWSER_LOG, JSON.stringify(process.argv.slice(2)));\n`;
  fs.writeFileSync(browserPath, script, { mode: 0o755 });
  return { browserPath, logPath };
}
```

Use an `.mjs` executable on the CI platforms. Keep Windows command selection covered through implementation inspection or a dedicated injected executable rather than relying on a Unix shebang there.

- [ ] **Step 2: Seed every adaptive store**

After the current portability fixtures, add:

- one pending proposal with safe ID `proposal_dashboard_pending`
- one approved proposal
- one rejected proposal
- one approved `rule` memory
- one approved `skill-trigger` memory
- one policy record
- one episode record
- one agent and one project registry record
- one updater config/cache record
- one audit JSONL record
- one project-local Architecture Guardian policy/map/contract/exceptions/report fixture
- one malformed optional JSON file

Use a fake secret assembled from string fragments so repository secret scanning does not match a literal token-shaped fixture.

- [ ] **Step 3: Add the default dashboard assertion**

Run:

```js
const browser = createFakeBrowser(source.homeDir);
const dashboardEnv = {
  ...source.env,
  AGENT_KERNEL_BROWSER_BIN: process.execPath,
  AGENT_KERNEL_BROWSER_ARGS_JSON: JSON.stringify([browser.browserPath]),
  AGENT_KERNEL_BROWSER_LOG: browser.logPath
};
const dashboardOutput = runPublic(dashboardEnv, 'dashboard', '--project', repo.root);
```

Assert:

- human output names the generated dashboard path
- `~/.agent-kernel/reports/dashboard.html` exists
- the browser fixture received one absolute HTML path
- the HTML contains the Agent Kernel dashboard title and required seeded section labels
- the HTML contains `agent-kernel approve proposal_dashboard_pending --publish`
- the HTML contains `agent-kernel reject proposal_dashboard_pending`
- the HTML contains `agent-kernel inbox`
- the HTML contains no assembled fake secret
- the HTML does not expose the absolute Agent Kernel home or full project path

- [ ] **Step 4: Add flag behavior assertions**

Cover:

```js
runPublic(source.env, 'dashboard', '--no-open', '--out', customPath, '--json');
runPublic(dashboardEnv, 'dashboard', '--json', '--open');
runPublicFailure(source.env, 'dashboard', '--open', '--no-open');
```

Assert JSON mode suppresses opening unless `--open` is present, `--out` is respected, and conflicting flags fail non-zero.

- [ ] **Step 5: Add output safety assertions**

Create a symlink output path and a directory output path. Assert both fail before replacement and their targets remain unchanged.

- [ ] **Step 6: Add immutability assertions**

Hash or read the pending, approved, rejected, and memory fixture files before dashboard generation. Assert their bytes are identical after generation. Assert only one new `dashboard.generate` audit event is appended.

- [ ] **Step 7: Commit the RED contract**

```bash
git add test/public-cli-portability.mjs
git commit -m "test(dashboard): define static snapshot contract"
```

Expected CI state: build, lint, typecheck, manifest, dependency, and docs jobs should remain valid; smoke should fail because `dashboard` is not routed or implemented.

---

### Task 2: Add safe dashboard store readers and normalized section data

**Files:**
- Modify: `bin/agent-kernel-portability.mjs`
- Modify: `test/public-cli-portability.mjs`

**Interfaces:**
- Consumes: `paths()`, `sanitize()`, `redactText()`, `retentionPlan()`, `memoryBuckets()`, `episodes()`, `sessionRecords()`, `readObservations()`, `SAFE_FILE_ID`, and current local JSON stores.
- Produces:
  - `readJsonDiagnostic(filePath, fallback, diagnostics, label)`
  - `readJsonDirectory(dir, diagnostics, label)`
  - `proposalLifecycle(diagnostics)`
  - `architectureSnapshot(projectPath, diagnostics)`
  - `dashboardSnapshot(projectPath)`

- [ ] **Step 1: Add diagnostic-safe readers**

Implement readers that distinguish a missing file from malformed JSON:

```js
function readJsonDiagnostic(filePath, fallback, diagnostics, label) {
  if (!exists(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    diagnostics.skippedMalformed++;
    diagnostics.messages.push(`Skipped malformed ${label}`);
    return fallback;
  }
}
```

Do not persist diagnostics. Keep messages generic and path-free.

- [ ] **Step 2: Add inbox lifecycle paths**

Extend `paths()` with:

```js
approved: path.join(home, 'inbox', 'approved'),
rejected: path.join(home, 'inbox', 'rejected'),
updateCache: path.join(home, 'runtime', 'update-status.json'),
updateAudit: path.join(home, 'logs', 'updates.jsonl'),
reports: path.join(home, 'reports')
```

- [ ] **Step 3: Normalize lifecycle and memory records**

Build arrays with stable fields:

```js
{
  id,
  status,
  type,
  scope,
  level,
  text,
  reason,
  targets,
  tags,
  agentId,
  createdAt,
  updatedAt,
  validActionId
}
```

Flatten memory buckets into records with a `bucket` field. Derive `rules` from `type === 'rule'` and `skillTriggers` from `type === 'skill-trigger'`.

- [ ] **Step 4: Normalize secondary stores**

Create compact records for policies, episodes, Failure Lessons, sessions, agents, projects, commits, updater status, retention summary, and audit summary. Do not include raw observation text, audit metadata objects, update logs, environment data, or absolute paths.

- [ ] **Step 5: Normalize project-local architecture state**

Resolve the selected project, require an existing directory, and read only `.agent-kernel/architecture`. Return compact counts and reviewed metadata; never embed source code or raw dependency edges.

- [ ] **Step 6: Assemble the adaptive snapshot**

Return:

```js
{
  generatedAt: nowIso(),
  kernelVersion: VERSION,
  homeLabel: process.env.AGENT_KERNEL_HOME ? 'AGENT_KERNEL_HOME' : '~/.agent-kernel',
  project: { id, name },
  metrics,
  diagnostics,
  sections: [
    { id: 'pending', title: 'Pending review', records: pending },
    // only non-empty data sections
  ]
}
```

Retain updater and retention sections when they carry meaningful status even if their record count is one summary card.

- [ ] **Step 7: Run focused smoke and commit**

Run through CI after pushing. Expected failure may move from missing command to missing renderer or opener, while data-model assertions should begin passing.

```bash
git add bin/agent-kernel-portability.mjs test/public-cli-portability.mjs
git commit -m "feat(dashboard): collect adaptive local state"
```

---

### Task 3: Render the branded self-contained dashboard safely

**Files:**
- Modify: `bin/agent-kernel-portability.mjs`
- Modify: `test/public-cli-portability.mjs`

**Interfaces:**
- Consumes: `dashboardSnapshot(projectPath)` and `escapeHtml(value)`.
- Produces:
  - `renderDashboard(snapshot)` returning one HTML string
  - `assertSafeOutputTarget(filePath)`
  - `resolveDashboardTarget(flags)`

- [ ] **Step 1: Add HTML rendering primitives**

Add helpers for escaped attributes, pills, metadata rows, record cards, summary metrics, section navigation, and empty diagnostics. Every dynamic value must pass through `escapeHtml`.

- [ ] **Step 2: Render pending action controls**

For safe IDs, render copy buttons for:

```text
agent-kernel inbox
agent-kernel approve <id> --publish
agent-kernel reject <id>
```

Also render a copy-ID button. Unsafe IDs receive an `Invalid action ID` label and no action command attributes.

- [ ] **Step 3: Add minimal inline interaction**

The only script may:

- filter cards by text from an input
- scroll to selected sections
- call `navigator.clipboard.writeText()` for `data-copy` values
- fall back to a temporary textarea for clipboard compatibility
- set bounded button feedback text

It must not use `fetch`, `XMLHttpRequest`, `WebSocket`, EventSource, forms, custom URL schemes, localhost, dynamic imports, or external script sources.

- [ ] **Step 4: Apply the visual system**

Use the locked palette and a system monospace stack. Build a responsive sticky header, summary strip, wide-screen side navigation, compact cards, details elements, status pills, and high-contrast action buttons. Avoid gradients and decorative effects.

- [ ] **Step 5: Add output-target preflight**

Before writing:

- resolve the absolute path
- reject an existing symlink
- reject an existing non-regular file
- reject symbolic existing parent components
- create missing directories only after preflight
- atomically replace the regular target

- [ ] **Step 6: Strengthen self-contained assertions**

Assert no `src=`, `href=http`, `@import`, remote URL, external stylesheet, font URL, analytics marker, or unescaped seeded HTML appears. Permit the one inline script and assert it contains clipboard/filter functions but no network primitives.

- [ ] **Step 7: Commit the renderer**

```bash
git add bin/agent-kernel-portability.mjs test/public-cli-portability.mjs
git commit -m "feat(dashboard): render branded read-only HTML"
```

---

### Task 4: Add browser opening and public command routing

**Files:**
- Modify: `bin/agent-kernel-portability.mjs`
- Modify: `bin/agent-kernel-router.mjs`
- Modify: `test/public-cli-portability.mjs`

**Interfaces:**
- Consumes: rendered HTML, output path, parsed dashboard flags.
- Produces:
  - `browserInvocation(filePath)` returning `{ command, args, label }`
  - `openDashboard(filePath)` returning `{ opened, browser, error }`
  - `commandDashboard(flags)`
  - public router support for `dashboard`

- [ ] **Step 1: Add platform browser selection**

Implement:

```js
function browserInvocation(filePath) {
  if (process.env.AGENT_KERNEL_BROWSER_BIN) {
    const prefix = parseBrowserPrefix(process.env.AGENT_KERNEL_BROWSER_ARGS_JSON);
    return { command: process.env.AGENT_KERNEL_BROWSER_BIN, args: [...prefix, filePath], label: 'configured' };
  }
  if (process.platform === 'darwin') return { command: 'open', args: [filePath], label: 'open' };
  if (process.platform === 'win32') return { command: 'rundll32.exe', args: ['url.dll,FileProtocolHandler', pathToFileURL(filePath).href], label: 'rundll32' };
  return { command: 'xdg-open', args: [filePath], label: 'xdg-open' };
}
```

Import `pathToFileURL` from `node:url`. Parse the test prefix as a JSON array of bounded strings.

- [ ] **Step 2: Execute without a shell**

Use `spawnSync(command, args, { shell: false, stdio: 'ignore', timeout: 5000, env: process.env })`. Convert failures to bounded categories such as `browser-not-found`, `browser-timeout`, or `browser-exit` without exposing raw stderr.

- [ ] **Step 3: Implement command semantics**

`commandDashboard(flags)` must:

1. reject `--open` plus `--no-open`
2. validate allowed flags and positional arguments
3. resolve project and output paths
4. build and sanitize the snapshot
5. render and atomically write HTML
6. decide whether to open based on human/JSON mode
7. append one redacted `dashboard.generate` audit record
8. print human output or a JSON envelope

- [ ] **Step 4: Route the public command**

Change:

```js
const portabilityCommand = ['retention', 'export', 'import', 'view', 'report', 'dashboard'].includes(command) ||
```

The portability helper receives `dashboard` unchanged, matching existing family routing.

- [ ] **Step 5: Update helper usage**

Add:

```text
agent-kernel dashboard [--out file.html] [--project path] [--no-open|--open] [--json]
```

- [ ] **Step 6: Verify GREEN and commit**

CI smoke should now pass the dashboard contract on Node 18, 20, and 22.

```bash
git add bin/agent-kernel-portability.mjs bin/agent-kernel-router.mjs test/public-cli-portability.mjs
git commit -m "feat(cli): route and open static dashboard"
```

---

### Task 5: Harden malformed stores, browser failures, and adaptive behavior

**Files:**
- Modify: `bin/agent-kernel-portability.mjs`
- Modify: `test/public-cli-portability.mjs`

**Interfaces:**
- Consumes: complete dashboard command.
- Produces: regression evidence for failure containment, data privacy, and section omission.

- [ ] **Step 1: Test malformed optional records**

Assert a malformed JSON file increments the skipped count, produces a generic diagnostics notice, and does not expose the path or prevent generation.

- [ ] **Step 2: Test browser failure containment**

Inject a missing browser binary. Assert the HTML remains valid, human output reports that it was generated but not opened, and JSON mode reports `opened: false` plus a bounded category.

- [ ] **Step 3: Test adaptive omission**

Generate a dashboard from a second minimal initialized home. Assert sections without records are absent while the shell, summary, retention, and diagnostic surfaces remain coherent.

- [ ] **Step 4: Test project architecture isolation**

Point `--project` to a fixture with architecture state and assert its summary appears without absolute paths or raw dependency arrays. Point to another directory and assert the first project metadata is absent.

- [ ] **Step 5: Test invalid flags and paths**

Reject unknown options, multiple positional output arguments, missing `--out` values, missing project directories, unsafe output types, and invalid browser-prefix JSON before side effects.

- [ ] **Step 6: Commit hardening**

```bash
git add bin/agent-kernel-portability.mjs test/public-cli-portability.mjs
git commit -m "test(dashboard): harden privacy and failure paths"
```

---

### Task 6: Document the static dashboard and architecture boundary

**Files:**
- Modify: `README.md`
- Modify: `docs/RETENTION_AND_PORTABILITY.md`
- Modify: `docs/ARCHITECTURE_NOW.md`
- Modify: `docs/README.md`
- Modify: `docs/public-cli/ROUTED_COMMANDS.md`

**Interfaces:**
- Consumes: final command behavior and tests.
- Produces: accurate public discovery, operational guidance, and architecture documentation.

- [ ] **Step 1: Update README discovery**

Add a compact `Local memory dashboard` section showing:

```bash
agent-kernel dashboard
agent-kernel dashboard --no-open
agent-kernel dashboard --out ./agent-kernel-dashboard.html
```

State that it is static, local-only, adaptive, read-only, and copy-assisted.

- [ ] **Step 2: Expand retention/reporting guide**

Document default output, opening semantics, flags, section coverage, copy commands, redaction, malformed-record behavior, symlink rejection, and browser failure behavior.

- [ ] **Step 3: Update architecture truth**

Add `dashboard` to the portability command family and describe the flow from local stores to sanitized snapshot, HTML, optional browser opener, and one bounded audit event.

- [ ] **Step 4: Update docs index and routed commands**

Add dashboard discovery and the public routed command. Explicitly state that browser actions do not mutate Agent Kernel state.

- [ ] **Step 5: Run documentation checks and commit**

```bash
npm run docs:check

git add README.md docs/RETENTION_AND_PORTABILITY.md docs/ARCHITECTURE_NOW.md docs/README.md docs/public-cli/ROUTED_COMMANDS.md
git commit -m "docs(dashboard): document static memory inspection"
```

Use GitHub Actions when a complete local checkout is unavailable.

---

### Task 7: Final verification, review, and PR handoff

**Files:**
- Review: all changed files
- Update: PR body only after final evidence is available

**Interfaces:**
- Consumes: completed feature branch.
- Produces: one open, review-ready PR targeting `master`.

- [ ] **Step 1: Review complete diff and drift**

Confirm:

- branch is based on `65caa50282d8a0eddb151edc8de11aa5fefb93d0` or safely refreshed from a newer reviewed `master`
- no `dist/cli.mjs`, version, lockfile, manifest, release, tag, or dependency change exists
- only the intended helper, router, focused test, spec/plan, and docs changed
- no secret-shaped fixture literal is committed

- [ ] **Step 2: Run repository checks**

```bash
npm run build
npm test
npm run lint
npm run typecheck
npm run size
npm run publish:dry
```

If local execution remains unavailable, rely on GitHub Actions for build, lint, smoke, typecheck, manifest/package dry-run, dependency audit, and docs sanity, and mark `size` or `publish:dry` unavailable unless CI runs them.

- [ ] **Step 3: Inspect exact CI jobs**

Require success for:

- Build + smoke Node 18.x
- Build + smoke Node 20.x
- Build + smoke Node 22.x
- TypeScript typecheck
- Manifest discipline and package dry-run
- Dependency audit
- Docs sanity

- [ ] **Step 4: Request independent review**

Resolve valid review findings. Do not dismiss or conceal unresolved Critical or Important issues.

- [ ] **Step 5: Open or finalize the PR**

Use `templates/PR_TEMPLATE.md`. Include exact branch, starting SHA, changed files, architecture impact, state impact, test evidence, unavailable checks, browser/platform risks, and independent verification steps.

- [ ] **Step 6: Leave the PR unmerged**

Do not merge, enable auto-merge, tag, publish, or change the default branch.
