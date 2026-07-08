# Sprint 02: Safe hooks

## Goal

Install hooks without destroying existing user hook logic.

## Scope

- safe pre-commit merge
- hook block markers
- backups before write
- dry-run mode
- rollback design

## Done when

`agent-kernel git-hook install` preserves existing pre-commit files by default.
