# Claude Code instruction example

Use Agent Kernel as the shared memory layer.

## Read first

Read the generated Agent Kernel context from `CLAUDE.md` and `AGENTS.md`.

## When the user asks you to remember something

Run:

```bash
agent-kernel-agent-propose --from claude --reason "User asked Claude to remember this for future agents." --text "<exact memory>"
```

Do not edit generated Agent Kernel files directly.
