# Wrapper mode mapping

Wrapper-based agents should prepare mode-aware context before launch.

## Setup

```bash
agent-kernel-mode show
agent-kernel compile
agent-kernel-safe-link .
```

## Write path

Expose `agent-kernel-agent-write` to the wrapped agent.

## Safety rule

Wrappers should not override the configured mode unless the user explicitly asks.
