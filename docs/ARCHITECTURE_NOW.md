# Architecture Now

This document describes what the repository actually is today. It is intentionally practical: when the code and roadmap disagree, this file follows the code.

## Current shape

Agent Kernel is a local-first governance kernel for coding agents. The core runtime is still a single-file CLI:

```text
src/cli.mjs  ->  scripts/build.mjs  ->  dist/cli.mjs
```

The npm executable is exposed through `bin/agent-kernel-router.mjs`, which routes core commands to the built CLI and focused command families to dedicated helper binaries. Focused helpers live in `bin/` when their behavior is intentionally outside the current single-file runtime.

That means there are three runtime surfaces today:

| Surface | Location | Purpose |
|---|---|---|
| Core CLI | `src/cli.mjs` / `dist/cli.mjs` | Memory, proposals, compile/sync/link, episodes, guard, MCP, status |
| Focused helper commands | `bin/*.mjs` | Safe linking, runtime sessions, Failure Lessons, registries, retention and portability, trusted updates, Architecture Guardian, and hooks |
| Architecture engine modules | `bin/architecture-guardian/*.mjs` | Dependency discovery, policy checks, contracts, baselines, exceptions, reuse search, and reporting |

The `src/{adapters,commands,core,hooks}/` folders are still placeholders. They document the future core modular layout, but files placed there are not imported by the runtime today. Architecture Guardian is deliberately implemented as a wired helper subsystem under `bin/architecture-guardian/`, not inside those placeholders.

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
  +--> import backups:    ~/.agent-kernel/imports/backups/*
  +--> compiled output:   ~/.agent-kernel/dist/{AGENTS.md,CLAUDE.md,cursor-rule.mdc,...}
  +--> append-only logs:  ~/.agent-kernel/logs/*.jsonl
  +--> project architecture state:
       <project>/.agent-kernel/architecture/{policy,map,baseline,contract,exceptions,reports}
```

Generated files in `~/.agent-kernel/dist/` are disposable outputs. The source of truth is the JSON under `~/.agent-kernel/source/`, the proposal inbox, the episode/failure archives, runtime session and commit-link stores, updater configuration and audit state, and reviewed project-local Architecture Guardian policy state.

Retention removes only eligible raw session observation logs after explicit confirmation. Review-first imports create pending proposals. Explicit replacement imports validate every file-backed identifier, back up managed local state, and then restore the state represented by the export.

## Updater boundary

The updater is deliberately outside the monolithic core runtime:

```text
agent-kernel update ...
  -> bin/agent-kernel-router.mjs
  -> bin/agent-kernel-update.mjs
  -> npm view or exact global npm install
```

`bin/agent-kernel-update.mjs` is the only updater component allowed to contact npm or install a package. It validates initialized governance state, strict JSON configuration, channels, semantic versions, confirmations, agent identities, and allowlist membership before executing npm.

Read-only status and explicit checks can use updater defaults before initialization. Governance mutations require the canonical `config.json` created by `agent-kernel init`; they never create a partial core config. Malformed config is rejected and preserved.

The router can perform an opportunistic metadata refresh before `doctor`, `start`, `compile`, `sync`, and `status` when all of these conditions hold:

- agent-approved mode is enabled
- the command is not using `--json`
- the cache is missing or older than `checkIntervalHours`
- `AGENT_KERNEL_DISABLE_AUTO_UPDATE_CHECK` is not `1`

This path invokes `update check --json` with a 20-second subprocess timeout. It may contact npm, but it never installs a package and its failure never fails the requested lifecycle command. All other normal commands read cached state only.

A failed refresh preserves a compatible previously known update target and records the failure category. This lets existing notices remain visible while the next stale check retries the registry.

Agent guidance notifications use a separate offline path:

```text
successful update/init/compile/sync/link
  -> bin/agent-kernel-update-guidance.mjs
  -> read config + cached update status
  -> refresh bounded managed blocks in existing agent guidance files
```

The guidance publisher never contacts npm and does not create missing agent integration files. It exists separately so compile and sync stay free of updater installation logic while generated files can be rewritten safely and then receive the current cached notice. An unmatched start marker causes the publisher to skip that file rather than truncate or repair surrounding user content.

## What the CLI does

| Area | Commands | Source of truth |
|---|---|---|
| Memory | `remember`, `memory list/search/show`, `validate` | `source/memories/*.json` |
| Approval workflow | `propose`, `inbox`, `approve`, `reject`, `publish` | `inbox/*`, then `source/memories/*` after approval |
| Episodes | `episode add/sync/search/show/stats/reindex` | `episodes/archive/*.json`, `episodes/index.json` |
| Failure Lessons | `failure capture/learn/list/search/show/propose/promote/validate` | `source/failures/failure-lessons.json` |
| Retention and portability | `retention status/prune`, `session compact`, `export`, `import`, `view`, `report` | managed local JSON/JSONL state and explicit export files |
| Trusted updates | `update status/check/enable/disable/channel/trust/revoke/apply` | `config.json#updates`, `runtime/update-status.json`, `logs/updates.jsonl` |
| Architecture conformance | `architecture init/discover/baseline/diff/check/reuse/contract/exception/policy/doctor` | `<project>/.agent-kernel/architecture/*` |
| Agent output | `compile`, `sync`, `link` | `dist/*`, project-local agent files |
| Enforcement | `guard`, `enforce install`, `git-hook install`, Architecture Guardian `PreToolUse` hook | deny patterns, architecture policy, change contract, hook configs |
| MCP | `mcp serve/config/install` | stdio MCP server over the local kernel state |
| Diagnostics | `doctor`, `status`, `view`, `report`, `architecture doctor`, `update status` | current filesystem and config state |

## Architecture Guardian flow

Architecture Guardian implements a closed local control loop:

```text
project files + policy + active contract
  -> deterministic architecture map
  -> dependency, cycle, package, and scope evaluation
  -> confidence filtering
  -> scoped exception filtering
  -> baseline classification
  -> conformance report
```

Only new unsuppressed blocking findings fail a check. Known baseline debt remains visible but does not become the responsibility of an unrelated change. The reuse command searches existing symbols before an agent introduces a second implementation. The Claude hook checks write scope before `Write`, `Edit`, or `MultiEdit`; content-dependent dependency checks run after files exist.

## Files that matter

| Path | Purpose |
|---|---|
| `src/cli.mjs` | Core single-file CLI source. Edit this for core runtime commands. |
| `dist/cli.mjs` | Built CLI copied from `src/cli.mjs` by `scripts/build.mjs`. Do not hand-edit. |
| `bin/agent-kernel-router.mjs` | Public router for `agent-kernel` and `ak`, including stale update refreshes, cached notices, and lifecycle guidance publication. |
| `bin/agent-kernel-update.mjs` | Configurable npm channel checks, strict config handling, agent authorization, exact-version installation, verification, rollback, cache, and audit. |
| `bin/agent-kernel-update-guidance.mjs` | Offline, marker-safe publisher for bounded cached update notices in existing agent guidance files. |
| `bin/agent-kernel-portability.mjs` | Retention, compaction, redacted export, review-first import, explicit restore, local view, and static report helper. |
| `bin/agent-kernel-architecture.mjs` | Architecture Guardian command surface. |
| `bin/agent-kernel-architecture-hook.mjs` | Claude `PreToolUse` scope adapter. |
| `bin/architecture-guardian/*.mjs` | Focused architecture analysis and policy modules. |
| `bin/agent-kernel-failure.mjs` | Failure Lessons CLI helper. |
| `bin/agent-kernel-failure-hook.mjs` | Claude hook adapter for failed tool payloads. |
| `bin/agent-kernel-agent-propose.mjs` | Safe agent proposal wrapper. |
| `scripts/build.mjs` | Version injection and dist copy. |
| `scripts/lint.mjs` | Repository consistency checks and secret-pattern sanity. |
| `scripts/lint-bins.mjs` | Helper binary sanity checks. |
| `scripts/lint-modes.mjs` | Mode/write helper sanity checks. |
| `scripts/check-version.mjs` | Version single-source-of-truth check. |
| `test/smoke.mjs` | Test orchestrator that imports focused test modules. |
| `test/public-cli-update.mjs` | End-to-end updater config, cache, lifecycle refresh, authorization, install, verification, rollback, audit, guidance, and router notice coverage. |
| `test/public-cli-portability.mjs` | End-to-end retention, export/import, restore, reporting, and path-safety coverage. |
| `test/architecture-guardian.mjs` | Focused Architecture Guardian smoke coverage. |
| `test/architecture-guardian-evals.mjs` | Data-driven Architecture Guardian torture bench. |
| `test/fixtures/architecture-guardian/` | Positive and negative architecture scenarios. |
| `docs/` | Architecture, memory, updates, retention, MCP, hooks, Failure Lessons, integration docs. |
| `skills/architecture-guardian/` | Canonical skill, references, schemas, and templates. |
| `.claude/` | Repo-local ECC artifacts and Claude workflow scaffolds. |
| `.codex/` | Repo-local Codex baseline and role configs. |
| `.agents/skills/` | Codex-facing repository skills. |
| `.claude-plugin/` | Claude Code marketplace metadata. |
| `SKILL.md` | Root Skills.sh / Claude skill discovery file. |
| `skills.sh.json` | Skills.sh grouping metadata. |

## Placeholder folders

The following folders are not runtime modules today:

```text
src/adapters/
src/commands/
src/core/
src/hooks/
```

They exist to reserve the future core architecture. Do not add production code there unless the modularization work also wires them into `src/cli.mjs`, the build process, and the test suite.

## Testing model

`npm test` runs:

```bash
node scripts/check-version.mjs && node test/smoke.mjs
```

`test/smoke.mjs` is an orchestrator. It imports focused modules such as `test/init.mjs`, `test/memory.mjs`, `test/episode.mjs`, `test/mcp.mjs`, `test/failure-lessons.mjs`, `test/public-cli-update.mjs`, `test/public-cli-portability.mjs`, `test/architecture-guardian.mjs`, and package-file checks.

The updater module uses an isolated Agent Kernel home and injected fake npm and CLI executables. It covers uninitialized governance rejection, malformed config preservation, default-disabled state, confirmation gates, channel and identity validation, cache reuse, forced and stale lifecycle checks, registry failure with compatible-cache preservation, denial before installation, trusted-agent installation, environment identity, verification, rollback, Windows-safe executable selection by implementation inspection, redacted audit records, marker-safe guidance publication, and cached router notices without real network or global package mutation.

The portability module runs the public router against isolated temporary homes. It covers deterministic compaction, retention preview and force requirements, protected state, redaction, schema rejection, review-first imports, duplicate detection, path traversal rejection before writes, complete replacement restore, offline views, static reports, and audit records.

Architecture Guardian additionally runs data-driven scenarios covering correct silence and correct enforcement: valid layers, forbidden dependency direction, cycles, commented imports, package policy, contracts, baseline debt, exception expiry, import variants, reuse search, test evidence, and hook allow/deny behavior.

A new feature should add or update a focused test module, then wire it through `test/smoke.mjs`.

## Hook model

Claude hooks are integration adapters, not hidden agents.

Current guidance:

- use `PreToolUse` for blocking dangerous commands or writes outside an active architecture contract
- use `PostToolUseFailure` for Failure Lessons capture
- prefer exec-form hook commands with `command` + `args`
- return structured JSON with `additionalContext` where Claude should receive context
- never approve or publish memory from a hook
- do not pretend a pre-write hook can validate content that does not exist yet

See:

- `docs/hooks/FAILURE_LESSONS_HOOK.md`
- `docs/hooks/CLAUDE_HOOKS_BEST_PRACTICES.md`
- `docs/ARCHITECTURE_GUARDIAN.md`
- `skills/architecture-guardian/templates/claude-hooks.json`

## MCP model

The local MCP server exposes the kernel to agents over stdio. Agents should use MCP to inspect status, search memories, propose memories, inspect pending items, guard commands, and work with episodes where supported.

Approval through MCP remains disabled by default. The safer workflow is:

```text
agent proposes -> user reviews inbox -> user approves -> kernel publishes
```

Architecture Guardian currently uses CLI and hook surfaces. The trusted updater also remains CLI-only. Neither subsystem adds hidden MCP approval, policy mutation, trust expansion, or package installation tools.

## ECC bundle

The repository includes repo-local ECC artifacts for Claude Code and Codex:

```text
.claude/ecc-tools.json
.claude/skills/agent-kernel/SKILL.md
.claude/skills/architecture-guardian/SKILL.md
.claude/commands/*.md
.claude/identity.json
.claude/homunculus/instincts/inherited/agent-kernel-instincts.yaml
.codex/AGENTS.md
.codex/config.toml
.codex/agents/*.toml
.agents/skills/agent-kernel/SKILL.md
.agents/skills/architecture-guardian/SKILL.md
.agents/skills/agent-kernel/agents/openai.yaml
```

Treat these as repo-local workflow scaffolds and generated skills. Keep secrets, personal tokens, and private MCP server credentials in the user-level config, not in this repository.

## Modularization plan

The planned target layout for the core CLI remains:

```text
src/core/paths.mjs
src/core/json.mjs
src/core/memory-store.mjs
src/core/episodes.mjs
src/core/failure-lessons.mjs
src/core/policies.mjs
src/core/compile.mjs
src/core/guard.mjs
src/core/mcp.mjs
src/commands/init.mjs
src/commands/memory.mjs
src/commands/episode.mjs
src/commands/failure.mjs
src/commands/mcp.mjs
src/commands/guard.mjs
src/commands/status.mjs
src/cli.mjs
```

Until that extraction lands, edit the current runtime surface, not the aspirational folders. Focused helper subsystems may remain under `bin/` when they are explicitly routed, packaged, documented, and tested.

## CI

The CI workflow covers:

- build + lint + smoke on Node 18/20/22
- trusted updater end-to-end coverage through smoke
- Architecture Guardian unit and eval coverage through smoke
- TypeScript typecheck
- manifest validation for Skills.sh and Claude marketplace files
- docs sanity checks

Release workflows publish from version tags and create GitHub releases from `CHANGELOG.md` excerpts.
