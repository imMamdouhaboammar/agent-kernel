# Cursor bypass mode

Cursor may write approved memory directly only in explicit bypass mode.

```bash
agent-kernel-mode set bypass
agent-kernel-agent-write --from cursor --reason "Explicit bypass session" --text "<memory>"
```
