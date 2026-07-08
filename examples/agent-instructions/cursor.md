# Cursor instruction example

Use Agent Kernel as the shared memory layer.

## Read first

Read `.cursor/rules/00-agent-kernel.mdc` and `AGENTS.md`.

## Memory capture

When the user gives a durable correction, run:

```bash
agent-kernel-agent-propose --from cursor --reason "User corrected this behavior in Cursor." --text "<exact memory>"
```

Do not write directly into `~/.agent-kernel/source/memories`.
