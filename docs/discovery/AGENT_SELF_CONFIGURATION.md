# Agent self-configuration

A discovered agent should be able to configure Agent Kernel with minimal user effort.

## Agent responsibilities

1. explain what will be installed
2. ask the user before project mutation
3. run global install if missing
4. run `agent-kernel init --sync`
5. use safe linking for project files
6. use safe hook injection for git hooks
7. create proposals through the proposal helper

## Required commands

```bash
agent-kernel --version
agent-kernel init --sync
agent-kernel-safe-link . --dry-run
agent-kernel-safe-git-hook . --dry-run
```

## Safety rule

Self-configuration should be explicit and reviewable, not hidden.
