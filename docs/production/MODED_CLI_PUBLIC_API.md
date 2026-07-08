# Moded CLI public API

## Public binaries

```text
agent-kernel-mode
agent-kernel-agent-write
agent-kernel-agent-propose
```

## Compatibility rule

`agent-kernel-agent-propose` always writes pending proposals. `agent-kernel-agent-write` respects the configured mode.

## Safety rule

Do not remove these helpers without a deprecation period.
