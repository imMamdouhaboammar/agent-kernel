# Static Memory Dashboard Design

## Status

Approved for implementation on 2026-07-14.

## Objective

Add an optional, local-first, read-only HTML dashboard for inspecting the Agent Kernel state already stored on the user's machine. A connected coding agent can run one public CLI command, generate one self-contained HTML snapshot, and open it in the default browser.

The browser page is not an administration API. It never approves, rejects, publishes, edits, deletes, prunes, imports, installs, changes trust, or mutates Agent Kernel state. It provides copy-only commands that the user may paste back into a terminal or agent after review.

## Public command

```bash
agent-kernel dashboard
agent-kernel dashboard --no-open
agent-kernel dashboard --out ./agent-kernel-dashboard.html
agent-kernel dashboard --json
agent-kernel dashboard --json --open
agent-kernel dashboard --project /path/to/repository
```

Default human-mode flow:

1. Read known stores from `AGENT_KERNEL_HOME` or `~/.agent-kernel`.
2. Sanitize and normalize data in memory.
3. Atomically replace `~/.agent-kernel/reports/dashboard.html`.
4. Open the generated file in the default browser.
5. Print the path and open result.

Rules:

- Human mode opens by default.
- `--no-open` generates only.
- `--json` generates only unless `--open` is supplied.
- `--open` and `--no-open` are mutually exclusive.
- `--out` selects an explicit HTML target.
- `--project` selects the project whose local Architecture Guardian summary may be included; it defaults to the current directory.
- The default target is stable, so repeated generation does not accumulate snapshots.

## Architecture

Extend the existing routed portability and reporting surface:

```text
agent-kernel dashboard
  -> bin/agent-kernel-router.mjs
  -> bin/agent-kernel-portability.mjs
  -> diagnostic-safe local readers
  -> sanitized adaptive snapshot
  -> self-contained HTML
  -> optional platform browser opener
```

This reuses existing paths, redaction, atomic writes, audit records, and test boundaries. It adds no runtime dependency, frontend build system, daemon requirement, server, remote API, or persistent schema.

The existing `agent-kernel report <file.html>` command remains compatible.

## Result contract

JSON mode returns a stable envelope:

```json
{
  "ok": true,
  "path": "/absolute/path/dashboard.html",
  "generatedAt": "2026-07-14T00:00:00.000Z",
  "opened": false,
  "browser": null,
  "browserError": null,
  "externalAssets": false,
  "scripts": "inline-copy-filter-only",
  "sections": ["pending", "memories", "episodes"]
}
```

A browser-open failure does not invalidate or remove the generated snapshot. The result remains successful with `opened: false` and a bounded error category.

## Snapshot coverage

Read known stores conservatively and render only useful sections.

Global stores:

- `source/memories/*.json`
- `source/policies/policies.json`
- `source/failures/failure-lessons.json`
- `source/agents/agents.json`
- `source/projects/projects.json`
- `inbox/pending`, `inbox/approved`, and `inbox/rejected`
- episode archive and index
- runtime session metadata
- commit-link index
- updater configuration summary and update cache
- retention summary
- bounded redacted audit summary

Project-local Architecture Guardian summary, when present:

- policy mode, roots, and layer count
- map node and edge counts
- active change contract metadata
- active non-expired exception count
- latest report status and finding counts

Never embed repository source, raw observation JSONL, environment variables, npm output, hook payloads, credentials, full audit metadata, raw update logs, or daemon process internals.

## Adaptive sections

The shell always includes a title, generation timestamp, kernel version, neutral home label, search control, summary metrics, and diagnostics.

Render a section only when it has data:

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

Rules and skill triggers are projections of durable memories, not new stores.

## Pending review assistance

Each pending card may display ID, type, scope, level, status, targets, tags, source agent, timestamps, sanitized text, and reason.

For a safe proposal ID, render copy-only controls for:

```bash
agent-kernel inbox
agent-kernel approve <proposal-id> --publish
agent-kernel reject <proposal-id>
```

Also provide a copy-ID control. IDs that fail the existing safe file-ID contract receive no action commands and display `Invalid action ID`.

The page never calls localhost, submits forms, spawns processes, navigates to a custom protocol, or writes files. JavaScript is limited to local filtering, navigation, and clipboard feedback over already rendered content.

## Privacy and filesystem safety

- Apply existing secret-pattern and sensitive-key redaction before rendering.
- HTML-escape all dynamic text and attributes.
- Render `AGENT_KERNEL_HOME` or `~/.agent-kernel`, never the absolute home path.
- Render project name or registered ID, never its absolute path.
- Audit rows expose only timestamp, operation, actor category, target type, and compact redacted summary.
- Updater rows expose only mode, channel, versions, availability, checked time, and bounded error category.
- Reject an existing symbolic output target.
- Reject an existing non-regular output target.
- Reject symbolic existing parent components.
- Atomically replace the final file.
- Do not follow or replace symlink targets.
- Append one bounded redacted `dashboard.generate` audit record after successful generation.

Missing optional stores are empty. Malformed individual JSON files are counted, skipped, and reported generically without exposing their paths. A malformed central config is preserved and does not block unrelated sections.

## Browser opening

Use argument-array execution without a shell:

- macOS: `open <file>`
- Linux and other Unix: `xdg-open <file>`
- Windows: `rundll32.exe url.dll,FileProtocolHandler <file-url>`

Use bounded process startup and ignored stdio. Test seams:

- `AGENT_KERNEL_BROWSER_BIN`
- `AGENT_KERNEL_BROWSER_ARGS_JSON`, a JSON array of prefix arguments

Invalid override JSON fails before browser execution. Raw subprocess output is never returned.

## Visual system

- Background `#050505`
- Panels `#0B0B0B`
- Borders `#2A2A2A`
- Primary text `#F4F4F1`
- Secondary text `#8E8E88`
- Accent `#F8F46A`
- JetBrains Mono when locally available, otherwise a system monospace stack
- Compact spacing, thin borders, restrained radius
- Sticky compact header, summary strip, wide-screen side navigation, one-column mobile layout
- Expandable record cards, status pills, high-contrast copy buttons
- No gradients, glass effects, external fonts, images, analytics, remote URLs, or decorative AI visuals

## Testing strategy

Use a focused `test/public-cli-dashboard.mjs` module wired into `test/smoke.mjs`.

Regression coverage must prove:

- router delegation and default output
- custom output and project selection
- default browser opening, `--no-open`, JSON suppression, and explicit JSON opening
- browser failure containment
- self-contained output with no external assets or network primitives
- adaptive rendering across all known stores
- omission of empty sections
- safe copy commands and invalid-ID suppression
- redaction, HTML escaping, neutral path labels, and malformed-record diagnostics
- symlink and non-regular output rejection before writes
- source store immutability
- one bounded audit event per successful generation
- Node 18, 20, and 22 smoke matrices

## Documentation

Update:

- `README.md`
- `docs/RETENTION_AND_PORTABILITY.md`
- `docs/ARCHITECTURE_NOW.md`
- `docs/README.md`
- `docs/public-cli/ROUTED_COMMANDS.md`

## Exclusions

This PR does not add live refresh, file watching, a server, a dashboard daemon, browser-side mutation, remote sync, accounts, authentication, analytics, cloud storage, dependencies, a package-version bump, a release, a tag, or a merge.
