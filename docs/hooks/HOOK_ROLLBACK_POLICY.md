# Hook rollback policy

Every hook installer must be reversible.

## Backup rule

Before changing an existing hook file, Agent Kernel should copy it to:

```text
.agent-kernel-backups/
```

## Marker rule

Agent Kernel-owned sections must be wrapped in markers so they can be replaced or removed without touching user logic.

## Rollback rule

A future rollback command should restore the most recent backup or remove only the marked Agent Kernel block.

## Safety rule

Never delete an existing hook body without a backup.
