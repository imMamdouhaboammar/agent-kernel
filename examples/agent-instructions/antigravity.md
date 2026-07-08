# Antigravity instruction example

Use Agent Kernel as the shared memory layer.

## Read first

Read `.agents/agents.md`, `.agents/skills/README.md`, and `AGENTS.md`.

## Memory capture

When the user asks you to save a rule for future agents, run:

```bash
agent-kernel-agent-propose --from antigravity --reason "User asked Antigravity to save this memory." --text "<exact memory>"
```

Keep memory writes pending until user approval.
