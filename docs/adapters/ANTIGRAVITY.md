# Antigravity adapter contract

Antigravity should use Agent Kernel through generated `.agents` files, shared skills, and explicit proposal commands.

## Read path

Antigravity should read:

```text
project/.agents/agents.md
project/.agents/skills/README.md
project/AGENTS.md
```

## Write path

When Antigravity captures a useful user rule or project fact, it should create a proposal:

```bash
agent-kernel-agent-propose --from antigravity --reason "<reason>" --text "<memory>"
```

## Skills path

Agent Kernel should expose reusable skill instructions through `.agents/skills` and the global `~/.agent-kernel/skills` directory.

## Safety rule

Antigravity should not make memory global unless the user approves the proposal through Agent Kernel.
