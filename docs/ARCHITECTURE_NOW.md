# Architecture Now

This document describes the code that is wired into the current repository

When roadmap documents and runtime behavior disagree, this document follows the runtime

## Current shape

Agent Kernel is a local-first governance kernel for coding agents

The memory and governance core remains a generated single-file CLI

```text
src/cli.mjs
  -> scripts/build.mjs
  -> dist/cli.mjs
```

The public executable is `bin/agent-kernel-router.mjs`

The router delegates core commands to the built CLI and delegates independent command families to focused executables

| Surface | Location | Responsibility |
|---|---|---|
| Core CLI | `src/cli.mjs` and `dist/cli.mjs` | Memory, proposals, compile, sync, link, episodes, guard, MCP, hooks, and core diagnostics |
| Public router | `bin/agent-kernel-router.mjs` | Top-level dispatch, runtime shim PATH, update notices, and post-command guidance |
| ContextFS global projection | `bin/agent-kernel-contextfs.mjs` | Global virtual `ak://` tree, L0/L1/L2 projections, deterministic retrieval, budget accounting, and retrieval traces |
| ContextFS project projection | `bin/agent-kernel-context-projects.mjs` | Project-scoped virtual tree, project identity resolution, derived file nodes, typed relations, and bounded same-file relation expansion |
| ContextFS session evidence | `bin/agent-kernel-context-used.mjs` | Append-only `context_used` observations with safe session and URI validation |
| ContextFS session commit | `bin/agent-kernel-context-commit.mjs` | Secret-redacted deterministic candidate extraction, approved/pending deduplication, commit metadata, and pending-only proposal creation |
| Environment Vault command | `bin/agent-kernel-env-vault.mjs` | Public `agent-kernel env` parsing, human output, JSON output, watcher lifecycle, and exit codes |
| Environment Vault modules | `src/env-vault.mjs` and `src/env-vault/*.mjs` | Identity, discovery, manifests, atomic local storage, revisions, restore conflicts, migration, doctor, and watcher operations |
| Focused helper commands | `bin/*.mjs` | Safe linking, runtime sessions, Failure Lessons, registries, portability, dashboard, trusted updates, Architecture Guardian, and hooks |
| Project Context Broker boundary | `bin/agent-kernel-project-broker-platform.mjs` | Credential-backend policy, Windows PATH compatibility, provider execution policy, and awaited broker delegation |
| Project Context Broker | `bin/agent-kernel-project-broker.mjs` | Project connection lifecycle, validated context, provider routing, approval state, and audit logging |
| Windows command primitive | `bin/agent-kernel-command-runner.mjs` | Allowlisted `.cmd` and `.bat` delegation through a trusted `cmd.exe` path |
| Dashboard modules | `bin/dashboard/*.mjs` | State normalization, privacy controls, atomic report writes, and static HTML rendering |
| Architecture engine | `bin/architecture-guardian/*.mjs` | Discovery, policies, contracts, baselines, exceptions, reuse search, and reporting |

The `src/adapters/`, `src/commands/`, `src/core/`, and `src/hooks/` directories are still placeholders

Code placed there is not part of the runtime unless the same change wires it into the build, command dispatcher, and tests

`src/env-vault/` is an intentional exception because `scripts/build.mjs` copies it into `dist/env-vault/` and both the focused command and core hooks import its public facade

## Public command flow

```text
agent-kernel / ak
  -> bin/agent-kernel-router.mjs
       -> focused command executable
       or
       -> bin/agent-kernel.mjs
            -> dist/cli.mjs
```

Routed command families include

```text
env
architecture
dashboard
update
ContextFS tree/read/find/used/commit
retention and portability
project and provider broker commands
registry and identity commands
failure pattern commands
MCP
search
commit linking
```

The router passes arguments after the routed top-level command to the focused executable

## Runtime data flow

