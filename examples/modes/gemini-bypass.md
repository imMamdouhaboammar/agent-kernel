# Gemini CLI bypass mode

Gemini CLI may write approved memory directly only in explicit bypass mode.

```bash
agent-kernel-mode set bypass
agent-kernel-agent-write --from gemini --reason "Explicit bypass session" --text "<memory>"
```
