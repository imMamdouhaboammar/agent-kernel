# Codex instruction example

Use Agent Kernel as the shared memory layer.

## Read first

Read `AGENTS.md` before editing the repository.

## Memory capture

When the user says to remember a rule or preference, run:

```bash
agent-kernel-agent-propose --from codex --reason "User asked Codex to save this shared memory." --text "<exact memory>"
```

Tell the user they can approve it with `agent-kernel approve <id> --publish`.
