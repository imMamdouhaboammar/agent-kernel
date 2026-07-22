# Architecture Now

This document describes what the repository actually is today. When code and roadmap disagree, this file follows the code.

## Current shape

Agent Kernel is a local-first governance kernel for coding agents. The core runtime remains a single-file CLI:

```text
src/cli.mjs  ->  scripts/build.mjs  ->  dist/cli.mjs
```

The npm executable is exposed through `bin/agent-kernel-router.mjs`. It delegates core commands to the built CLI and intentionally separate command families to focused helpers.

| Surface | Location | Purpose |
|---|---|---|
| Core CLI | `src/cli.mjs` / `dist/cli.mjs` | Memory, proposals, compile/sync/link, episodes, guard, MCP, and status |
| Focused helper commands | `bin/*.mjs` | Safe linking, runtime sessions, Failure Lessons, registries, retention and portability, static dashboard, trusted updates, Architecture Guardian, and hooks |
| Project Context Broker | `bin/agent-kernel-project-broker.mjs` | Project connection lifecycle, manifest-bound provider routing, credential isolation, policy gates, and provider audit records |
| Dashboard modules | `bin/dashboard/*.mjs` | Dashboard safety primitives, adaptive local-state normalization, and static HTML rendering |
| Architecture engine | `bin/architecture-guardian/*.mjs` | Dependency discovery, policy checks, contracts, baselines, exceptions, reuse search, and reporting |

The `src/{adapters,commands,core,hooks}/` folders are still placeholders. Files placed there are not imported by the runtime today. Focused, routed subsystems belong under `bin/` until a real core modularization wires those placeholders into the build and CLI.

## Runtime data flow

```text
agent command
  |
  v
agent-kernel / ak
  |
  +--> core memory:       ~/.agent-kernel/source/memories/*.json
  +--> failure lessons:   ~/.agent-kernel/source/failures/failure-lessons.json
  +--> policies:          ~/.agent-kernel/source/policies/policies.json
  +--> proposals:         ~/.agent-kernel/inbox/{pending,approved,rejected}/
  +--> episodes:          ~/.agent-kernel/episodes/{archive,index.json,sources.json}
  +--> sessions:          ~/.agent-kernel/runtime/sessions/{*.json,*.jsonl}
  +--> commit links:      ~/.agent-kernel/runtime/commits/index.json
  +--> update cache:      ~/.agent-kernel/runtime/update-status.json
  +--> update audit:      ~/.agent-kernel/logs/updates.jsonl
  +--> project registry:   ~/.agent-kernel/connections/registry.toml
  +--> provider audit:     ~/.agent-kernel/logs/project-audit.jsonl
  +--> GCloud profiles:    ~/.agent-kernel/gcloud/<profile>/
  +--> static dashboard:  ~/.agent-kernel/reports/dashboard.html
  +--> import backups:    ~/.agent-kernel/imports/backups/*
  +--> compiled output:   ~/.agent-kernel/dist/{AGENTS.md,CLAUDE.md,cursor-rule.mdc,...}
  +--> append-only logs:  ~/.agent-kernel/logs/*.jsonl
  +--> project architecture state:
       <project>/.agent-kernel/architecture/{policy,map,baseline,contract,exceptions,reports}
```

Generated files under `dist/` and `reports/` are disposable outputs. Source of truth remains the local JSON and JSONL stores, proposal lifecycle, updater governance state, and reviewed project Architecture Guardian state.

Retention removes only reviewed raw observation logs. Review-first imports create pending proposals. Replacement imports validate identifiers and back up managed state before restoring it.

## Static dashboard boundary

The dashboard is deliberately isolated from the monolithic core and the compatibility report implementation:

```text
agent-kernel dashboard
  -> bin/agent-kernel-router.mjs
  -> bin/agent-kernel-dashboard.mjs
       -> bin/dashboard/common.mjs
       -> bin/dashboard/state.mjs
       -> bin/dashboard/render.mjs
  -> sanitized HTML snapshot
  -> optional operating-system browser opener
```

Responsibilities:

