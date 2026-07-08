# OpenCode bypass mode

OpenCode may write approved memory directly only in explicit bypass mode.

```bash
agent-kernel-mode set bypass
agent-kernel-agent-write --from opencode --reason "Explicit bypass session" --text "<memory>"
```
