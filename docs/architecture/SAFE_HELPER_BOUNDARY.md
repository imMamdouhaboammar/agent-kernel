# Safe helper boundary

Safe helpers own the file-merge behavior during the transition.

## Helpers

```text
agent-kernel-safe-link
agent-kernel-safe-git-hook
```

## Responsibilities

- markers
- backups
- idempotency
- dry-run support
- preservation of user-owned content

## Safety rule

Helpers should remain focused and small.
