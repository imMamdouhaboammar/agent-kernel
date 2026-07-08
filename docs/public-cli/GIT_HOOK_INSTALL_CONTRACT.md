# `agent-kernel git-hook install` command contract

`agent-kernel git-hook install` is the production command for installing the Agent Kernel pre-commit guard.

## Contract

- create a pre-commit hook when none exists
- preserve existing pre-commit hook logic
- inject Agent Kernel logic inside markers
- create backups before modifying existing hooks
- avoid duplicate marked blocks on repeated runs

## Safety rule

The command must not erase existing user hook logic.
