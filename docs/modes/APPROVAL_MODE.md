# Approval mode

`approval` is the safest Agent Kernel mode.

## Behavior

- agents can read shared memory
- agents create pending proposals
- user approval is required before memory is published
- global and critical rules are never approved automatically

## Install command

```bash
agent-kernel-mode set approval
```

## Agent write command

```bash
agent-kernel-agent-write --from codex --reason "User asked to remember this" --text "<memory>"
```

In this mode, the command creates a pending proposal.

## Production default

Use this mode by default on new machines, shared machines, client projects, and unknown repos.
