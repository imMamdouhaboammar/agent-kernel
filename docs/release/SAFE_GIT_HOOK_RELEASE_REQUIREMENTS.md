# Safe git hook release requirements

## Requirements

- public command routes to safe behavior
- helper command remains available
- existing hook logic is preserved
- backups are created
- repeated runs are idempotent

## Safety rule

Do not release if `agent-kernel git-hook install` can erase user-owned hook logic.
