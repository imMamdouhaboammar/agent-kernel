# OpenCode instruction example

Use Agent Kernel as the shared memory layer.

## Read first

Read `AGENTS.md` at the project root.

## Memory capture

When a user preference should be shared with future agents, run:

```bash
agent-kernel-agent-propose --from opencode --reason "User asked OpenCode to save this shared memory." --text "<exact memory>"
```

Do not approve the memory yourself.
