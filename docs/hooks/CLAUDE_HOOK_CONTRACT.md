# Claude hook contract

Claude Code is the primary hook-capable adapter in Agent Kernel.

## Supported events

Agent Kernel may install handlers for:

```text
SessionStart
UserPromptSubmit
PreToolUse
PostToolUse
```

## Required behavior

- `SessionStart` injects current compiled context.
- `UserPromptSubmit` captures explicit memory triggers as pending proposals.
- `PreToolUse` blocks dangerous shell commands and protected write paths.
- `PostToolUse` scans written files for secrets and forbidden content patterns.

## Failure policy

If a hook blocks an action, Claude should stop and report the reason instead of attempting a workaround.
