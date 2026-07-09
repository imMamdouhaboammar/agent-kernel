# AGENTS.md

Instructions for AI coding agents working on or with the `agent-kernel` repository.

## What this project is

`agent-kernel` is a local-first governance kernel for AI coding agents. It provides:

- shared JSON-first memory for rules, preferences, workflows, project notes, and skill triggers
- an approval inbox so agents can propose durable memory but the user approves it
- episodic memory for searchable session/project history
- Failure Lessons for turning repeated build/test/edit errors into reviewable rules, workflows, policies, or skill triggers
- compiled guidance for Claude Code, Codex, Cursor, OpenCode, Antigravity, Gemini CLI, and other `AGENTS.md`-compatible agents
- Claude hooks, git hooks, MCP tools, and deterministic guardrails
- repo-local ECC scaffolding for Claude Code and Codex

Read `docs/ARCHITECTURE_NOW.md` before editing runtime behavior.

## Source layout

```text
agent-kernel/
├── src/cli.mjs              # Core CLI source — single ESM file
├── dist/cli.mjs             # Built CLI copied from src by scripts/build.mjs
├── bin/                     # Public wrappers and focused helper binaries
├── scripts/                 # Build, lint, version, and consistency checks
├── test/                    # Smoke orchestrator + focused test modules
├── docs/                    # Architecture, protocol, hook, MCP, integration docs
├── examples/                # Sample rules, episodes, hook settings, CI guard workflow
├── development/             # Roadmap and sprint planning
├── .claude/                 # Repo-local ECC artifacts and workflow commands
├── .codex/                  # Repo-local Codex ECC baseline and agent configs
├── .agents/skills/          # Codex-facing generated repo skill
├── .claude-plugin/          # Claude Code marketplace metadata
├── SKILL.md                 # Skills.sh / Claude skill discovery
├── skills.sh.json           # Skills.sh grouping metadata
└── package.json             # npm metadata and scripts
```

## Hard rules

1. Do not add production code to `src/adapters/`, `src/commands/`, `src/core/`, or `src/hooks/` unless you also wire the modularization into the runtime. Those folders are placeholders today.
2. Core runtime commands live in `src/cli.mjs`. Thin helper binaries in `bin/` are acceptable when the behavior is intentionally outside the current single-file runtime.
3. Do not hand-edit `dist/cli.mjs`. Run `npm run build` after changing `src/cli.mjs`.
4. Do not hand-edit generated guidance in `~/.agent-kernel/dist/` or project-local generated files. Edit source memory and publish/sync/link.
5. Do not approve or publish memory from an agent hook. Hooks may capture evidence or create context. Approval is a user action.
6. Do not commit secrets, `.env` files, `node_modules/`, or private MCP credentials.
7. Keep repo-local ECC configs reviewable and credential-free.

## Failure Lessons protocol

When a command, test, edit, or workflow fails in a way that may repeat, capture it before blind retries:

```bash
agent-kernel failure capture \
  --from <agent> \
  --type test-failure \
  --command "npm test" \
  --exit-code 1 \
  --text "<error output>" \
  --root-cause "<why it happened>" \
  --fix "<known fix step>"
```

Before retrying a similar failure:

```bash
agent-kernel failure search "ERR_MODULE_NOT_FOUND"
```

If the lesson is likely to repeat:

```bash
agent-kernel failure propose <failure-lesson-id> --as rule
```

Allowed promotion targets are `rule`, `policy`, `workflow`, `skill`, and `note`. Promotion creates a pending proposal only.

Read `docs/FAILURE_LESSONS_PROTOCOL.md` before changing this workflow.

## Hook protocol

Claude failure capture should use:

- `PostToolUseFailure` for failed tool payloads
- narrow matchers such as `Bash|Write|Edit|MultiEdit`
- exec-form command hooks with `command` + `args`
- short timeouts
- structured JSON output with `hookSpecificOutput.additionalContext`

Do not use broad `PostToolUse` for failure capture unless the target agent lacks a failure-specific lifecycle event.

Read:

- `docs/hooks/FAILURE_LESSONS_HOOK.md`
- `docs/hooks/CLAUDE_HOOKS_BEST_PRACTICES.md`

## MCP protocol

Agents may use MCP to inspect status, search memory, propose memory, list pending proposals, guard commands, and work with episodes where supported.

Approval through MCP is disabled by default. Do not enable it unless the user explicitly asks for a trusted local workflow.

Read `docs/MCP_SERVER.md` before changing MCP behavior.

## Adding a new command

1. Decide whether it belongs in core runtime (`src/cli.mjs`) or as a focused `bin/` helper.
2. Update help output and command routing.
3. Add or update focused tests and wire them through `test/smoke.mjs`.
4. Update `README.md`, `docs/ARCHITECTURE_NOW.md`, and the relevant protocol doc.
5. Run `npm run build && npm test && npm run lint && npm run typecheck`.

## Install and verify

```bash
npm install
npm run build
npm test
npm run lint
npm run typecheck
npm run size
```

## Release checklist

1. Bump `package.json#version`.
2. Bump `.claude-plugin/marketplace.json` and `.claude-plugin/plugin.json` to the same version.
3. Update `CHANGELOG.md`.
4. Run `npm run build && npm test && npm run lint && npm run typecheck && npm run size`.
5. Commit and tag `vX.Y.Z`.
6. Push the tag so release workflows handle npm and GitHub release publishing.

## Discovery files

Keep these aligned with current capabilities:

```text
README.md
SKILL.md
skills.sh.json
.claude-plugin/marketplace.json
.claude-plugin/plugin.json
.claude/skills/agent-kernel/SKILL.md
.agents/skills/agent-kernel/SKILL.md
```

## Documentation rule

When behavior changes, update docs in the same PR. `docs/README.md` explains which doc to update for each kind of change.

## When in doubt

1. Read `docs/README.md`.
2. Read `docs/ARCHITECTURE_NOW.md`.
3. Check `development/BACKLOG.md` before building planned modular work.
