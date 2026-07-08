# Mode helper contract

`agent-kernel-agent-write` is the mode-aware write helper for agents.

## Behavior

```text
approval -> agent-kernel propose
trusted -> remember for low-risk/project-scoped memory, otherwise propose
bypass -> agent-kernel remember --publish
```

## Safety rule

Agents should use this helper when they want mode-aware behavior. Use `agent-kernel-agent-propose` when the write must always stay pending.