- `agent-kernel-dashboard.mjs` owns command orchestration and human or JSON output.
- `dashboard/common.mjs` owns flags, errors, redaction, paths, atomic writes, browser invocation, and bounded audit records.
- `dashboard/state.mjs` reads known stores, skips malformed optional files, normalizes bounded records, and creates adaptive sections.
- `dashboard/render.mjs` HTML-escapes dynamic values and produces the branded CSP-restricted page.

The page is read-only. Browser JavaScript filters rendered cards and copies rendered IDs or commands. It does not call localhost, fetch data, submit actions, approve proposals, change trust, install packages, or mutate files.

A safe pending proposal may expose copy-only text for `inbox`, `approve --publish`, and `reject`. User review and command execution still occur through the CLI or connected agent.

The generator excludes raw observations, environment variables, repository source, hook payloads, npm output, complete audit metadata, and updater audit logs. It rejects symbolic or non-regular output targets and symbolic existing parent directories, validates browser overrides before output creation, writes atomically, and leaves the HTML intact when the browser cannot open.

## Updater boundary

```text
agent-kernel update ...
  -> bin/agent-kernel-router.mjs
  -> bin/agent-kernel-update.mjs
  -> npm view or exact global npm install
```

`bin/agent-kernel-update.mjs` is the only component allowed to contact npm or install a package. It validates initialized governance state, configuration, channels, semantic versions, confirmations, agent identities, and allowlist membership before npm execution.

The router may perform check-only metadata refreshes before stale `doctor`, `start`, `compile`, `sync`, or `status` commands when agent-approved mode is enabled. This path cannot install and cannot fail the requested lifecycle command.

A separate offline guidance helper reads config and cached update state after successful update, init, compile, sync, or link operations. It never contacts npm, creates missing integration files, or truncates files with malformed markers.

## What the CLI does

| Area | Commands | Source of truth |
|---|---|---|
| Memory | `remember`, `memory list/search/show`, `validate` | `source/memories/*.json` |
| Approval workflow | `propose`, `inbox`, `approve`, `reject`, `publish` | `inbox/*`, then `source/memories/*` after approval |
| Episodes | `episode add/sync/search/show/stats/reindex` | `episodes/archive/*.json`, `episodes/index.json` |
| Failure Lessons | `failure capture/learn/list/search/show/propose/promote/validate` | `source/failures/failure-lessons.json` |
| Retention and portability | `retention status/prune`, `session compact`, `export`, `import`, `view`, `report` | managed local JSON/JSONL state and explicit export files |
| Static inspection | `dashboard` | read-only projections of known local stores and project architecture state |
| Trusted updates | `update status/check/enable/disable/channel/trust/revoke/apply` | `config.json#updates`, update cache, and update audit |
| Project connection and providers | `project connect/disconnect/reconnect/status/doctor`, `provider supabase exec`, `provider gcloud exec` | project `.agent-kernel/project.toml`, global connection registry, Keychain or isolated GCloud profile state, and provider audit log |
| Architecture conformance | `architecture init/discover/baseline/diff/check/reuse/contract/exception/policy/doctor` | project `.agent-kernel/architecture/*` |
| Agent output | `compile`, `sync`, `link` | generated agent files |
| Enforcement | `guard`, enforcement and hook installers, Architecture Guardian hook | deny patterns, architecture policy, contracts, and hook configs |
| MCP | `mcp serve/config/install` | stdio MCP server over local kernel state |
| Diagnostics | `doctor`, `status`, `view`, `report`, `dashboard`, architecture doctor, update status | current filesystem and config state |

## Architecture Guardian flow

```text
project files + policy + active contract
  -> deterministic architecture map
  -> dependency, cycle, package, and scope evaluation
  -> confidence filtering
  -> scoped exception filtering
  -> baseline classification
  -> conformance report
```

Only new unsuppressed blocking findings fail a strict check. Known baseline debt remains visible. Reuse search checks existing symbols before a second implementation is introduced. Pre-write hooks enforce scope; content-dependent dependency checks run after files exist.

## Files that matter

