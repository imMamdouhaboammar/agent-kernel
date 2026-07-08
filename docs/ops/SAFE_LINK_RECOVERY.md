# Safe link recovery

If a linked file needs rollback, inspect `.agent-kernel-backups/`.

## Recovery steps

1. find the latest backup for the affected file
2. copy it back to the original path
3. rerun `agent-kernel link . --dry-run`
4. rerun `agent-kernel link .`

## Safety rule

Backups must exist before changing user-owned files.