```text
agent command
  |
  v
agent-kernel / ak
  |
  +--> memory:             ~/.agent-kernel/source/memories/*.json
  +--> failure lessons:    ~/.agent-kernel/source/failures/failure-lessons.json
  +--> policies:           ~/.agent-kernel/source/policies/policies.json
  +--> project identities: ~/.agent-kernel/source/projects/projects.json
  +--> proposals:          ~/.agent-kernel/inbox/{pending,approved,rejected}/
  +--> episodes:           ~/.agent-kernel/episodes/{archive,index.json,sources.json}
  +--> sessions:           ~/.agent-kernel/runtime/sessions/{*.json,*.jsonl}
  +--> ContextFS commits:  ~/.agent-kernel/runtime/sessions/*.context-commit.json
  +--> commit links:       ~/.agent-kernel/runtime/commits/index.json
  +--> update cache:       ~/.agent-kernel/runtime/update-status.json
  +--> project registry:   ~/.agent-kernel/connections/registry.toml
  +--> provider approvals: ~/.agent-kernel/connections/approvals.json
  +--> provider audit:     ~/.agent-kernel/logs/project-audit.jsonl
  +--> environment vault:  ~/.agent-kernel/vault/env/<sha256>/
  +--> legacy backups:     ~/.agent-kernel/vault/legacy-backups/
  +--> static dashboard:   ~/.agent-kernel/reports/dashboard.html
  +--> import backups:     ~/.agent-kernel/imports/backups/*
  +--> compiled output:    ~/.agent-kernel/dist/{AGENTS.md,CLAUDE.md,cursor-rule.mdc,...}
  +--> append-only logs:   ~/.agent-kernel/logs/*.jsonl
  +--> project local state:
       <project>/.agent-kernel/
         architecture/{policy,map,baseline,contract,exceptions,reports}
         env-backups/<timestamp>/
```

Generated files under package `dist/` and runtime `reports/` are disposable outputs

Reviewed local stores, proposal state, Vault manifests, provider approval state, and project architecture files remain authoritative

ContextFS is a virtual projection over those stores. `ak://` URIs are not physical paths and do not introduce a second source of truth

## ContextFS boundary

```text
agent-kernel context tree|read|find ak://global/... or global scope
  -> bin/agent-kernel-router.mjs
  -> bin/agent-kernel-contextfs.mjs
       -> read existing memory/failure/episode/session/commit stores
       -> project global virtual ak:// nodes
       -> return L0/L1/L2 or budgeted retrieval trace

agent-kernel context tree|read|find ak://projects/<project-id>/...
agent-kernel context find ... --project <registered-path>
  -> bin/agent-kernel-router.mjs
  -> bin/agent-kernel-context-projects.mjs
       -> resolve an existing project identity without mutation
       -> filter authoritative records to the exact project
       -> derive virtual file nodes from stored file references
       -> expose owned-by-project/references-file/referenced-by relations
       -> expand a bounded number of same-file related records
       -> enforce project-only result URIs and budgeted L0/L1 output

agent-kernel context used ...
  -> bin/agent-kernel-context-used.mjs
       -> append context_used observation
       -> update session observation count

agent-kernel context commit ...
  -> bin/agent-kernel-context-commit.mjs
       -> read session + observations
       -> redact known credential patterns
       -> extract deterministic candidates
       -> deduplicate approved + pending text hashes
       -> call core propose flow for novel candidates
       -> write session context-commit metadata
```

ContextFS invariants

- Existing JSON and JSONL records remain authoritative
- L0 is a compact abstract, L1 is a structured overview, and L2 is sanitized authoritative detail
- Hierarchical find never loads L2 automatically
- Retrieval remains local and deterministic in phase 1
- No vector database, embeddings, LLM, cloud service, daemon, or runtime dependency is required
- `ak://` identifiers reject foreign schemes, traversal, encoded traversal, backslashes, NULs, control characters, query strings, fragments, credentials, and encoded separators before lookup
- Project-scoped tree/read/find only returns records matching the selected project identity
- `--project` resolves an existing local identity and does not register a new project
- Contradictory project selectors fail closed with a project-scope mismatch
- Project file nodes are derived from stored references and do not authorize arbitrary file reads
- Relation expansion stays in the project, follows stored file evidence, and has bounded fan-out
- Session IDs are validated before filesystem access
- Used-context evidence is append-only session evidence, not durable memory
- Session commit redacts known secrets before dry-run output, metadata persistence, or proposal creation
- Session commit can create pending proposals only and never approves or publishes memory
- Repeated session commit is idempotent and does not duplicate pending proposals
- ContextFS can be removed without migrating approved memory, Failure Lessons, episodes, sessions, project identities, or commit links

The implementation is clean-room. Public architectural ideas informed the feature, but OpenViking source code, schemas, tests, constants, and implementation-specific algorithms are not copied. Agent Kernel remains MIT licensed

## Environment Vault boundary

```text
agent-kernel env ...
  -> bin/agent-kernel-router.mjs
  -> bin/agent-kernel-env-vault.mjs
  -> src/env-vault.mjs
       -> identity.mjs
       -> discovery.mjs
       -> manifest.mjs
       -> storage.mjs
       -> engine.mjs
       -> watcher.mjs
```

Responsibilities

- `identity.mjs` resolves the Git project root, canonicalizes SSH and HTTPS remotes, removes credentials, and derives a full SHA256 identity
- `discovery.mjs` finds `.env` and `.env.*` files inside the project root, applies exclusions, and validates explicit Monorepo paths
- `storage.mjs` rejects symlinks and non-regular files, performs owner-only atomic writes, and provides per-vault locks
- `manifest.mjs` validates manifest version 2, normalized paths, hashes, revisions, and linked or detached paths
- `engine.mjs` implements link, push, pull, status, revisions, doctor, unlink, purge, and legacy migration
- `watcher.mjs` watches selected parent directories, debounces changes, and reconciles periodically
- `src/env-vault.mjs` is the stable public facade imported by the command and existing hooks

