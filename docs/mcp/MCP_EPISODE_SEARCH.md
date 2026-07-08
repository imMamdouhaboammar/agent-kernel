# MCP episode search

Episode search lets agents recall prior sessions without forcing the user to repeat context.

## Tool

```text
agent_kernel_search_episodes
```

## Use when

- the user references a previous attempt
- the user asks what was decided before
- the same bug or architecture decision appears again

## Safety rule

Episode results may contain sensitive context. Agents should summarize only what is relevant to the current task.
