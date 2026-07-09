# Architecture Now

This document describes what the repository actually is today. It is intentionally practical: when the code and roadmap disagree, this file follows the code.

## Current shape

Agent Kernel is a local-first governance kernel for coding agents. The core runtime is still a single-file CLI:

```text
src/cli.mjs  ->  scripts/build.mjs  ->  dist/cli.mjs
```

The npm executable is exposed through `bin/agent-kernel.mjs`, which routes to `dist/cli.mjs` after build. Focused helper binaries live in `bin/` when the behavior is intentionally outside the current single-file runtime.

That means there are two command surfaces today:

| Surface | Location | Purpose |
|---|---|---|
| Core CLI | `src/cli.mjs` / `dist/cli.mjs` | Memory, proposals, compile/sync/link, episodes, guard, MCP, status |
| Helper binaries | `bin/*.mjs` | Safe link/git hook helpers, agent proposal wrapper, mode/write helpers, Failure Lessons capture/hook |

The `src/{adapters,commands,core,hooks}/` folders are still placeholders. They document the future modular layout, but files placed there are not imported by the runtime today.

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
  +--> compiled output:   ~/.agent-kernel/dist/{AGENTS.md,CLAUDE.md,cursor-rule.mdc,...}
  +--> append-only logs:  ~/.agent-kernel/logs/*.jsonl
```

Generated files in `~/.agent-kernel/dist/` are disposable outputs. The source of truth is the JSON under `~/.agent-kernel/source/`, the proposal inbox, and the episode/failure archives.

## What the CLI does

| Area | Commands | Source of truth |
|---|---|---|
| Memory | `remember`, `memory list/search/show`, `validate` | `source/memories/*.json` |
| Approval workflow | `propose`, `inbox`, `approve`, `reject`, `publish` | `inbox/*`, then `source/memories/*` after approval |
| Episodes | `episode add/sync/search/show/stats/reindex` | `episodes/archive/*.json`, `episodes/index.json` |
| Failure Lessons | `failure capture/learn/list/search/show/propose/promote/validate` | `source/failures/failure-lessons.json` |
| Agent output | `compile`, `sync`, `link` | `dist/*`, project-local agent files |
| Enforcement | `guard`, `enforce install`, `git-hook install` | deny patterns, secret patterns, hook configs |
| MCP | `mcp serve/config/install` | stdio MCP server over the local kernel state |
| Diagnostics | `doctor`, `status` | current filesystem and config state |

## Files that matter

| Path | Purpose |
|---|---|
| `src/cli.mjs` | Core single-file CLI source. Edit this for core runtime commands. |
| `dist/cli.mjs` | Built CLI copied from `src/cli.mjs` by `scripts/build.mjs`. Do not hand-edit. |
| `bin/agent-kernel.mjs` | Public wrapper for `agent-kernel` and `ak`. |
| `bin/agent-kernel-failure.mjs` | Failure Lessons CLI helper. |
| `bin/agent-kernel-failure-hook.mjs` | Claude hook adapter for failed tool payloads. |
| `bin/agent-kernel-agent-propose.mjs` | Safe agent proposal wrapper. |
| `scripts/build.mjs` | Version injection and dist copy. |
| `scripts/lint.mjs` | Repository consistency checks and secret-pattern sanity. |
| `scripts/lint-bins.mjs` | Helper binary sanity checks. |
| `scripts/lint-modes.mjs` | Mode/write helper sanity checks. |
| `scripts/check-version.mjs` | Version single-source-of-truth check. |
| `test/smoke.mjs` | Test orchestrator that imports focused test modules. |
| `test/*.mjs` | Focused smoke modules for init, memory, episodes, MCP, safe-link, modes, Failure Lessons, etc. |
| `docs/` | Architecture, memory, MCP, hooks, Failure Lessons, integration docs. |
| `.claude/` | Repo-local ECC artifacts and Claude workflow scaffolds. |
| `.codex/` | Repo-local Codex baseline and role configs. |
| `.agents/skills/` | Codex-facing generated repository skill. |
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

They exist to reserve the future architecture. Do not add production code there unless the modularization work also wires them into `src/cli.mjs`, the build process, and the test suite.

## Testing model

`npm test` runs:

```bash
node scripts/check-version.mjs && node test/smoke.mjs
```

`test/smoke.mjs` is an orchestrator. It imports focused modules such as `test/init.mjs`, `test/memory.mjs`, `test/episode.mjs`, `test/mcp.mjs`, `test/failure-lessons.mjs`, and package-file checks.

A new feature should add or update a focused test module, then wire it through `test/smoke.mjs`.

## Hook model

Claude hooks are integration adapters, not hidden agents.

Current guidance:

- use `PreToolUse` for blocking dangerous commands before execution
- use `PostToolUseFailure` for Failure Lessons capture
- prefer exec-form hook commands with `command` + `args`
- return structured JSON with `additionalContext` where Claude should receive context
- never approve or publish memory from a hook

See:

- `docs/hooks/FAILURE_LESSONS_HOOK.md`
- `docs/hooks/CLAUDE_HOOKS_BEST_PRACTICES.md`

## MCP model

The local MCP server exposes the kernel to agents over stdio. Agents should use MCP to inspect status, search memories, propose memories, inspect pending items, guard commands, and work with episodes where supported.

Approval through MCP remains disabled by default. The safer workflow is:

```text
agent proposes -> user reviews inbox -> user approves -> kernel publishes
```

## ECC bundle

The repository now includes repo-local ECC artifacts for Claude Code and Codex:

```text
.claude/ecc-tools.json
.claude/skills/agent-kernel/SKILL.md
.claude/commands/*.md
.claude/identity.json
.claude/homunculus/instincts/inherited/agent-kernel-instincts.yaml
.codex/AGENTS.md
.codex/config.toml
.codex/agents/*.toml
.agents/skills/agent-kernel/SKILL.md
.agents/skills/agent-kernel/agents/openai.yaml
```

Treat these as repo-local workflow scaffolds and generated skills. Keep secrets, personal tokens, and private MCP server credentials in the user-level config, not in this repository.

## Modularization plan

The planned target layout remains:

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

Until that extraction lands, edit the current runtime surface, not the aspirational folders.

## CI

The CI workflow currently covers:

- build + lint + smoke on Node 18/20/22
- TypeScript typecheck
- manifest validation for Skills.sh and Claude marketplace files
- docs sanity checks

Release workflows publish from version tags and create GitHub releases from `CHANGELOG.md` excerpts.
