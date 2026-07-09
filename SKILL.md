---
name: agent-kernel
description: |
  Local-first governance kernel for AI coding agents. Gives Claude Code, Codex, Cursor,
  Antigravity, and Gemini CLI shared memory, approval inbox, generated AGENTS.md / CLAUDE.md /
  cursor-rule.mdc guidance, Claude + git hooks, a deterministic policy guard, episodic memory,
  and Failure Lessons for turning repeated build/test/edit errors into reviewable rules,
  workflows, policies, or skill triggers. Use when the user asks to remember a rule, save a
  workflow, search past episodes, capture a coding failure, learn from an error, propose a new
  rule, or make agents follow standards automatically. Triggers on: agent kernel, ak, remember
  this, save this rule, memory tool, episodic memory, failure lesson, error-to-skill, approval
  inbox, guard policy, rule inbox.
---

# agent-kernel: local-first governance + memory layer

One CLI for shared agent memory, approval workflow, episodic recall, Failure Lessons, MCP tools, hooks, and deterministic guardrails.

## What this skill IS

A single Node.js CLI (`agent-kernel` / `ak`) that gives every coding agent you use:

1. Shared local memory at `~/.agent-kernel/source/memories/*.json`
2. Episodic memory archive at `~/.agent-kernel/episodes/` with search/show/stats
3. Failure Lessons at `~/.agent-kernel/source/failures/failure-lessons.json`
4. Approval inbox so agents can propose rules but only the kernel publishes them
5. Generated instruction files for every agent:
   - `AGENTS.md` for Claude Code / Codex / Cursor / OpenCode
   - `CLAUDE.md`
   - `.cursor/rules/00-agent-kernel.mdc`
   - `.agents/agents.md`
   - `GEMINI.md`
6. Hooks: Claude `PreToolUse` + `PostToolUseFailure`, git `pre-commit`, optional CI guard
7. MCP tools for memory, episodes, approval, and guard operations
8. Deterministic policy guard blocking dangerous shell commands and secret leaks

## Why this exists

You should not have to repeat the same standards, fixes, and debugging lessons to every coding agent in every session.

| Without agent-kernel | With agent-kernel |
|---|---|
| Standards repeated in every prompt | Standards live in `~/.agent-kernel/source/memories/*.json` and auto-attach |
| Lost context after session end | Episodes saved locally; searchable later |
| Same coding failure solved repeatedly | Failure Lessons dedupe the error and preserve the known fix path |
| Agent writes whatever rule it wants | Proposal inbox; user approves before publish |
| Manual `git commit` may leak secrets | Pre-commit hook + `agent-kernel guard --staged` blocks |
| Different agents see different rules | One JSON-first source compiles to all platforms |

## Quick start

```bash
npm install -g @mamdouh-aboammar/agent-kernel
npx -y @mamdouh-aboammar/agent-kernel --version

cd ~/Projects/YourProject
agent-kernel init --sync --enforce
agent-kernel link . --hooks

agent-kernel remember "Never add local SQLite fallback to production Supabase apps." \
    --type policy --level critical --tags supabase,database --publish

agent-kernel episode search "SQLite fallback Supabase"
agent-kernel episode show <episode-id>

agent-kernel failure capture \
  --from claude \
  --type test-failure \
  --command "npm test" \
  --exit-code 1 \
  --text "ERR_MODULE_NOT_FOUND ..." \
  --root-cause "Node ESM import path missed its explicit extension." \
  --fix "Add the explicit .js extension to the relative import."

agent-kernel failure search "ERR_MODULE_NOT_FOUND"
agent-kernel failure propose <failure-lesson-id> --as rule

agent-kernel doctor
agent-kernel status
```

## Core commands

```text
agent-kernel init [--sync] [--enforce]
agent-kernel doctor
agent-kernel compile
agent-kernel sync
agent-kernel link [project] [--hooks]
agent-kernel remember "rule text" [--type rule] [--level critical] [--publish]
agent-kernel propose --from claude --text "rule text" --reason "..."
agent-kernel inbox
agent-kernel approve <id> [--publish]
agent-kernel reject <id>
agent-kernel publish
agent-kernel validate
agent-kernel migrate json [--publish]
agent-kernel memory list|search|show
agent-kernel episode add|sync|search|show|stats|reindex
agent-kernel failure capture|learn|list|search|show|propose|promote|validate
agent-kernel enforce install
agent-kernel guard [--staged|--file path]
agent-kernel git-hook install [project]
agent-kernel start <claude|codex|cursor|antigravity|gemini> [project]
agent-kernel status
```

