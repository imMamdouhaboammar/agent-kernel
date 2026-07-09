# Agent Kernel Backlog Index

This backlog translates the strongest ideas from `rohitg00/agentmemory` into an Agent Kernel roadmap while protecting the core product principle: Agent Kernel stays local-first, lightweight, review-first, and dependency-light.

Agent Kernel should not become a hosted memory platform, a required daemon, a database service, or an autonomous approval system. The backlog below adds optional live context where it helps agents work better, while keeping durable memory under user control.

## Current implementation status

The first runtime slice has started:

- `agent-kernel-daemon` helper binary exists
- `agent-kernel daemon start|stop|status` is routed through the public wrapper
- the daemon is optional and local-only by default
- first endpoints exist for health, status, observation capture, context, and sessions
- a public CLI smoke test covers the daemon route and local evidence capture

## Product principle

Agent Kernel must remain:

1. Local-first
2. Lightweight by default
3. Review-first for durable memory
4. Agent-agnostic
5. Useful without a background daemon
6. Useful without embeddings, vector databases, or cloud services
7. Safe for existing repositories

## Backlog files

| File | Purpose |
|---|---|
| `LIVE_CONTEXT_RUNTIME_BACKLOG.md` | Optional local runtime, health checks, context endpoint, and live capture rules |
| `SESSION_AND_FILE_CONTEXT_BACKLOG.md` | Session capture, observation timeline, file-aware context, and commit links |
| `MCP_AGENT_IDENTITY_BACKLOG.md` | Small MCP tool surface, agent identity, trust levels, and integration rules |
| `SEARCH_RETENTION_REPORTING_BACKLOG.md` | Local search scoring, retention, export/import, terminal viewer, and static reports |
| `IMPLEMENTATION_ORDER.md` | Practical build order, MVP scope, and what to avoid |

## Architectural stance

Current Agent Kernel flow:

```text
source JSON
  -> compile
  -> generated AGENTS.md, CLAUDE.md, Cursor rules, Codex files, Gemini files
  -> agents start with stable guidance
```

Target direction:

```text
source JSON + approved memory + episodes + Failure Lessons
  -> static generated agent guidance
  -> optional live local context
  -> safer agent behavior during real work
```

The static layer remains first-class. The live layer is optional.

## Default safety boundary

Agents may:

1. Search approved memory
2. Read generated constitution context
3. Capture observations
4. Capture Failure Lesson evidence
5. Create proposals
6. Ask for file-specific context
7. Ask for guard checks

Agents may not, by default:

1. Approve memory
2. Publish memory
3. Delete approved memory
4. Mutate source memory directly
5. Store secrets
6. Enable remote access
7. Turn observations into durable memory without user approval

## Recommended labels for GitHub issues

| Label | Use |
|---|---|
| `backlog` | Planned work that is not yet in active development |
| `local-first` | Work that must preserve local-only behavior |
| `runtime` | Optional daemon, live context, or local server work |
| `memory` | Approved memory, proposals, episodes, or Failure Lessons |
| `mcp` | MCP server tools and integration work |
| `agent-integrations` | Claude, Codex, Cursor, Gemini, OpenCode, and related setup |
| `safety` | Approval boundaries, guardrails, secrets, or trust levels |
| `docs` | Documentation-only work |

## Decision rule

Any new feature should answer yes to all of these:

1. Does it still work offline?
2. Can users ignore it and keep using the CLI normally?
3. Does it avoid required external infrastructure?
4. Does it keep durable memory approval under user control?
5. Does it add clear value to repeated agent work?

If the answer is no, the feature belongs outside the default kernel path.
