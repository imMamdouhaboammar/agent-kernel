# Codex approval mode

Codex should write pending proposals only.

```bash
agent-kernel-mode set approval
agent-kernel-agent-write --from codex --reason "User asked Codex to remember this" --text "<memory>"
```
