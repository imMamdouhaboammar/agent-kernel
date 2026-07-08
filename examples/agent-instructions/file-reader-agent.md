# File-reader agent instruction example

Use Agent Kernel as a read-only instruction source when command execution is unavailable.

## Read first

Read `AGENTS.md`.

## Memory limitation

If you cannot run shell commands, you cannot write a proposal directly.

Ask the user to run:

```bash
agent-kernel-agent-propose --from <agent-name> --reason "Captured from file-reader agent session." --text "<exact memory>"
```

## Safety rule

Do not invent that memory was saved if the command was not run.
