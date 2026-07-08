# Routed public commands

The public CLI routes selected commands to safer implementations.

## Routed

```text
agent-kernel link
agent-kernel git-hook install
ak link
ak git-hook install
```

## Delegated

All other commands delegate to `dist/cli.mjs`.

## Safety rule

Routed commands must be covered by smoke tests.
