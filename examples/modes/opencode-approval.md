# OpenCode approval mode

OpenCode should create pending proposals only.

```bash
agent-kernel-mode set approval
agent-kernel-agent-write --from opencode --reason "User asked OpenCode to remember this" --text "<memory>"
```
