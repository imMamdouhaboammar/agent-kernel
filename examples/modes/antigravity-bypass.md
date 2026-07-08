# Antigravity bypass mode

Antigravity may write approved memory directly only in explicit bypass mode.

```bash
agent-kernel-mode set bypass
agent-kernel-agent-write --from antigravity --reason "Explicit bypass session" --text "<memory>"
```
