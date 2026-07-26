# MCP Server

Agent Kernel ships a local stdio MCP server for approved-memory search, bounded context, failure evidence, episode search, command guards, and pending proposals.

The server name is:

```text
agent-kernel-memory
```

MCP is separate from the optional HTTP daemon. Normal MCP clients start a local stdio process and do not need the daemon.

## Start and inspect

```bash
agent-kernel mcp serve
agent-kernel mcp test
```

Direct JSON-RPC check:

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  | agent-kernel mcp serve
```

`agent-kernel mcp test` reports mode, approval state, count, and exact tool names.

## Core mode

Core mode is the default and exposes ten tools:

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

Core mode is designed for ordinary coding-agent sessions. It supports reading approved state, requesting bounded context, capturing evidence, creating pending proposals, and evaluating commands without exposing broader maintenance operations.

## Extended mode

```bash
AGENT_KERNEL_MCP_TOOLS=extended agent-kernel mcp test
```

Extended mode exposes fourteen tools and adds:

```text
agent_kernel_get_constitution
agent_kernel_read_episode
agent_kernel_capture_episode
agent_kernel_sync_episodes
```

Extended mode is for trusted local maintenance. It is not required for normal memory or context retrieval.

## Explicit approval mode

MCP approval requires both controls:

```bash
AGENT_KERNEL_MCP_TOOLS=extended \
AGENT_KERNEL_MCP_ALLOW_APPROVE=1 \
agent-kernel mcp test
```

This adds `agent_kernel_approve_memory` as an explicit tool call. Agent Kernel never exposes MCP publish or delete tools.

The preferred review path remains terminal-based:

```bash
agent-kernel inbox
agent-kernel approve <proposal-id> --publish
```

## Tool behavior

### Status and memory

- `agent_kernel_get_status` returns local runtime and memory state.
- `agent_kernel_search_memory` searches approved memory.
- `agent_kernel_get_constitution` is extended-only and returns compiled guidance.
- `agent_kernel_list_pending` returns pending proposals as unapproved state.

Rejected proposals must not be returned as usable context.

### Context

`agent_kernel_get_context` accepts a query, stable project ID, optional session ID, files, and a bounded character budget.

`agent_kernel_get_file_context` accepts one or more files, a project ID, and a bounded budget.

Both return compact structured sections. They do not dump the entire local store.

### Failure Lessons

`agent_kernel_capture_failure` captures or deduplicates redacted failure evidence. It never approves or publishes memory.

Example:

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

`agent_kernel_search_failures` searches captured lessons before retry.

### Episodes

Core mode includes episode search. Extended mode adds read, capture, and sync. Episode IDs are validated as identifiers before archive access.

### Guard

`agent_kernel_guard_command` evaluates a command against deterministic safety rules. It does not execute the command.

## Resources

Typical resources:

```text
agent-kernel://constitution
agent-kernel://policy
agent-kernel://memories/rules
agent-kernel://episodes/index
agent-kernel://inbox/pending
```

Resources remain local and are separate from the tool allowlist.

## Client configuration

Generic shape:

```json
{
  "mcpServers": {
    "agent-kernel-memory": {
      "type": "stdio",
      "command": "agent-kernel",
      "args": ["mcp", "serve"]
    }
  }
}
```

Do not embed credentials in repository MCP configuration. `AGENT_KERNEL_HOME` may be passed when an isolated user-level home is intentional.

Client guides:

```text
integrations/CLAUDE_CODE_LIVE_CONTEXT.md
integrations/CODEX_LIVE_CONTEXT.md
integrations/CURSOR_LIVE_CONTEXT.md
integrations/OPENCODE_LIVE_CONTEXT.md
```

## Trust model

```text
agent reads approved memory
  -> requests bounded context
  -> captures evidence or creates a pending proposal
  -> user reviews
  -> user approves
  -> Agent Kernel publishes generated guidance
```

Generated files are not canonical. MCP cannot silently make them canonical.

## HTTP daemon distinction

The daemon provides optional HTTP runtime endpoints. It is not an MCP transport requirement.

Local default:

```bash
agent-kernel daemon start
agent-kernel daemon status --json
```

Remote mode requires explicit opt-in and bearer authentication:

```bash
export AGENT_KERNEL_DAEMON_HOST=0.0.0.0
export AGENT_KERNEL_DAEMON_ALLOW_REMOTE=1
export AGENT_KERNEL_DAEMON_TOKEN="$(openssl rand -hex 32)"
agent-kernel daemon start
```

Remote clients must send `Authorization: Bearer <token>`. Do not expose the daemon directly to the public internet.

## Security rules

- Keep MCP local and stdio-based unless another reviewed transport wraps it.
- Keep credentials out of project MCP configuration.
- Keep core mode as the default.
- Treat pending proposals and Failure Lessons as unapproved evidence.
- Do not enable MCP approval automatically.
- Do not return rejected proposals as context.
- Do not expose raw local state when bounded context is sufficient.
- Do not log tokens or the complete process environment.
- Stop or isolate the daemon when it is not needed.

## Troubleshooting

```bash
command -v agent-kernel
agent-kernel --version
agent-kernel mcp test
agent-kernel doctor
```

Then verify the client command is exactly `agent-kernel` with arguments `mcp`, `serve`. Restart the client after configuration changes.

For an isolated home:

```bash
AGENT_KERNEL_HOME="$HOME/.agent-kernel-work" agent-kernel mcp test
```

See `ENVIRONMENT_VARIABLES.md` and `TROUBLESHOOTING.md`.
