# MCP-capable agent contract

An MCP-capable coding agent can use Agent Kernel without scraping generated files only.

## Read tools

The agent should prefer:

```text
agent_kernel_get_status
agent_kernel_search_memory
agent_kernel_get_constitution
agent_kernel_search_episodes
agent_kernel_read_episode
```

## Write tools

The agent may create memory proposals with:

```text
agent_kernel_propose_memory
```

Approval through MCP must remain disabled unless the user explicitly enables it.

## Safety rule

MCP clients are not automatically trusted. Proposal creation is allowed. Approval and publish should require an intentional user-controlled path.
