# Public CLI wrapper contract

The published `agent-kernel` binary may wrap the internal `dist/cli.mjs` runtime.

## Routed commands

```text
agent-kernel link
agent-kernel git-hook install
```

## Delegated commands

All other commands delegate to `dist/cli.mjs`.

## Safety rule

Routing must preserve existing command names while improving safety behavior.
