# Git hook command migration

## Before

```bash
agent-kernel-safe-git-hook .
```

## After

```bash
agent-kernel git-hook install .
```

## Behavior

Both paths should preserve existing hook logic and inject Agent Kernel guard logic inside marked blocks.

## Safety rule

The public command is the recommended production path.
