# Static Memory Dashboard Design

## Status

Approved for implementation on 2026-07-14.

## Objective

Add an optional, local-first, read-only HTML dashboard that gives a user one visual snapshot of the Agent Kernel state already stored on their machine. Any connected coding agent can invoke the public CLI command, which generates one self-contained HTML file and opens it in the default browser.

The dashboard is an inspection surface only. It never approves, rejects, publishes, edits, deletes, prunes, imports, installs, or mutates Agent Kernel state. Pending records expose copyable CLI commands so the user can paste an explicit reviewed action back into their agent or terminal.

## User flow

Primary command:

```bash
agent-kernel dashboard
```

Default behavior:

1. read known Agent Kernel stores from `AGENT_KERNEL_HOME` or `~/.agent-kernel`
2. sanitize and normalize the snapshot in memory
3. generate `~/.agent-kernel/reports/dashboard.html` atomically
4. open the file in the operating system default browser
5. print the generated path and open status

Options:

```bash
agent-kernel dashboard --no-open
agent-kernel dashboard --out ./agent-kernel-dashboard.html
agent-kernel dashboard --json
agent-kernel dashboard --json --open
agent-kernel dashboard --project /path/to/repository
```

Rules:

- Human mode opens the browser by default.
- `--no-open` generates only.
- `--json` generates only unless `--open` is also present.
- `--open` and `--no-open` cannot be combined.
- `--out` resolves to an explicit local HTML path.
- The default output is a stable file that is atomically replaced on each run, preventing unbounded snapshot accumulation.
- `--project` selects the project whose local Architecture Guardian state may be included. The default is the current working directory.

## Architecture decision

Extend the existing focused portability and local-reporting helper instead of creating a second dashboard subsystem:

```text
agent-kernel dashboard
  -> bin/agent-kernel-router.mjs
  -> bin/agent-kernel-portability.mjs
  -> local state readers
  -> sanitized adaptive snapshot
  -> self-contained HTML
  -> optional OS browser opener
```

This reuses the existing paths, redaction, atomic-write, audit, local report, and smoke-test boundaries. It avoids adding production code to unwired placeholder directories and adds no runtime dependency, daemon, local server, remote API, or persistent schema.

## Public command contract

`dashboard` becomes a routed portability command. The existing `report <file.html>` command remains supported and keeps its current compatibility behavior.

The dashboard result in JSON mode is:

```json
{
  "ok": true,
  "path": "/absolute/path/dashboard.html",
  "generatedAt": "2026-07-14T00:00:00.000Z",
  "opened": false,
  "browser": null,
  "externalAssets": false,
  "scripts": "inline-copy-only",
  "sections": ["pending", "memories", "episodes"]
}
```

Browser-open failure does not delete or invalidate the generated snapshot. Human mode reports the path and the failure. JSON mode returns `ok: true`, `opened: false`, and a bounded error category while keeping secrets and raw process output out of the result.

## Snapshot model

The dashboard reads every known store conservatively and includes only stores that contain useful data.

### Global stores

- memory buckets under `source/memories/*.json`
- policies under `source/policies/policies.json`
- Failure Lessons under `source/failures/failure-lessons.json`
- agent registry under `source/agents/agents.json`
- project registry under `source/projects/projects.json`
- proposal lifecycle under `inbox/pending`, `inbox/approved`, and `inbox/rejected`
- episode archive and index
- runtime session metadata
- commit-link index
- updater configuration summary and update cache
- retention summary
- redacted audit activity summary

### Current project store

When the selected project contains `.agent-kernel/architecture`, include safe summaries of:

- policy mode and configured roots or layers
- architecture map counts
- active change contract metadata
- active non-expired exception count
- latest conformance report summary

The dashboard does not embed full repository source, raw observation JSONL, raw environment variables, npm output, hook payloads, credentials, or daemon process internals.

## Adaptive sections

The page always renders the shell, header, generated-at timestamp, kernel version, local-home label, search control, and summary metrics.

Data sections render only when their normalized record count is greater than zero:

1. Pending review
2. Approved proposals
3. Rejected proposals
4. Durable memories
5. Rules
6. Skill triggers
7. Policies
8. Episodes
9. Failure Lessons
10. Sessions
11. Agents
12. Projects
13. Commit links
14. Architecture Guardian
15. Update status
16. Retention
17. Audit summary

Derived sections such as Rules and Skill triggers are projections of durable memory records, not additional stores.

## Read-only review assistance

Each pending proposal card displays:

- proposal ID
- type, scope, level, status, targets, tags, source agent, and timestamps when present
- sanitized text and reason
- a copy button for the safe review command
- a copy button for the explicit approval-and-publish command
- a copy button for the rejection command

Commands:

```bash
agent-kernel memory show <proposal-id>
agent-kernel approve <proposal-id> --publish
agent-kernel reject <proposal-id>
```

The exact ID is shell-quoted using a conservative platform-neutral single-argument representation. IDs that do not match Agent Kernel safe identifier rules do not receive action commands and are marked invalid.

