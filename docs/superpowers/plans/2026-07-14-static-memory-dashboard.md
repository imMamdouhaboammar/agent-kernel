# Static Memory Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `agent-kernel dashboard`, a self-contained read-only HTML snapshot that opens locally and exposes copy-only review commands for pending records.

**Architecture:** Extend `bin/agent-kernel-portability.mjs` and the existing public router. Build diagnostic-safe local readers, normalize an adaptive snapshot, render one inline HTML file, write it atomically, and optionally invoke a platform browser opener.

**Tech Stack:** Node.js ESM, Node standard library, static HTML/CSS/JavaScript, existing smoke test harness, GitHub Actions Node 18/20/22 matrix.

## Global Constraints

- Node.js `>=18.18.0`.
- No runtime dependency, frontend build, server, daemon dependency, remote API, or external asset.
- Browser behavior is read-only and limited to filtering, navigation, and copying text.
- Reuse the portability helper and current redaction/audit boundaries.
- Do not edit `dist/cli.mjs` manually.
- Reject symbolic and non-regular output targets.
- Preserve `report <file.html>` behavior.
- No release, version bump, tag, publish, default-branch write, or merge.

---

### Task 1: Define the public dashboard contract

**Files:**
- Create: `test/public-cli-dashboard.mjs`
- Modify: `test/smoke.mjs`

**Produces:** A focused failing test for the missing `dashboard` route and behavior.

- [ ] Seed an isolated Agent Kernel home with pending, approved, rejected, memory, policy, episode, failure, session, registry, commit, updater, audit, and Architecture Guardian fixtures.
- [ ] Assert `dashboard` creates the default file, opens an injected browser in human mode, emits safe copy commands, redacts secrets, hides absolute paths, and contains no external assets.
- [ ] Assert `--no-open`, `--out`, `--json`, `--json --open`, and conflicting flags.
- [ ] Wire the module through `test/smoke.mjs`.
- [ ] Run CI and accept RED only when smoke fails because the command is absent.
- [ ] Commit with `test(dashboard): define static snapshot contract`.

### Task 2: Collect a sanitized adaptive snapshot

**Files:**
- Modify: `bin/agent-kernel-portability.mjs`
- Test: `test/public-cli-dashboard.mjs`

**Produces:** `dashboardSnapshot(projectPath)` and diagnostic-safe readers.

- [ ] Extend local paths with approved, rejected, reports, and update cache locations.
- [ ] Add readers that distinguish missing files from malformed JSON and report generic skipped counts.
- [ ] Normalize proposal lifecycle records and flatten durable memory buckets.
- [ ] Derive rule and skill-trigger projections.
- [ ] Normalize policies, episodes, failures, sessions, agents, projects, commits, updater, retention, and bounded audit rows.
- [ ] Read compact Architecture Guardian summaries for the selected project.
- [ ] Sanitize all values before returning the snapshot.
- [ ] Commit with `feat(dashboard): collect adaptive local state`.

### Task 3: Render the branded static HTML safely

**Files:**
- Modify: `bin/agent-kernel-portability.mjs`
- Test: `test/public-cli-dashboard.mjs`

**Produces:** `renderDashboard(snapshot)`, safe action controls, and output preflight.

- [ ] Render the locked Agent Kernel visual system with inline CSS only.
- [ ] Render only non-empty data sections plus shell, summary, search, and diagnostics.
- [ ] Escape dynamic text and attributes.
- [ ] Add copy-only controls for ID, `inbox`, `approve --publish`, and `reject` when IDs are safe.
- [ ] Add one inline script limited to filtering, navigation, clipboard use, and fallback copy.
- [ ] Reject external URLs and network primitives by test.
- [ ] Preflight target and existing parent components, then atomically replace the regular file.
- [ ] Commit with `feat(dashboard): render branded read-only HTML`.

### Task 4: Route the command and open the browser

**Files:**
- Modify: `bin/agent-kernel-portability.mjs`
- Modify: `bin/agent-kernel-router.mjs`
- Test: `test/public-cli-dashboard.mjs`

**Produces:** `commandDashboard(flags)` and public `agent-kernel dashboard` routing.

- [ ] Add strict dashboard flag validation.
- [ ] Resolve default and custom output paths.
- [ ] Select `open`, `xdg-open`, or Windows `rundll32.exe` with argument arrays and no shell.
- [ ] Support injected browser executable and JSON prefix arguments for tests.
- [ ] Keep generated output valid when the browser cannot open.
- [ ] Append one redacted `dashboard.generate` audit record after successful generation.
- [ ] Add `dashboard` to portability routing and usage output.
- [ ] Run CI to GREEN and commit with `feat(cli): route and open static dashboard`.

### Task 5: Harden failure and privacy paths

**Files:**
- Modify: `test/public-cli-dashboard.mjs`
- Modify: `bin/agent-kernel-portability.mjs` only when tests expose a defect.

- [ ] Cover malformed optional JSON, unsafe IDs, HTML injection, secret-shaped values, browser failure, empty adaptive stores, and project isolation.
- [ ] Cover symlink target, directory target, symbolic parent, invalid browser-prefix JSON, unknown flags, and missing project paths.
- [ ] Assert source files are byte-identical after generation.
- [ ] Assert audit rows remain redacted and one event is written per successful generation.
- [ ] Commit with `test(dashboard): harden privacy and failure paths`.

### Task 6: Document the public feature

**Files:**
- Modify: `README.md`
- Modify: `docs/RETENTION_AND_PORTABILITY.md`
- Modify: `docs/ARCHITECTURE_NOW.md`
- Modify: `docs/README.md`
- Modify: `docs/public-cli/ROUTED_COMMANDS.md`

- [ ] Document default generation and browser opening.
- [ ] Document flags, adaptive sections, redaction, copy-only review commands, target safety, and browser failure behavior.
- [ ] Record dashboard routing and state flow in current architecture.
- [ ] State explicitly that the HTML cannot approve or mutate state.
- [ ] Run docs checks and commit with `docs(dashboard): document static memory inspection`.

### Task 7: Verify and hand off the PR

- [ ] Compare against current `master`; resolve remote drift without force-push.
- [ ] Review the full diff for scope, secrets, generated artifacts, package metadata, and compatibility.
- [ ] Require successful CI jobs: build/lint/smoke on Node 18, 20, 22; typecheck; manifest/package dry-run; dependency audit; docs sanity.
- [ ] Record unavailable local interactive and native-platform checks honestly.
- [ ] Request independent review and resolve valid findings.
- [ ] Finalize a PR body using `templates/PR_TEMPLATE.md`.
- [ ] Leave the PR open and unmerged.
