# Gemini CLI instruction example

Use Agent Kernel as the shared memory layer.

## Read first

Read `GEMINI.md` and `AGENTS.md`.

## Memory capture

When the user gives a durable rule, run:

```bash
agent-kernel-agent-propose --from gemini --reason "User asked Gemini CLI to save this memory." --text "<exact memory>"
```

Report the proposal id so the user can approve or reject it.
