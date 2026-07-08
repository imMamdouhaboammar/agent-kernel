# Agent Kernel Product Contract

This document defines what `agent-kernel` must stay optimized for.

## Core job

`agent-kernel` should be installable on any developer machine and provide a shared local memory layer for AI coding agents.

The user should not need to repeat the same engineering rules, project facts, preferences, rejected approaches, and workflow instructions every time they switch between Claude Code, Codex, Cursor, Antigravity, OpenCode, Gemini CLI, or another coding agent.

## Non-negotiables

1. **Native CLI first**
   - Installable through npm or npx.
   - Works without a hosted backend.
   - Keeps the runtime light.
   - Does not require a database server.

2. **Local shared memory**
   - The source of truth lives under `AGENT_KERNEL_HOME`.
   - Default home is `~/.agent-kernel`.
   - Memory is JSON-first and inspectable.

3. **Any coding agent can write proposals**
   - Agents should be able to capture new facts through CLI, MCP, hooks, or generated instructions.
   - Agent-written memories should normally enter a proposal inbox.
   - The user approves before global rules are published.

4. **Any coding agent can read the same rules**
   - Generated files must support common agent instruction formats.
   - The same memory source should compile to agent-specific files.

5. **Hooks where the agent supports hooks**
   - Claude Code can use native hook events.
   - Other agents should get the best available integration path: generated files, wrapper commands, MCP, or project-local hook scripts.
   - The product should be honest about which agents have real blocking hooks and which agents are instruction-file based.

6. **Discoverable through agent ecosystems**
   - `SKILL.md` must make the repo easy to discover and install through Skills.sh.
   - Claude marketplace manifests must remain valid.
   - Agents should be able to install, configure, and run the kernel with minimal manual work.

7. **Small commits and small patches**
   - Hardening should land in small reviewable commits.
   - Avoid a full rewrite before safety paths are tested.

## Integration target matrix

| Agent | Read shared memory | Write proposals | Blocking hooks | Current preferred path |
| --- | --- | --- | --- | --- |
| Claude Code | Yes | Yes | Yes | hooks + MCP + `CLAUDE.md` |
| Codex | Yes | Yes | Partial / wrapper-based | `AGENTS.md` + CLI/MCP |
| Cursor | Yes | Yes | Partial / config-based | `.cursor/rules` + CLI/MCP |
| Antigravity | Yes | Yes | Partial / project files | `.agents/` + CLI/MCP |
| OpenCode | Yes | Yes | Partial / `AGENTS.md` | `AGENTS.md` + CLI/MCP |
| Gemini CLI | Yes | Yes | Partial / file-based | `GEMINI.md` + CLI/MCP |
| Other agents | Yes when they read instruction files | Yes when they can call CLI/MCP | Depends on agent | `AGENTS.md`, Skills.sh, CLI |

## What to avoid

- Do not make the kernel depend on a remote SaaS backend.
- Do not make install heavy.
- Do not turn local memory into an opaque binary database before JSON stability is proven.
- Do not claim equal enforcement across all agents until each adapter has tested hook behavior.
- Do not let agent-written rules silently become global approved rules without a user review path.

## Immediate implementation priorities

1. Safe project linking that preserves existing project instructions.
2. Safe git hook injection that preserves existing hooks.
3. A generic agent proposal helper that any coding agent can call.
4. Docs that show each agent the exact install/config path.
5. Tests for installability, package contents, safe linking, and proposal writing.
