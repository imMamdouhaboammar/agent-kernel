# Generic pre-commit contract

The generic pre-commit hook protects commits from obvious policy violations.

## Required command

```bash
agent-kernel guard --staged
```

## Install rule

The installer must preserve any existing pre-commit hook logic. It should inject an Agent Kernel marked block instead of replacing the whole file.

## Backup rule

If an existing hook file is present, create a backup before modifying it.

## Failure rule

If the guard exits non-zero, the commit must stop.
