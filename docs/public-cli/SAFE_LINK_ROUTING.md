# Public CLI safe link routing

`agent-kernel link` should route to the safe project linker.

## Public command

```bash
agent-kernel link .
```

## Effective behavior

The command should preserve existing project instruction files and inject Agent Kernel content inside marked blocks.

## Safety rule

Users should not need to know about `agent-kernel-safe-link` for normal production use.
