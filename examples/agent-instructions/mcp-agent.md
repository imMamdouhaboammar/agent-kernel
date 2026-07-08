# MCP agent instruction example

Use Agent Kernel MCP tools when available.

## Read memory

Prefer:

```text
agent_kernel_search_memory
agent_kernel_get_constitution
agent_kernel_search_episodes
```

## Write proposal

Use:

```text
agent_kernel_propose_memory
```

## Approval rule

Do not approve memory through MCP unless the user explicitly enables that path.
