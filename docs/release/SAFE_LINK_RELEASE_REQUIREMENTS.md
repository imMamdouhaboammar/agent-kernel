# Safe link release requirements

## Requirements

- public command routes to safe behavior
- helper command remains available
- existing files are preserved
- backups are created
- repeated runs are idempotent

## Safety rule

Do not release if `agent-kernel link` can remove user-owned instructions.
