# Generic CLI agent instruction example

Use Agent Kernel as the shared memory layer.

## Read first

Read `AGENTS.md` if it exists in the project.

## Memory capture

When the user asks you to remember something for future agents, run:

```bash
agent-kernel-agent-propose --from <agent-name> --reason "User asked to save this shared memory." --text "<exact memory>"
```

If the command is unavailable, ask the user to install Agent Kernel globally.
