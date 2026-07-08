# OpenCode adapter contract

OpenCode should use Agent Kernel through `AGENTS.md` and explicit CLI proposal writes.

## Read path

OpenCode should read:

```text
project/AGENTS.md
```

When global sync is supported in the user's environment, OpenCode may also read a user-level generated `AGENTS.md`.

## Write path

OpenCode should create pending memory proposals with:

```bash
agent-kernel-agent-propose --from opencode --reason "<reason>" --text "<memory>"
```

## Hook reality

OpenCode hook support should be treated as environment-dependent. The safe baseline is generated instructions plus CLI proposal commands.

## Safety rule

OpenCode should preserve existing project instructions and should not directly modify Agent Kernel source memory JSON files.
