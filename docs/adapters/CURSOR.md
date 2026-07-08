# Cursor adapter contract

Cursor should use Agent Kernel through project rules and explicit proposal commands.

## Read path

Cursor should read:

```text
project/.cursor/rules/00-agent-kernel.mdc
project/AGENTS.md
```

`agent-kernel-safe-link` is the preferred setup path because it preserves existing project rules.

## Write path

When Cursor detects a user preference or project rule that should be shared across agents, it should run:

```bash
agent-kernel-agent-propose --from cursor --reason "<reason>" --text "<memory>"
```

## Hook reality

Cursor behavior depends on rule ingestion and tool execution support. Agent Kernel should not claim hard blocking hooks for Cursor until an adapter test proves it.

## Safety rule

Cursor should never edit `~/.agent-kernel/dist` outputs directly. It should create proposals through the CLI.
