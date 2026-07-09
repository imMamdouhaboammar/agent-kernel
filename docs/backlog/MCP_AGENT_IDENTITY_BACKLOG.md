# MCP and Agent Identity Backlog

## Goal

Improve Agent Kernel's MCP and multi-agent behavior without copying a large memory platform tool surface.

Agent Kernel should expose a small, useful MCP interface by default. Advanced tools should be opt-in. Every agent action should respect the review-first safety model.

## Product constraints

1. Default MCP surface stays small
2. Approval through MCP remains disabled by default
3. Agent identity is local and inspectable
4. Unknown agents get conservative permissions
5. Agents can propose, search, observe, and ask for context
6. Agents cannot publish durable memory by default
7. Tool descriptions must guide agents toward safe behavior
8. MCP should work with static generated files and optional live runtime

---

# AK-AGENT-001: Agent identity model

## User story

As a user working with Claude, Codex, Cursor, Gemini, and OpenCode, I want Agent Kernel to know which agent created each observation or proposal.

## Agent record

```json
{
  "agentId": "claude-code",
  "displayName": "Claude Code",
  "surface": "cli",
  "trustLevel": "propose-only",
  "allowedActions": [
    "search",
    "context",
    "observe",
    "propose",
    "guard"
  ],
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp"
}
```

## Trust levels

| Trust level | Meaning |
|---|---|
| `read-only` | Can search/read approved context only |
| `capture-only` | Can capture observations and failures, but cannot create proposals |
| `propose-only` | Can search, capture, and create proposals |
| `trusted-local` | Can use expanded local tools, but still cannot approve by default |

## Acceptance criteria

1. Observations include `agentId`
2. Proposals include `createdBy`
3. Sessions include `agentId`
4. Search can filter by agent
5. Trust level does not grant approval by default
6. Unknown agents default to `read-only` or `capture-only`, based on action type

---

# AK-AGENT-002: Agent registry commands

## User story

As a user, I want to configure agent permissions once, so Agent Kernel can safely expose different capabilities to different tools.

## Commands

```bash
agent-kernel agent list
agent-kernel agent add claude-code --trust propose-only
agent-kernel agent add cursor --trust read-only
agent-kernel agent set codex --trust capture-only
agent-kernel agent show claude-code
agent-kernel agent remove experimental-agent
```

## Storage

```text
~/.agent-kernel/source/agents/agents.json
```

## Acceptance criteria

1. Registry is stored locally
2. Defaults are conservative
3. Unknown agents get the lowest safe trust level
4. MCP tools respect trust level
5. Runtime endpoints respect trust level when auth is enabled
6. Removing an agent does not delete historical observations

---

# AK-AGENT-003: Project identity

## User story

As a user with multiple repositories, I want Agent Kernel to scope memory by project, so one repo's lessons do not pollute another repo's context.

## Project fields

```json
{
  "projectId": "agent-kernel",
  "root": "/path/to/repo",
  "name": "Agent Kernel",
  "repoRemote": "git@github.com:imMamdouhaboammar/agent-kernel.git",
  "createdAt": "ISO timestamp"
}
```

## Commands

```bash
agent-kernel project identify .
agent-kernel project list
agent-kernel project show agent-kernel
agent-kernel project set-id . agent-kernel
```

## Acceptance criteria

1. Project ID is stable across sessions
2. Project ID does not depend only on absolute path
3. Runtime context accepts explicit `projectId`
4. Search can filter by project
5. Generated files stay repo-local and credential-free

---

# AK-MCP-001: Split MCP tools into core and extended

## User story

As an MCP client, I want a small default tool list, so agents do not get overwhelmed by too many tools.

## Core tools

```text
agent_kernel_get_status
agent_kernel_search_memory
agent_kernel_get_context
agent_kernel_get_file_context
agent_kernel_propose_memory
agent_kernel_list_pending
agent_kernel_guard_command
agent_kernel_capture_failure
agent_kernel_search_failures
agent_kernel_search_episodes
```

## Extended tools

Enabled only with:

```bash
AGENT_KERNEL_MCP_TOOLS=extended agent-kernel mcp serve
```

Extended tools may include:

```text
agent_kernel_read_session
agent_kernel_session_timeline
agent_kernel_link_commit
agent_kernel_commit_context
agent_kernel_detect_patterns
agent_kernel_create_episode
agent_kernel_observe
```

## Disabled by default

```text
agent_kernel_approve_memory
agent_kernel_publish_memory
agent_kernel_delete_memory
```

Approval can remain behind the existing explicit env flag, but should not be part of normal agent setup.

## Acceptance criteria

1. Default MCP list stays small
2. Extended mode is opt-in
3. Approval tool remains disabled unless explicitly enabled
4. Tool descriptions tell agents when to use each tool
5. MCP docs include examples for Claude, Cursor, Codex, Gemini, and OpenCode
6. Tests verify tool counts in default and extended modes

