# Mode discovery

Agents that discover Agent Kernel should also discover its current write mode.

## Discovery command

```bash
agent-kernel-mode show
```

## Agent behavior

- approval: create proposals
- trusted: use mode-aware write helper
- bypass: write directly only if user intentionally selected bypass

## Safety rule

Agents should not assume bypass just because the host app is in a permissive editing mode.
