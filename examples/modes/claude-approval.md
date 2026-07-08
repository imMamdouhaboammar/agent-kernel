# Claude approval mode

Claude should create pending proposals only.

```bash
agent-kernel-mode set approval
agent-kernel-agent-write --from claude --reason "User asked Claude to remember this" --text "<memory>"
```

User approval remains required.
