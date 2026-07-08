# Agent proposal hook contract

Any agent-facing hook that captures durable user memory must write a pending proposal, not an approved memory.

## Required write path

```bash
agent-kernel-agent-propose --from <agent> --reason "<reason>" --text "<memory>"
```

or the equivalent MCP tool:

```text
agent_kernel_propose_memory
```

## Approval rule

Approval remains a user-controlled step:

```bash
agent-kernel approve <proposal-id> --publish
```

## Safety rule

A hook must not convert a user correction into a global rule silently.
