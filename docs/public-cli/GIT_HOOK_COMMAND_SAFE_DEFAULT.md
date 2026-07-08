# `agent-kernel git-hook install` safe default

`agent-kernel git-hook install` should preserve existing pre-commit hook logic.

## Required behavior

- create hook if missing
- append Agent Kernel marked block to existing hook
- replace only Agent Kernel marked block on later runs
- write backup before modifying an existing hook

## Safety rule

Git hook install must not delete existing project automation.
