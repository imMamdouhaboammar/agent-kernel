# MCP proposal write

MCP proposal creation is the safest write operation for shared memory.

## Tool

```text
agent_kernel_propose_memory
```

## Expected result

The tool should create a pending proposal under the normal inbox workflow.

## Not allowed by default

The tool should not approve, publish, or sync the proposal automatically.

## Safety rule

Agents may propose. Users approve.