Buttons use browser clipboard APIs only. They do not call localhost, spawn processes, submit forms, navigate to custom protocols, or mutate files. The page contains no general JavaScript data fetches. The only inline script handles local filtering and copy-to-clipboard feedback using already rendered text.

## Privacy and safety

- Reuse the current secret-pattern and sensitive-key redaction rules.
- Sanitize every record before normalization and rendering.
- HTML-escape all dynamic text, attributes, and embedded JSON.
- Do not render absolute `AGENT_KERNEL_HOME` by default; show `~/.agent-kernel` or an environment-neutral label. The absolute output path remains in CLI output only.
- Project paths are reduced to project name or registered project ID in the HTML.
- Do not include raw audit metadata values. Render operation, timestamp, actor category, target type, and compact redacted summary only.
- Do not include raw update audit logs. Show configured mode, channel, installed version, target version, availability, and last check category.
- Do not create or follow symbolic output targets. Existing symbolic or non-regular output paths fail closed.
- Write the HTML atomically in the selected output directory.
- No external fonts, images, stylesheets, scripts, analytics, network calls, or remote URLs.

## Browser opening

Use a focused standard-library opener selected by platform:

- macOS: `open <file>`
- Linux and other Unix: `xdg-open <file>`
- Windows: `rundll32.exe url.dll,FileProtocolHandler <file-url>`

Execution uses argument arrays without shell interpolation, inherited environment, ignored stdio, bounded startup handling, and detached mode where appropriate.

Test seams:

- `AGENT_KERNEL_BROWSER_BIN` overrides the executable
- `AGENT_KERNEL_BROWSER_ARGS_JSON` supplies a JSON array of prefix arguments

Invalid test-seam JSON fails explicitly. Production never reads a shell command string.

## Visual system

The dashboard follows the Agent Kernel product identity:

- background `#050505`
- panels `#0B0B0B`
- borders `#2A2A2A`
- primary text `#F4F4F1`
- secondary text `#8E8E88`
- signal accent `#F8F46A`
- compact, restrained spacing
- system monospace stack with JetBrains Mono when locally available
- thin borders and limited radius
- no gradients, glass effects, 3D shadows, oversized icons, decorative AI imagery, or invented metrics

Layout:

- sticky compact header with search and generated timestamp
- summary metric strip
- left section navigation on wide screens
- one-column responsive layout on narrow screens
- record cards with expandable detail blocks
- status pills for pending, approved, rejected, active, archived, and trust levels
- high-contrast copy buttons with visible success and failure state

## Error behavior

- Missing optional stores are treated as empty.
- Malformed individual JSON files are counted and skipped; the dashboard still generates and visibly reports the skipped-record count.
- A malformed central config is not overwritten and does not block unrelated stores.
- Unsafe file IDs, symlinks, non-regular output targets, and invalid flag combinations fail before writing.
- Browser-open failure leaves the generated file intact.
- Dashboard generation never changes the primary store, inbox lifecycle, memory status, or audit records except for one bounded `dashboard.generate` audit event.

## Testing strategy

Extend `test/public-cli-portability.mjs` because the dashboard is an expansion of the existing local reporting vertical slice.

Regression coverage must prove:

- public router delegates `dashboard`
- default output path is under the isolated Agent Kernel home
- `--out` uses the requested path
- human mode invokes the injected browser executable
- `--no-open` and JSON mode do not open
- `--json --open` opens
- browser failure preserves a valid HTML file and returns bounded metadata
- output is self-contained with no external URLs or external assets
- inline script is limited to filtering and clipboard behavior
- pending, approved, rejected, durable memory, rules, skill triggers, policies, episodes, failures, sessions, agents, projects, commits, updater, retention, audit, and current-project architecture sections render adaptively
- empty sections are omitted
- pending copy commands contain the safe proposal ID and correct review, approve, publish, and reject commands
- invalid IDs do not receive commands
- stored HTML is escaped and secret values are absent
- malformed optional records are skipped and counted
- symlink and non-regular output targets fail before replacement
- generation does not change approved memory or proposal lifecycle files
- one redacted `dashboard.generate` audit record is appended
- Node 18, 20, and 22 CI smoke matrices remain green

## Documentation

Update:

- `README.md`
- `docs/RETENTION_AND_PORTABILITY.md`
- `docs/ARCHITECTURE_NOW.md`
- `docs/README.md`
- `docs/public-cli/ROUTED_COMMANDS.md`

Document that the feature is optional, local-only, read-only, static, and not a browser-based approval API.

## Scope exclusions

This PR does not add:

- a live server or daemon dependency
- auto-refresh or file watching
- browser-side approval, rejection, publish, delete, prune, import, update, policy, or trust actions
- remote sync, authentication, accounts, analytics, telemetry, or cloud storage
- external frontend dependencies or a build pipeline
- release, package-version bump, npm publish, tag, or merge
