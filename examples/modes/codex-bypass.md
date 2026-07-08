# Codex bypass mode

Codex may write approved memory directly only when bypass mode is explicitly selected.

```bash
agent-kernel-mode set bypass
agent-kernel-agent-write --from codex --reason "Explicit bypass session" --text "<memory>"
```
