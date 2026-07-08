# Codex adapter contract

Codex should use Agent Kernel as a shared local memory source through `AGENTS.md`, CLI commands, and MCP where available.

## Read path

Codex should read:

```text
~/.codex/AGENTS.md
project/AGENTS.md
```

The generated `AGENTS.md` should point Codex to the shared memory workflow and proposal command.

## Write path

Codex should not silently write approved memories. It should create pending proposals:

```bash
agent-kernel-agent-propose --from codex --reason "<reason>" --text "<memory>"
```

## Hook reality

Codex support for blocking hooks depends on the local wrapper or environment. The safe baseline is instruction-file based plus explicit CLI proposal writes.

## Required behavior

When the user says “remember this”, “save this”, or corrects the same behavior twice, Codex should create a proposal and tell the user how to approve it.
