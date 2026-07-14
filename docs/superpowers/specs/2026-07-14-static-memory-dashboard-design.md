# Static Memory Dashboard Design

## Status

Approved on 2026-07-14 and aligned with the implemented focused-module boundary after the TDD cycle.

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

Human mode opens by default. JSON mode generates only unless `--open` is supplied. `--open` and `--no-open` are mutually exclusive. The stable default target is `~/.agent-kernel/reports/dashboard.html` and is atomically replaced.

## Final architecture

```text
agent-kernel dashboard
  -> bin/agent-kernel-router.mjs
  -> bin/agent-kernel-dashboard.mjs
       -> bin/dashboard/common.mjs
       -> bin/dashboard/state.mjs
       -> bin/dashboard/render.mjs
  -> sanitized self-contained HTML
  -> optional platform browser opener
```

Responsibilities:

- `agent-kernel-dashboard.mjs`: command orchestration and result/error envelopes
- `dashboard/common.mjs`: flags, redaction, paths, atomic output, audit, browser invocation, and safety errors
- `dashboard/state.mjs`: diagnostic-safe store readers, normalization, adaptive sections, and Architecture Guardian summary
- `dashboard/render.mjs`: escaped branded HTML, CSP, search, and copy-only interactions

This preserves the existing routed-helper pattern without expanding the already large portability helper. It adds no runtime dependency, frontend build system, daemon requirement, server, remote API, or persistent schema. The existing `agent-kernel report <file.html>` command remains compatible.

## Snapshot coverage

Known local sources are read conservatively:

- `source/memories/*.json`
- `source/policies/policies.json`
- `source/failures/failure-lessons.json`
- `source/agents/agents.json`
- `source/projects/projects.json`
- `inbox/pending`, `inbox/approved`, and `inbox/rejected`
- episode archive
- runtime session metadata
- commit-link index
- updater configuration summary and update cache
- retention summary
- bounded redacted audit history
- selected-project Architecture Guardian policy, map, contract, exception, and report summaries

The snapshot never embeds repository source, raw observation JSONL, environment variables, npm output, hook payloads, credentials, full audit metadata, updater audit logs, or daemon process internals.

## Adaptive sections

The shell always includes the title, generation timestamp, kernel version, neutral home label, search control, summary metrics, and diagnostics. Data sections are rendered only when useful:

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

A safe proposal ID receives copy-only controls for:

```bash
agent-kernel inbox
agent-kernel approve <proposal-id> --publish
agent-kernel reject <proposal-id>
```

The page also offers a copy-ID button. IDs outside the existing safe identifier contract receive no commands and display `Invalid action ID`.

The browser cannot call localhost, submit forms, spawn processes, navigate to a custom command protocol, or write files. Its script is limited to local filtering and clipboard feedback over rendered text.

## Privacy and filesystem safety

- Apply secret-pattern and sensitive-key redaction before rendering.
- HTML-escape all dynamic text and attributes.
- Replace absolute Agent Kernel and project paths with neutral labels.
- Reduce audit and Architecture Guardian data to bounded summaries.
- Count and skip malformed optional JSON files without exposing paths.
- Preserve malformed central configuration and continue with unrelated stores.
- Reject symbolic output targets, non-regular output targets, and symbolic existing parent directories.
- Validate browser override configuration before creating output directories or files.
- Atomically replace the final HTML.
- Append one bounded redacted `dashboard.generate` audit event after each successful generation.
- Emit structured JSON errors on stdout in JSON mode and human-readable errors on stderr otherwise.

## Browser opening

Use argument-array execution without a shell:

- macOS: `open`
- Linux and other Unix systems: `xdg-open`
- Windows: `rundll32.exe url.dll,FileProtocolHandler`

Browser-open failure leaves the generated file valid and reports a bounded category. Test seams are `AGENT_KERNEL_BROWSER_BIN` and a bounded JSON string array in `AGENT_KERNEL_BROWSER_ARGS_JSON`.

## HTML and visual boundary

- background `#050505`
- panels `#0B0B0B`
- borders `#2A2A2A`
- primary text `#F4F4F1`
- secondary text `#8E8E88`
- accent `#F8F46A`
- local JetBrains Mono or system monospace stack
- compact responsive layout, sticky header, metric strip, section navigation, expandable cards, and restrained status pills
- no gradients, glass effects, external fonts, images, analytics, remote URLs, or decorative AI visuals

The HTML includes a restrictive Content Security Policy. Its only inline script filters cards and copies already-rendered values. It contains no fetch, XMLHttpRequest, WebSocket, EventSource, external script, or external stylesheet.

## Validation contract

Focused smoke modules cover:

- routing and default output
- custom output and project selection
- default opening, `--no-open`, JSON suppression, and explicit JSON opening
- browser failure containment and preflight
- adaptive rendering across all known stores
- omission of empty sections
- copy commands and unsafe-ID suppression
- secret redaction, HTML injection, path labels, CSP, and malformed-record diagnostics
- symbolic and non-regular output rejection
- source store immutability
- bounded audit records
- structured JSON errors
- Node 18, 20, and 22 CI matrices

## Exclusions

This PR does not add live refresh, file watching, a server, a dashboard daemon, browser-side mutation, remote sync, accounts, authentication, analytics, cloud storage, runtime dependencies, a package-version bump, a release, a tag, or a merge.
