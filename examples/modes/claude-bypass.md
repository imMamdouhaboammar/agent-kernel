# Claude bypass mode

Claude may write approved memory directly only after the user explicitly selects bypass mode.

```bash
agent-kernel-mode set bypass
agent-kernel-agent-write --from claude --reason "Explicit bypass session" --text "<memory>"
```

Use after deliberate user selection only.