Vault invariants

- Secret values are never part of command output
- Project identity never stores remote credentials
- Selected paths remain inside the project root
- Symlinks and non-regular files are rejected
- Existing differing local files are never overwritten without explicit force
- Forced restore creates a project-local backup unless explicitly disabled
- Automatic session restore writes missing files only
- Vault writes use `0600`, directories use `0700`, and permission repair is available on POSIX systems
- Manifest corruption blocks writes rather than creating a replacement identity silently
- `unlink` retains Vault data while `purge --yes` performs destructive deletion

`AGENT_KERNEL_HOME` controls every Vault path and the router runtime shim path

## Hook integration

The core CLI imports the public Environment Vault facade

Session start attempts a missing-only restore for a linked project

Post tool use calls the Vault synchronization API after an environment file write

The focused public command is separate from the hook adapter so command parsing can evolve without moving hook ownership out of the core CLI

Hooks are adapters, not hidden autonomous workers

They never approve memory, bypass restore conflicts, or print secret values

## Static dashboard boundary

```text
agent-kernel dashboard
  -> bin/agent-kernel-router.mjs
  -> bin/agent-kernel-dashboard.mjs
       -> bin/dashboard/common.mjs
       -> bin/dashboard/state.mjs
       -> bin/dashboard/render.mjs
  -> sanitized HTML snapshot
```

The page is read-only

Browser JavaScript filters rendered cards and copies rendered identifiers or commands

It does not call localhost, fetch remote data, approve proposals, change trust, install packages, or mutate files

The generator excludes raw observations, environment file content, repository source, hook payloads, npm output, complete audit metadata, and updater audit logs

## Trusted updater boundary

```text
agent-kernel update ...
  -> bin/agent-kernel-router.mjs
  -> bin/agent-kernel-update.mjs
  -> npm view or exact global npm install
```

`bin/agent-kernel-update.mjs` is the only component permitted to contact npm or install an Agent Kernel package

The router may perform check-only metadata refreshes before selected lifecycle commands when agent-approved update mode is enabled

This refresh cannot install and cannot fail the requested lifecycle command

## Project broker platform boundary

```text
agent-kernel auth|provider|approvals|audit|context|project ...
  -> bin/agent-kernel-router.mjs
  -> bin/agent-kernel-project-broker-platform.mjs
       -> credential policy
       -> Windows PATH sanitization
       -> allowlisted command runner
  -> bin/agent-kernel-project-broker.mjs
```

Persistent credential mutation is available only where a secure credential backend is configured

Provider environment values are never persisted by the wrapper

On Windows, only allowlisted absolute regular-file launchers are delegated through the trusted command processor path

General shell execution and arbitrary batch names are rejected

## Command ownership

| Area | Commands | Source of truth |
|---|---|---|
| Memory | `remember`, `memory list/search/show`, `validate` | `source/memories/*.json` |
| Approval workflow | `propose`, `inbox`, `approve`, `reject`, `publish` | `inbox/*`, then reviewed memory stores |
| ContextFS | `context tree/read/find/used/commit` | virtual projection over existing stores; project identity from `source/projects/projects.json`; used evidence in session JSONL; commit metadata in session runtime; durable candidates in pending inbox only |
| Episodes | `episode add/sync/search/show/stats/reindex` | `episodes/archive/*.json`, `episodes/index.json` |
| Failure Lessons | `failure capture/learn/list/search/show/propose/promote/validate` | `source/failures/failure-lessons.json` |
| Environment Vault | `env link/status/push/pull/watch/doctor/history/restore/list/unlink/purge` | `vault/env/<sha256>/manifest.json`, current files, revisions, and project backups |
| Retention and portability | `retention status/prune`, `session compact`, `export`, `import`, `view`, `report` | managed local JSON and JSONL state plus explicit export files |
| Static inspection | `dashboard` | read-only projections of known local stores |
| Trusted updates | `update status/check/enable/disable/channel/trust/revoke/apply` | update config, cache, and audit |
| Project and providers | project, context, audit, approvals, provider commands | project manifest, registry, active context, credentials, approvals, and audit log |
| Architecture conformance | architecture command family | project `.agent-kernel/architecture/*` |
| Agent output | `compile`, `sync`, `link` | generated agent files |
| Enforcement | `guard`, hook installers, architecture hook | deny patterns, policy, contracts, and hook configs |
| MCP | `mcp serve/config/install` | stdio MCP server over local state |
| Diagnostics | `doctor`, `status`, `dashboard`, environment doctor, architecture doctor, update status | current filesystem and validated config |

