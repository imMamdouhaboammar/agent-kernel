# Public CLI wrapper

`agent-kernel` and `ak` route through a thin public wrapper.

## Purpose

The wrapper preserves the public command surface while moving risky commands to safe implementations.

## Intercepted commands

```bash
agent-kernel link
agent-kernel git-hook install
```

## Pass-through commands

All other commands are delegated to `dist/cli.mjs`.

## Safety rule

Users keep the same commands. Safe behavior becomes the default.
