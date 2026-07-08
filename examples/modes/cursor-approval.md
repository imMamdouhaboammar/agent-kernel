# Cursor approval mode

Cursor should create pending proposals only.

```bash
agent-kernel-mode set approval
agent-kernel-agent-write --from cursor --reason "User asked Cursor to remember this" --text "<memory>"
```
