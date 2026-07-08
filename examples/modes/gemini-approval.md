# Gemini CLI approval mode

Gemini CLI should create pending proposals only.

```bash
agent-kernel-mode set approval
agent-kernel-agent-write --from gemini --reason "User asked Gemini to remember this" --text "<memory>"
```