## Failure Lessons behavior

Failure capture deduplicates by `project + command + errorSignature` by default. Repeated captures increment `occurrences` and update `lastSeenAt` instead of creating noisy duplicate records.

Promotion is intentionally review-first:

```bash
agent-kernel failure propose <failure-lesson-id> --as rule
agent-kernel inbox
agent-kernel approve <proposal-id> --publish
```

Agents may capture and propose. They must not silently approve or publish.

## Hook behavior

Claude failure capture should use `PostToolUseFailure`, narrow matchers, exec form with `args`, short timeouts, and structured JSON output with `additionalContext`.

See:

- [docs/hooks/FAILURE_LESSONS_HOOK.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/hooks/FAILURE_LESSONS_HOOK.md)
- [docs/hooks/CLAUDE_HOOKS_BEST_PRACTICES.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/hooks/CLAUDE_HOOKS_BEST_PRACTICES.md)

## Memory layout

```text
~/.agent-kernel/
  config.json
  source/
    memories/
      rules.json
      preferences.json
      workflows.json
      project-notes.json
      skills.json
    failures/
      failure-lessons.json
    schemas/
    policies/policies.json
  episodes/
    archive/
    index.json
    sources.json
  inbox/
    pending/
    approved/
    rejected/
  dist/
    AGENTS.md
    CLAUDE.md
    cursor-rule.mdc
    antigravity-agents.md
    GEMINI.md
    SKILLS.md
    policy.json
  logs/
    compile.jsonl
    sync.jsonl
    proposals.jsonl
    approvals.jsonl
    episodes.jsonl
    failures.jsonl
```

## Compatibility

| Agent | Memory source | Hook install | Compile target |
|---|---|---|---|
| Claude Code | yes | yes `~/.claude/hooks/` | `PreToolUse` + `PostToolUseFailure` |
| Codex | yes | n/a | `AGENTS.md` |
| Cursor | yes | n/a | `.mdc` rule |
| OpenCode | yes | n/a | `AGENTS.md` |
| Antigravity | yes | n/a | `.agents/` |
| Gemini CLI | yes | n/a | `GEMINI.md` |
| 60+ others | yes via Skills.sh index | depends on agent | via `AGENTS.md` |

## Safety model

- Agents may propose memories. Only agent-kernel publishes memories.
- Failure Lessons capture locally first. Promotion creates a pending proposal.
- Generated markdown files are not the only defense. Critical rules should also be backed by hooks, scanners, git hooks, or CI checks.

## Install paths

| Path | When |
|---|---|
| `npm install -g @mamdouh-aboammar/agent-kernel` | Preferred, latest published package |
| `npx -y @mamdouh-aboammar/agent-kernel <cmd>` | One-off use, no install |
| Bundled inside `delegate-team` | Already shipped with delegate-team v2.5.0+ |

## Documentation

- [README](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/README.md)
- [AGENTS.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/AGENTS.md)
- [CHANGELOG](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/CHANGELOG.md)
- [docs/ARCHITECTURE_NOW.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/ARCHITECTURE_NOW.md)
- [docs/MEMORY_PROTOCOL.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/MEMORY_PROTOCOL.md)
- [docs/EPISODIC_MEMORY.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/EPISODIC_MEMORY.md)
- [docs/FAILURE_LESSONS_PROTOCOL.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/FAILURE_LESSONS_PROTOCOL.md)
- [docs/hooks/FAILURE_LESSONS_HOOK.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/hooks/FAILURE_LESSONS_HOOK.md)
- [docs/hooks/CLAUDE_HOOKS_BEST_PRACTICES.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/hooks/CLAUDE_HOOKS_BEST_PRACTICES.md)
- [docs/MCP_SERVER.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/MCP_SERVER.md)
- [docs/STRICT_MODE.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/STRICT_MODE.md)
- [docs/JSON_FIRST_STORAGE.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/JSON_FIRST_STORAGE.md)
- [docs/INTEGRATIONS.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/INTEGRATIONS.md)
- [development/BACKLOG.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/development/BACKLOG.md)
- [development/SPRINT-PLAN.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/development/SPRINT-PLAN.md)

## Discovery

- Skills.sh: `npx skills add imMamdouhaboammar/agent-kernel -a claude-code -g -y`
- Claude Code marketplace: `.claude-plugin/marketplace.json` + `.claude-plugin/plugin.json`
- npm: `npm install -g @mamdouh-aboammar/agent-kernel`

## License

MIT (© Mamdouh Aboammar)

## Repository

https://github.com/imMamdouhaboammar/agent-kernel
