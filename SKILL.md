---
name: agent-kernel
description: |
  Local-first governance kernel for AI coding agents. Gives Claude Code, Codex, Cursor,
  Antigravity, Gemini CLI, OpenCode, and AGENTS.md-compatible agents shared memory,
  approval inbox, generated guidance, Claude + git hooks, MCP tools, deterministic guard,
  episodic memory, and Failure Lessons for turning repeated build/test/edit errors into
  reviewable rules, workflows, policies, or skill triggers. Use when the user asks to remember
  a rule, save a workflow, search past episodes, capture a coding failure, learn from an error,
  propose a new rule, inspect the repo docs, or make agents follow standards automatically.
  Triggers on: agent kernel, ak, remember this, save this rule, memory tool, episodic memory,
  failure lesson, error-to-skill, approval inbox, guard policy, rule inbox, agent hooks.
---

# agent-kernel: local-first governance + memory layer

One CLI for shared agent memory, approval workflow, episodic recall, Failure Lessons, MCP tools, hooks, deterministic guardrails, and repo-local agent scaffolds.

## What this skill is

A Node.js CLI (`agent-kernel` / `ak`) that gives coding agents:

1. Shared local memory at `~/.agent-kernel/source/memories/*.json`
2. Episodic memory archive at `~/.agent-kernel/episodes/`
3. Failure Lessons at `~/.agent-kernel/source/failures/failure-lessons.json`
4. Approval inbox so agents can propose memory but only the user/kernel approval path publishes it
5. Generated instruction files for Claude Code, Codex, Cursor, OpenCode, Antigravity, and Gemini CLI
6. Claude hooks using `PreToolUse` for guard behavior and `PostToolUseFailure` for failure capture
7. MCP tools for status, memory, proposals, guard checks, and episodes
8. Deterministic policy guard blocking dangerous commands and common secret leaks
9. Repo-local ECC scaffolding for Claude Code and Codex under `.claude/`, `.codex/`, and `.agents/skills/`

## Why this exists

You should not have to repeat the same standards, fixes, and debugging lessons to every coding agent in every session.

| Without agent-kernel | With agent-kernel |
|---|---|
| Standards repeated in every prompt | Standards live in `~/.agent-kernel/source/memories/*.json` and auto-attach |
| Lost context after session end | Episodes are stored locally and searchable later |
| Same coding failure solved repeatedly | Failure Lessons dedupe the error and preserve the known fix path |
| Agents silently invent rules | Proposal inbox; user approves before publish |
| Hooks become hidden agents | Hooks stay narrow, auditable lifecycle adapters |
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

agent-kernel episode search "SQLite fallback Supabase"
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
agent-kernel mcp serve|config|install
agent-kernel start <claude|codex|cursor|antigravity|gemini> [project]
agent-kernel status
```

## Failure Lessons behavior

Failure capture deduplicates by `project + command + errorSignature` by default. Repeated captures increment `occurrences` and update `lastSeenAt` instead of creating duplicate records.

Promotion is intentionally review-first:

```bash
agent-kernel failure propose <failure-lesson-id> --as rule
agent-kernel inbox
agent-kernel approve <proposal-id> --publish
```

Agents may capture and propose. They must not silently approve or publish.

## Hook behavior

Claude failure capture should use `PostToolUseFailure`, narrow matchers, exec-form command hooks with `args`, short timeouts, and structured JSON output with `additionalContext`.

See:

- [docs/hooks/FAILURE_LESSONS_HOOK.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/hooks/FAILURE_LESSONS_HOOK.md)
- [docs/hooks/CLAUDE_HOOKS_BEST_PRACTICES.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/hooks/CLAUDE_HOOKS_BEST_PRACTICES.md)

## Memory layout

```text
~/.agent-kernel/
  source/
    memories/
    failures/
    policies/
    schemas/
  episodes/
  inbox/
  dist/
  logs/
```

## Compatibility

| Agent | Memory source | Hook install | Compile target |
|---|---|---|---|
| Claude Code | yes | yes `~/.claude/hooks/` | `PreToolUse` + `PostToolUseFailure` |
| Codex | yes | n/a | `AGENTS.md`, `.codex/AGENTS.md` |
| Cursor | yes | n/a | `.cursor/rules/*.mdc` |
| OpenCode | yes | n/a | `AGENTS.md` |
| Antigravity | yes | n/a | `.agents/` |
| Gemini CLI | yes | n/a | `GEMINI.md` |
| 60+ others | yes via Skills.sh index | depends on agent | `AGENTS.md` |

## Safety model

- Agents may propose memories. Only agent-kernel publishes approved memories.
- Failure Lessons capture locally first. Promotion creates a pending proposal.
- Generated markdown files are disposable outputs, not the source of truth.
- Hooks are lifecycle adapters, not hidden agents.
- Critical rules should also be backed by permissions, hooks, guard checks, or CI.

## Documentation

Start with:

- [docs/README.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/README.md)
- [docs/ARCHITECTURE_NOW.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/ARCHITECTURE_NOW.md)
- [docs/MEMORY_PROTOCOL.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/MEMORY_PROTOCOL.md)
- [docs/FAILURE_LESSONS_PROTOCOL.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/FAILURE_LESSONS_PROTOCOL.md)
- [docs/MCP_SERVER.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/MCP_SERVER.md)
- [docs/INTEGRATIONS.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/INTEGRATIONS.md)

## Discovery

- Skills.sh: `npx skills add imMamdouhaboammar/agent-kernel -a claude-code -g -y`
- Claude Code marketplace: `.claude-plugin/marketplace.json` + `.claude-plugin/plugin.json`
- npm: `npm install -g @mamdouh-aboammar/agent-kernel`

## License

MIT © Mamdouh Aboammar

## Repository

https://github.com/imMamdouhaboammar/agent-kernel
