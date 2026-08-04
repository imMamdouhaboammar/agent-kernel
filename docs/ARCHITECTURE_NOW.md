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
  +--> proposals:          ~/.agent-kernel/inbox/{pending,approved,rejected}/
  +--> episodes:           ~/.agent-kernel/episodes/{archive,index.json,sources.json}
  +--> sessions:           ~/.agent-kernel/runtime/sessions/{*.json,*.jsonl}
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
| `test/env-vault.mjs` | Cross-platform Vault identity, permissions, conflict, symlink, and routing coverage |
| `docs/ENVIRONMENT_VAULT.md` | Operator command and security guide |

## Testing model

`npm test` runs version validation and the focused smoke orchestrator

Environment Vault coverage uses isolated homes and temporary Git repositories

It verifies

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
