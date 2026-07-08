# Link command migration

## Before

```bash
agent-kernel-safe-link .
```

## After

```bash
agent-kernel link .
```

## Behavior

Both paths should preserve existing project files and inject Agent Kernel content inside marked blocks.

## Safety rule

The public command is the recommended production path.