| Path | Purpose |
|---|---|
| `src/cli.mjs` | Core single-file CLI source |
| `dist/cli.mjs` | Generated CLI; do not hand-edit |
| `bin/agent-kernel-router.mjs` | Public routing, stale updater refreshes, cached notices, and guidance publication |
| `bin/agent-kernel-dashboard.mjs` | Static dashboard command orchestrator |
| `bin/dashboard/common.mjs` | Dashboard flags, privacy, filesystem, browser, and audit boundary |
| `bin/dashboard/state.mjs` | Adaptive local-state readers and normalization |
| `bin/dashboard/render.mjs` | Escaped branded static HTML renderer |
| `bin/agent-kernel-portability.mjs` | Retention, compaction, export/import, local view, and compatibility report |
| `bin/agent-kernel-update.mjs` | Trusted updater command and transaction |
| `bin/agent-kernel-update-guidance.mjs` | Offline update-notice publisher |
| `bin/agent-kernel-project-broker.mjs` | Project connection lifecycle, provider target enforcement, policy gates, isolated credentials, and audit logging |
| `bin/agent-kernel-architecture.mjs` | Architecture Guardian command surface |
| `bin/architecture-guardian/*.mjs` | Architecture analysis and policy modules |
| `scripts/build.mjs` | Version injection and dist copy |
| `scripts/lint*.mjs` | Repository consistency, helper, mode, and secret checks |
| `test/smoke.mjs` | Focused test orchestrator |
| `test/public-cli-dashboard.mjs` | Dashboard behavior, stores, browser, immutability, and audit coverage |
| `test/public-cli-dashboard-safety.mjs` | Dashboard CSP, injection, JSON errors, malformed config, and output-path safety |
| `test/public-cli-portability.mjs` | Retention, export/import, restore, report, and path safety |
| `test/public-cli-update.mjs` | Updater configuration, authorization, transaction, rollback, and notices |
| `test/architecture-guardian*.mjs` | Architecture Guardian smoke and eval coverage |
| `docs/` | Runtime, protocol, integration, update, dashboard, retention, and architecture docs |

## Placeholder folders

These folders are not runtime modules today:

```text
src/adapters/
src/commands/
src/core/
src/hooks/
```

Do not add production code there unless the work also wires it into `src/cli.mjs`, the build, and tests.

## Testing model

`npm test` runs version validation and `test/smoke.mjs`. The orchestrator imports focused modules and fails loudly when one throws.

Dashboard tests use isolated Agent Kernel homes, fake browser executables, temporary projects, and synthetic stores. They cover routing, default and custom output, human and JSON opening, adaptive sections, malformed records, redaction, HTML injection, CSP, network-free output, safe and unsafe proposal IDs, browser failure, project isolation, symlink and non-regular targets, symbolic parents, source immutability, and audit records without opening a real browser or changing real memory.

Updater tests use fake npm and CLI executables. Project Context Broker tests use temporary Git repositories and linked worktrees plus fake Supabase, GCloud, and Keychain executables to verify target enforcement, executable resolution, fail-closed process exits, and shim isolation without contacting external services. Portability tests use isolated homes and export/import fixtures. Architecture Guardian runs both focused smoke and data-driven scenarios.

A new feature should add or update a focused test module and wire it through `test/smoke.mjs`.

## Hook model

Claude hooks are integration adapters, not hidden agents. Use pre-write hooks for dangerous command or architecture scope checks and failure hooks for evidence capture. Hooks never approve or publish memory and should not pretend to validate content that does not exist yet.

## MCP model

The local MCP server exposes inspection and proposal capabilities over stdio. Approval remains disabled by default. Architecture Guardian, the trusted updater, and the browser dashboard do not add hidden MCP mutation, policy, trust, install, or browser-action tools.

## Modularization plan

The planned core extraction remains under `src/core/` and `src/commands/`. Until that work lands, edit wired runtime surfaces. Focused helper subsystems may remain under `bin/` when explicitly routed, packaged, documented, and tested.

## CI

The CI workflow covers:

- build, lint, and smoke on Node 18, 20, and 22
- TypeScript typecheck
- package and manifest discipline, including package dry-run
- dependency audit
- docs sanity

Release workflows publish only from reviewed version tags. This dashboard PR does not change package version, publish, tag, release, or merge behavior.
