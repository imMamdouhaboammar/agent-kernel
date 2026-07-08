# Bypass mode

`bypass` mode allows agents to write approved memory directly.

## Behavior

- agents can read shared memory
- agents can write approved memory directly
- approval is skipped
- writes may publish immediately when the helper is used with publish behavior

## Install command

```bash
agent-kernel-mode set bypass
```

## When to use

Use only when the user explicitly chooses a high-trust agent mode such as “Bypass permissions”.

## Risk

Bypass can pollute global memory quickly. It is useful for speed, but it removes the normal review gate.

## Safety rule

Bypass must never be the silent default.
