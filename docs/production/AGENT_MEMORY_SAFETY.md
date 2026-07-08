# Agent memory safety

Agent memory safety is the central production concern.

## Rules

- agents can read shared memory
- agents write through helpers or MCP tools
- approval is default
- trusted mode is gated
- bypass is explicit

## Safety rule

Convenience must not silently remove user control over global memory.