---

# AK-MCP-002: Add MCP context tools

## User story

As an AI coding agent, I want to request compact context through MCP, so I can retrieve local knowledge without shelling out.

## Tools

```text
agent_kernel_get_context
agent_kernel_get_file_context
```

## `agent_kernel_get_context` input

```json
{
  "query": "fix safe-link idempotency",
  "projectId": "agent-kernel",
  "sessionId": "session_...",
  "files": ["src/cli.mjs"],
  "budget": 1200
}
```

## `agent_kernel_get_file_context` input

```json
{
  "files": ["src/cli.mjs", "test/smoke.mjs"],
  "projectId": "agent-kernel",
  "budget": 1200
}
```

## Acceptance criteria

1. Tools support budget
2. Tools support file lists
3. Tools support project ID
4. Tools do not expose rejected proposals
5. Output separates approved memory from pending evidence
6. Tool output is compact enough for coding agents

---

# AK-MCP-003: MCP failure tools

## User story

As an agent, I want to capture and search Failure Lessons through MCP, so repeated errors can be turned into reviewable evidence.

## Tools

```text
agent_kernel_capture_failure
agent_kernel_search_failures
agent_kernel_propose_failure_lesson
```

## Important rule

`agent_kernel_propose_failure_lesson` creates a pending proposal only. It does not approve or publish.

## Acceptance criteria

1. Failure capture validates command, error text, root cause, and fix fields
2. Search can filter by file, command, and error text
3. Propose creates pending inbox entry
4. MCP cannot promote a failure directly into approved memory
5. Docs explain the evidence-first workflow

---

# AK-MCP-004: MCP guard behavior

## User story

As an agent, I want to check risky commands before running them, so I can avoid destructive operations.

## Tool

```text
agent_kernel_guard_command
```

## Input

```json
{
  "command": "rm -rf node_modules",
  "cwd": "/path/to/repo",
  "projectId": "agent-kernel"
}
```

## Output

```json
{
  "allowed": false,
  "severity": "critical",
  "reason": "Destructive recursive removal pattern",
  "recommendation": "Ask the user before running this command."
}
```

## Acceptance criteria

1. Guard tool does not execute commands
2. Guard tool returns clear allow or deny decision
3. Guard tool includes reason and recommended next step
4. Critical denials are short and unambiguous
5. Tests cover dangerous shell patterns and safe commands

---

# AK-INTEGRATION-001: Claude Code integration guide

## User story

As a Claude Code user, I want a clear local setup path for Agent Kernel memory, hooks, and MCP.

## Doc path

```text
docs/integrations/CLAUDE_CODE_LIVE_CONTEXT.md
```

## Must include

1. Static file setup through compile/link
2. MCP setup
3. Optional live runtime setup
4. Hook setup for context and Failure Lessons
5. Approval boundary
6. Troubleshooting

## Acceptance criteria

1. Uses exact commands
2. Explains that daemon is optional
3. Explains that hooks cannot approve memory
4. Includes rollback steps
5. Links to MCP and hook docs

---

# AK-INTEGRATION-002: OpenCode integration guide

## User story

As an OpenCode user, I want to connect Agent Kernel through MCP and optional live context, so I can get fresh local context without depending only on AGENTS.md.

## Doc path

```text
docs/integrations/OPENCODE_LIVE_CONTEXT.md
```

## Must include

1. Static AGENTS.md fallback
2. MCP config shape
3. Optional runtime observe calls
4. Optional context injection pattern
5. Tradeoff between static files and live context

## Acceptance criteria

1. Documentation-only in first pass
2. No hard dependency on OpenCode plugin SDK
3. Local-only setup is clear
4. No secrets in repo-local config
5. Includes troubleshooting

---

# AK-INTEGRATION-003: Codex and Cursor integration guide updates

## User story

As a Codex or Cursor user, I want a clear setup path that explains what Agent Kernel can and cannot do through generated files, MCP, and optional runtime context.

## Docs to update or add

```text
docs/integrations/CODEX_LIVE_CONTEXT.md
docs/integrations/CURSOR_LIVE_CONTEXT.md
```

## Must include

1. Generated file fallback
2. MCP server config
3. Optional runtime mode
4. Agent trust level recommendations
5. Known limitations

## Acceptance criteria

1. Docs avoid promising unsupported hooks
2. Docs separate static and live context clearly
3. Docs include uninstall or rollback steps
4. Docs preserve local-first positioning

---

# Implementation note

Do not expand MCP by adding every possible operation. Agent Kernel should expose fewer, safer tools with better descriptions. The purpose is to help agents ask for the right local context, not to give them full control over the memory system.