## Files that matter

| Path | Purpose |
|---|---|
| `src/cli.mjs` | Core CLI and hook adapters |
| `dist/cli.mjs` | Generated CLI, never hand-edit |
| `src/env-vault.mjs` | Public Environment Vault facade |
| `src/env-vault/*.mjs` | Vault identity, discovery, storage, manifest, engine, and watcher modules |
| `dist/env-vault.mjs` and `dist/env-vault/*.mjs` | Generated Vault runtime copied by the build |
| `bin/agent-kernel-router.mjs` | Public command dispatcher and runtime environment preparation |
| `bin/agent-kernel-contextfs.mjs` | Global ContextFS URI parser, projection, progressive reads, hierarchical find, and trace output |
| `bin/agent-kernel-context-projects.mjs` | Project ContextFS projection, derived file nodes, project resolution, typed relations, and bounded relation retrieval |
| `bin/agent-kernel-context-used.mjs` | ContextFS used-record session evidence writer |
| `bin/agent-kernel-context-commit.mjs` | ContextFS deterministic review-first session commit worker with candidate secret redaction |
| `bin/agent-kernel-env-vault.mjs` | Public Environment Vault command |
| `bin/agent-kernel-dashboard.mjs` | Dashboard command orchestrator |
| `bin/dashboard/*.mjs` | Dashboard safety, state, and rendering |
| `bin/agent-kernel-portability.mjs` | Retention, compaction, export, import, view, and compatibility report |
| `bin/agent-kernel-update.mjs` | Trusted updater transaction |
| `bin/agent-kernel-project-broker-platform.mjs` | Cross-platform credential and provider boundary |
| `bin/agent-kernel-command-runner.mjs` | Allowlisted Windows command normalization |
| `bin/agent-kernel-project-broker.mjs` | Project connection and provider lifecycle |
| `bin/agent-kernel-architecture.mjs` | Architecture Guardian command |
| `bin/architecture-guardian/*.mjs` | Architecture analysis modules |
| `scripts/build.mjs` | Version injection and runtime copy, including `dist/env-vault/` |
| `scripts/lint*.mjs` | Repository consistency, mode, documentation, and secret checks |
| `test/smoke.mjs` | Focused test orchestrator |
| `test/public-cli-context.mjs` | ContextFS routing, URI safety, progressive reads, retrieval trace, session evidence, commit governance, and legacy context compatibility |
| `test/contextfs-security.mjs` | ContextFS session-commit secret-redaction regression coverage |
| `test/contextfs-projects.mjs` | Project tree/read/find, derived file records, project resolution, scope mismatch, and relation-expansion coverage |
| `test/env-vault.mjs` | Cross-platform Vault identity, permissions, conflict, symlink, and routing coverage |
| `docs/CONTEXTFS.md` | ContextFS operator, security, licensing, and rollback guide |
| `docs/ENVIRONMENT_VAULT.md` | Operator command and security guide |

## Testing model

`npm test` runs version validation and the focused smoke orchestrator

Environment Vault coverage uses isolated homes and temporary Git repositories

ContextFS coverage uses an isolated Agent Kernel home and verifies

- canonical `ak://` global and project tree/record URIs
- traversal, encoded traversal, foreign scheme, backslash, control-character, and unsafe session-ID rejection
- L0/L1/L2 progressive read contracts
- project/file-aware deterministic ranking
- exact project-scope isolation and contradictory selector rejection
- derived project file records without arbitrary repository-file reads
- bounded same-file relation expansion with explicit trace evidence
- context budget enforcement and trace explainability
- append-only used-context evidence
- review-first dry-run and pending-only session commit
- session candidate secret redaction across output, metadata, and pending proposals
- approved-memory immutability and repeated-commit idempotency

Environment Vault coverage verifies

- canonical identity across credential-bearing HTTPS and SSH remotes
- full SHA256 fingerprints
- explicit path identity opt-in
- recursive Monorepo discovery and template exclusions
- `AGENT_KERNEL_HOME`
- owner-only stored files on POSIX systems
- restore conflict refusal
- forced restore backups
- symlink rejection
- router JSON output without secret values

CI runs build and smoke across supported Node versions on Ubuntu, plus native Windows coverage, typecheck, package preflight, audit, documentation checks, and CodeQL

A new runtime behavior must add or update focused coverage before implementation

## Modularization rule

New production code belongs in a focused routed subsystem when it has a clear command boundary and independent tests

Core extraction under `src/core/` and `src/commands/` remains planned work

Until that work lands, do not place unreferenced production code in placeholder directories