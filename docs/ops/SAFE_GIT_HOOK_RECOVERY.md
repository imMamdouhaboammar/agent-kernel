# Safe git hook recovery

If a pre-commit hook needs rollback, inspect `.agent-kernel-backups/`.

## Recovery steps

1. find the latest pre-commit backup
2. copy it back to `.git/hooks/pre-commit`
3. ensure it is executable
4. rerun `agent-kernel git-hook install . --dry-run`

## Safety rule

The installer should never make rollback impossible.
