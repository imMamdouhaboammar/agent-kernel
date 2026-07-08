# Public CLI safe git hook routing

`agent-kernel git-hook install` should route to the safe git hook installer.

## Public command

```bash
agent-kernel git-hook install .
```

## Effective behavior

The command should preserve existing pre-commit hook logic and inject an Agent Kernel marked block.

## Safety rule

Users should not need to know about `agent-kernel-safe-git-hook` for normal production use.
