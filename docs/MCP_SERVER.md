# MCP Server

Agent Kernel includes a local stdio MCP server for approved-memory search, compact context, evidence capture, guard checks, and pending proposals.

The server name is:

```text
agent-kernel-memory
```

It reads from `AGENT_KERNEL_HOME` when set, otherwise from:

```text
~/.agent-kernel
```

## Start and inspect

```bash
agent-kernel mcp serve
agent-kernel mcp test
```

A direct JSON-RPC check:

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | agent-kernel mcp serve
```

`agent-kernel mcp test` reports the active mode, approval state, tool count, and tool names.

## Core mode

Core mode is the default. It exposes exactly ten tools:

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

Core mode is intended for normal coding-agent sessions. It supports reading approved memory, requesting bounded context, capturing evidence, creating pending proposals, and checking commands without exposing detailed maintenance operations.

## Extended mode

Enable the broader local tool surface explicitly:

```bash
AGENT_KERNEL_MCP_TOOLS=extended agent-kernel mcp serve
```

Extended mode adds safe local tools such as:

```text
agent_kernel_get_constitution
agent_kernel_read_episode
agent_kernel_capture_episode
agent_kernel_sync_episodes
```

Extended mode is appropriate for trusted local maintenance workflows. It is not required for normal memory search or context retrieval.

## Approval remains separate

The approval tool is omitted from core mode and from normal extended mode.

To expose it, both flags are required:

```bash
AGENT_KERNEL_MCP_TOOLS=extended \
AGENT_KERNEL_MCP_ALLOW_APPROVE=1 \
agent-kernel mcp serve
```

Even in this mode, approval remains an explicit tool call. Agent Kernel does not expose MCP publish or delete tools.

The preferred review path remains:

```bash
agent-kernel inbox
agent-kernel approve <proposal-id> --publish
```

## Failure Lessons in core mode

### `agent_kernel_capture_failure`

Captures or deduplicates redacted local failure evidence. It does not create approved memory.

Example input:

```json
{
  "signature": "ERR_MODULE_NOT_FOUND",
  "text": "Redacted command output",
  "type": "test-failure",
  "command": "npm test",
  "files": ["src/cli.mjs"],
  "rootCause": "Import path was incorrect",
  "fix": ["Correct the import path", "Rerun the focused test"],
  "agentId": "codex",
  "projectId": "agent-kernel"
}
```

The result includes the Failure Lesson ID and the terminal command for creating a pending proposal.

### `agent_kernel_search_failures`

Searches captured Failure Lessons before an agent retries a known error.

Example input:

```json
{
  "query": "ERR_MODULE_NOT_FOUND",
  "projectId": "agent-kernel",
  "files": ["src/cli.mjs"],
  "limit": 10,
  "response_format": "json"
}
```

Failure Lessons are evidence. They become durable guidance only through proposal review and user approval.

## Context tools

### `agent_kernel_get_context`

Use for compact project or task context:

```json
{
  "query": "fix safe-link idempotency",
  "projectId": "agent-kernel",
  "sessionId": "session_123",
  "files": ["src/cli.mjs"],
  "budget": 1200
}
```

### `agent_kernel_get_file_context`

Use before editing one or more files:

```json
{
  "files": ["src/cli.mjs", "test/smoke.mjs"],
  "projectId": "agent-kernel",
  "budget": 1200
}
```

Both tools:

- Enforce a bounded character budget
- Accept file lists and stable project IDs
- Keep approved memory separate from pending evidence
- Exclude rejected proposals
- Return structured sections and compact rendered context

## Intended trust model

```text
agent searches approved memory
  -> agent asks for compact context
  -> agent captures evidence or creates a pending proposal
  -> user reviews
  -> user approves
  -> Agent Kernel publishes
```

MCP does not make generated files the source of truth. Local JSON and approved source memory remain canonical.

## Resources

Typical resources include:

```text
agent-kernel://constitution
agent-kernel://policy
agent-kernel://memories/rules
agent-kernel://episodes/index
agent-kernel://inbox/pending
```

Resources are forwarded independently from the core and extended tool lists.

## Client setup

Use the client-specific guides:

```text
docs/integrations/CLAUDE_CODE_LIVE_CONTEXT.md
docs/integrations/CODEX_LIVE_CONTEXT.md
docs/integrations/CURSOR_LIVE_CONTEXT.md
docs/integrations/OPENCODE_LIVE_CONTEXT.md
```

Typical command shape:

```text
agent-kernel mcp serve
```

The MCP client should start that command as a local stdio process.

## Optional daemon

The HTTP daemon is separate from MCP and is not required:

```bash
agent-kernel daemon start
agent-kernel daemon status
agent-kernel daemon stop
```

## Security rules

- Keep the server local
- Keep credentials out of project MCP configuration
- Treat pending proposals as unapproved
- Never return rejected proposals as context
- Do not enable extended mode unless the client needs it
- Do not enable MCP approval as part of normal setup
- Hooks and agents cannot publish durable memory by default

## Troubleshooting

Inspect the active surface:

```bash
agent-kernel mcp test
```

Inspect extended mode without enabling approval:

```bash
AGENT_KERNEL_MCP_TOOLS=extended agent-kernel mcp test
```

When a client cannot see the server:

1. Run `command -v agent-kernel`.
2. Run `agent-kernel mcp test`.
3. Run the direct JSON-RPC check.
4. Confirm the client command and arguments are `agent-kernel`, `mcp`, `serve`.
5. Restart the client.
6. Run `agent-kernel doctor`.
7. Confirm `AGENT_KERNEL_HOME` points to the intended local store.
