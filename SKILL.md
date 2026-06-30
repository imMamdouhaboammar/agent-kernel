---
name: agent-kernel
description: |
  Local-first governance kernel for AI coding agents — gives Claude Code, Codex, Cursor,
  Antigravity, and Gemini CLI a shared memory, an approval inbox for new rules, generated
  AGENTS.md / CLAUDE.md / cursor-rule.mdc, Claude + git hooks, and a deterministic
  policy guard. Adds a JSON-first memory layer (rules + preferences + workflows + project-notes
  + skills), an episodic memory archive, and MCP tools for search/read/capture/sync of past
  sessions. Use when the user asks to "remember this rule", "save this as a memory",
  "what did we do last time", "search past episodes", "propose a new rule", "make agent
  follow our standards automatically", or any request to give an agent persistent local
  memory across sessions. Triggers on: "agent kernel", "ak", "remember this", "save this rule",
  "memory tool", "episodic memory", "approval inbox", "guard policy", "rule inbox".
---

# agent-kernel — local-first governance + memory layer

> **One CLI. Every agent. Persistent memory.** Local-first JSON memory, approval inbox for
> rules, episodic recall across sessions, MCP tools, hooks, deterministic guard.

## What this skill IS

A single Node.js CLI (`agent-kernel` / `ak`) that gives every coding agent you use:

1. **Shared local memory** at `~/.agent-kernel/source/memories/*.json`
2. **Episodic memory archive** at `~/.agent-kernel/episodes/` (with search/show/stats)
3. **Approval inbox** so agents can propose rules but only the kernel publishes them
4. **Generated instruction files** for every agent:
   - `AGENTS.md` (Claude Code / Codex / Cursor / OpenCode)
   - `CLAUDE.md`
   - `.cursor/rules/00-agent-kernel.mdc`
   - `.agents/agents.md`
   - `GEMINI.md`
5. **Hooks** — Claude `PreToolUse` + `PostToolUse`, git `pre-commit`, optional CI guard
6. **MCP tools** — `agent_kernel_search_episodes`, `agent_kernel_read_episode`,
   `agent_kernel_capture_episode`, `agent_kernel_sync_episodes`
7. **A deterministic policy guard** — blocks dangerous `rm -rf`, curl|sh, force-push to main,
   secret leaks, and any rule you add

## Why this exists

You should not have to repeat the same standards to every coding agent in every session.
agent-kernel solves that with local-first memory + cross-agent rule distribution.

| Without agent-kernel | With agent-kernel |
|---|---|
| Standards repeated in every prompt | Standards live in `~/.agent-kernel/source/memories/*.json` and auto-attach |
| Lost context after session end | Episodes saved locally; searchable later |
| Agent writes whatever rule it wants | Proposal inbox; you approve before publish |
| Manual `git commit` may leak secrets | Pre-commit hook + `agent-kernel guard --staged` blocks |
| Different agents see different rules | One JSON-first source compiles to all platforms |

## Quick start

```bash
# Install
npm install -g @mamdouh/agent-kernel
# or use npx without installing
npx -y @mamdouh/agent-kernel --version

# In any project, initialize
cd ~/Projects/YourProject
agent-kernel init --sync --enforce
agent-kernel link . --hooks

# Save a rule
agent-kernel remember "Never add local SQLite fallback to production Supabase apps." \
    --type policy --level critical --tags supabase,database --publish

# Search past episodes
agent-kernel episode search "SQLite fallback Supabase"
agent-kernel episode show <episode-id>

# Health check
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
agent-kernel enforce install
agent-kernel guard [--staged|--file path]
agent-kernel git-hook install [project]
agent-kernel start <claude|codex|cursor|antigravity|gemini> [project]
agent-kernel status
```

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
```

## Compatibility

| Agent | Memory source | Hook install | Compile target |
|---|---|---|---|
| Claude Code | ✅ | ✅ `~/.claude/hooks/` | `PreToolUse` + `PostToolUse` |
| Codex | ✅ | n/a | `AGENTS.md` |
| Cursor | ✅ | n/a | `.mdc` rule |
| OpenCode | ✅ | n/a | `AGENTS.md` |
| Antigravity | ✅ | n/a | `.agents/` |
| Gemini CLI | ✅ | n/a | `GEMINI.md` |
| 60+ others | ✅ via Skills.sh index | depends on agent | via `AGENTS.md` |

Memory layout is **fully backward compatible with v0.0.1** — auto-migrates flat files
via `agent-kernel migrate json --publish`.

## Safety model

- Agents may propose memories. Only agent-kernel publishes memories.
- Generated markdown files are not the only defense. Critical rules should also be backed by
  hooks, scanners, git hooks, or CI checks.

## Install paths

| Path | When |
|---|---|
| `npm install -g @mamdouh/agent-kernel` | Preferred — always the latest |
| `npx -y @mamdouh/agent-kernel <cmd>` | One-off use, no install |
| Bundled inside `delegate-team` | Already shipped with delegate-team v2.5.0+ |

## Documentation

- [README](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/README.md)
- [docs/ARCHITECTURE.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/ARCHITECTURE.md)
- [docs/MEMORY_PROTOCOL.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/MEMORY_PROTOCOL.md)
- [docs/EPISODIC_MEMORY.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/EPISODIC_MEMORY.md)
- [docs/MCP_SERVER.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/MCP_SERVER.md)
- [docs/STRICT_MODE.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/STRICT_MODE.md)
- [docs/JSON_FIRST_STORAGE.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/JSON_FIRST_STORAGE.md)
- [develpment/BACKLOG.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/develpment/BACKLOG.md) — roadmap
- [develpment/SPRINT-PLAN.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/develpment/SPRINT-PLAN.md) — current sprint

## License

MIT (© Mamdouh Aboammar)

## Repository

https://github.com/imMamdouhaboammar/agent-kernel