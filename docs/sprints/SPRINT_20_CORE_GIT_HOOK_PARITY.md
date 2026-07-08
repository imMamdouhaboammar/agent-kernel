# Sprint 20: Core git hook parity

## Goal

Move safe git hook behavior into the core runtime `git-hook install` implementation.

## Scope

- extract hook block merge logic
- preserve existing hook bodies
- create backups before write
- keep helper compatibility
- add core parity tests

## Done when

`node dist/cli.mjs git-hook install` and `agent-kernel git-hook install` have equivalent safe behavior.
