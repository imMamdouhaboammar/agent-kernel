# MCP Server

Agent Kernel includes a local stdio MCP server so coding agents can inspect approved memory, request compact context, capture evidence, and create pending proposals without editing generated files directly.

The server name is:

```text
agent-kernel-memory
```

It reads from `AGENT_KERNEL_HOME` when set, otherwise from:

```text
~/.agent-kernel
```

## Start the server

```bash
agent-kernel mcp serve
```

The transport is stdio. The server speaks JSON-RPC through MCP.

## Smoke check

```bash
agent-kernel mcp test
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | agent-kernel mcp serve
```

## Client setup

Use the client-specific guides for exact configuration and rollback:

```text
docs/integrations/CLAUDE_CODE_LIVE_CONTEXT.md
docs/integrations/CODEX_LIVE_CONTEXT.md
docs/integrations/CURSOR_LIVE_CONTEXT.md
docs/integrations/OPENCODE_LIVE_CONTEXT.md
```

### Claude Code

Preferred current CLI setup:

```bash
claude mcp add --transport stdio --scope user agent-kernel-memory -- agent-kernel mcp serve
claude mcp list
```

The repository also retains:

```bash
agent-kernel mcp config claude
agent-kernel mcp install claude
```

Treat the Claude CLI as the preferred setup path when the client's configuration layout has changed. Always verify with `claude mcp list` after installation.

### Codex

```bash
codex mcp add agent-kernel-memory -- agent-kernel mcp serve
codex mcp list
```

### OpenCode

Add a local MCP entry to `opencode.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "agent-kernel-memory": {
      "type": "local",
      "command": ["agent-kernel", "mcp", "serve"],
      "enabled": true
    }
  }
}
```

### Cursor

Add a local stdio entry to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "agent-kernel-memory": {
      "command": "agent-kernel",
      "args": ["mcp", "serve"]
    }
  }
}
```

## Intended trust model

MCP gives agents visibility, evidence capture, guard checks, and proposal ability. It is not meant to silently hand over memory governance.

Default model:

```text
agent reads or searches
  -> agent asks for compact context
  -> agent captures evidence or proposes memory
  -> user reviews
  -> user approves
  -> Agent Kernel publishes
```

Approval through MCP is disabled by default.

To allow MCP approval intentionally:

```bash
AGENT_KERNEL_MCP_ALLOW_APPROVE=1 agent-kernel mcp serve
```

Use this only in a trusted local workflow. It should not be part of normal client setup.

## Tool surface

The exact tool list can evolve with the CLI. Current categories include:

| Category | What agents can do |
|---|---|
| Status | Inspect Agent Kernel health and configured memory home |
| Memory search | Search approved memories and generated constitution context |
| Compact context | Retrieve budgeted project, task, and file context |
| Proposals | Create pending memory proposals and list pending inbox items |
| Guard | Check a command against Agent Kernel guard rules |
| Episodes | Search, read, capture, and sync episodic memory where supported |

Common tool names include:

```text
agent_kernel_get_status
agent_kernel_search_memory
agent_kernel_get_constitution
agent_kernel_get_context
agent_kernel_get_file_context
agent_kernel_propose_memory
agent_kernel_list_pending
agent_kernel_approve_memory
agent_kernel_guard_command
agent_kernel_search_episodes
agent_kernel_read_episode
agent_kernel_capture_episode
agent_kernel_sync_episodes
```

If a client shows fewer tools, restart the client after updating Agent Kernel and verify the server directly with `agent-kernel mcp test`.

## Context tool contract

### `agent_kernel_get_context`

Use for compact project or task context.

Example input:

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

Use before editing one or more files.

Example input:

```json
{
  "files": ["src/cli.mjs", "test/smoke.mjs"],
  "projectId": "agent-kernel",
  "budget": 1200
}
```

Both tools:

- Enforce a bounded character budget
- Accept file lists
- Accept an explicit project ID
- Keep approved memory separate from pending evidence
- Exclude rejected proposals
- Return structured sections and compact rendered context

The project ID prevents one repository's project-scoped memory from appearing in another repository's context. Global approved memory may still appear where relevant.

## Resources

Typical resources include:

```text
agent-kernel://constitution
agent-kernel://policy
agent-kernel://memories/rules
agent-kernel://episodes/index
agent-kernel://inbox/pending
```

Generated files and local JSON remain the source of truth. MCP is an access layer over those files.

## Optional daemon

The local runtime daemon is separate from MCP and is not required for MCP tools:

```bash
agent-kernel daemon start
agent-kernel daemon status
agent-kernel daemon stop
```

Use the daemon only when a wrapper or custom integration needs local HTTP observation and context endpoints.

## Recommended agent behavior

When the user gives a durable instruction such as `remember this` or asks all agents to keep a rule, the agent should create a pending proposal.

Do not edit these files directly:

```text
~/.agent-kernel/dist/AGENTS.md
~/.agent-kernel/dist/CLAUDE.md
~/.agent-kernel/source/memories/*.json
~/.agent-kernel/source/policies/*.json
```

The safe path is:

```bash
agent-kernel propose --from <agent> --type rule --text "..." --reason "..."
agent-kernel inbox
agent-kernel approve <proposal-id> --publish
```

## Failure Lessons through MCP

Failure Lessons remain evidence-first. CLI and hook capture are currently the primary paths:

```bash
agent-kernel failure capture ...
agent-kernel failure search "ERR_MODULE_NOT_FOUND"
agent-kernel failure propose <id> --as rule
```

An agent may capture a failure or propose a lesson. A Failure Lesson becomes durable memory only after proposal review and approval.

## Security rules

- Keep the server local
- Do not place secrets in project MCP configuration
- Pass secrets through the client environment only when a separate MCP server requires them
- Agent Kernel itself does not require network credentials for local memory access
- Rejected proposals must never appear in context output
- Pending evidence must be labeled as unapproved
- Hooks and MCP clients do not gain approval authority by default

## Troubleshooting

If the MCP client does not see the server:

1. Run `command -v agent-kernel`.
2. Run `agent-kernel mcp test`.
3. Run the JSON-RPC smoke check in this document.
4. Confirm the client command is `agent-kernel` with arguments `mcp`, `serve`.
5. Restart the MCP client.
6. Run `agent-kernel doctor` to confirm the memory home and generated files.
7. Check that `AGENT_KERNEL_HOME` is the intended directory when using a custom local store.

If context is empty:

```bash
agent-kernel context --query "current task" --budget 1200 --json
agent-kernel file-context src/cli.mjs --budget 1200 --json
```

Empty output can be valid when no approved memory or pending evidence matches the request.
