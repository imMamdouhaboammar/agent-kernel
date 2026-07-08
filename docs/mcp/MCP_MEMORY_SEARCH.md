# MCP memory search

Agents should search approved memory before asking the user to repeat known rules.

## Tool

```text
agent_kernel_search_memory
```

## Use when

- the user says “like last time”
- the user references a past rule
- the agent needs coding preferences
- a project decision may already exist

## Safety rule

Search results guide the agent, but project-local context and user instructions still take priority.
