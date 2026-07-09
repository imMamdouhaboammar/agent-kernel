# MCP Server

Agent Kernel includes a local stdio MCP server so coding agents can inspect and use the kernel without editing files directly.

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

## Install for Claude Code

```bash
agent-kernel mcp install claude
```

This writes an MCP server entry to:

```text
~/.claude/settings.json
```

To print the config without writing anything:

```bash
agent-kernel mcp config claude
```

## Intended trust model

MCP gives agents visibility and proposal ability. It is not meant to silently hand over memory governance.

Default model:

```text
agent reads/searches -> agent proposes -> user reviews -> user approves -> kernel publishes
```

Approval through MCP is disabled by default.

To allow MCP approval intentionally:

```bash
AGENT_KERNEL_MCP_ALLOW_APPROVE=1 agent-kernel mcp serve
```

Use this only in trusted local workflows.

## Tool surface

The exact tool list can evolve with the CLI. Current categories are:

| Category | What agents can do |
|---|---|
| Status | Inspect Agent Kernel health and configured memory home |
| Memory search | Search/read approved memories and generated constitution context |
| Proposals | Create pending memory proposals and list pending inbox items |
| Guard | Check a command against Agent Kernel guard rules |
| Episodes | Search/read/capture/sync episodic memory where supported |

Common tool names include:

```text
agent_kernel_get_status
agent_kernel_search_memory
agent_kernel_get_constitution
agent_kernel_propose_memory
agent_kernel_list_pending
agent_kernel_approve_memory
agent_kernel_guard_command
agent_kernel_search_episodes
agent_kernel_read_episode
agent_kernel_capture_episode
agent_kernel_sync_episodes
```

If a client shows fewer tools, use `agent-kernel mcp config claude` and restart the MCP client after updating the installed package.

## Resources

Typical resources include:

```text
agent-kernel://constitution
agent-kernel://policy
agent-kernel://memories/rules
agent-kernel://inbox/pending
```

Generated files and local JSON remain the source of truth. MCP is an access layer over those files.

## Recommended agent behavior

When the user gives a durable instruction such as `remember this`, `خلي دي rule`, or `احفظها لباقي agents`, the agent should create a pending proposal.

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

Failure Lessons are currently CLI/hook-first:

```bash
agent-kernel failure capture ...
agent-kernel failure search "ERR_MODULE_NOT_FOUND"
agent-kernel failure propose <id> --as rule
```

Agents should treat captured failures as evidence. A Failure Lesson becomes durable memory only after a proposal and approval.

## Troubleshooting

If the MCP client does not see the server:

1. Run `agent-kernel mcp config claude` and confirm the command path.
2. Confirm the installed package version with `agent-kernel --version`.
3. Restart the MCP client.
4. Run `agent-kernel doctor` to confirm the kernel home and generated files.
5. Check that `AGENT_KERNEL_HOME` is the intended directory if using a custom memory home.
