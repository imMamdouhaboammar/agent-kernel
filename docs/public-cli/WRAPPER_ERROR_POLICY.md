# Wrapper error policy

The public CLI wrapper should fail clearly.

## Failure cases

- missing routed helper script
- missing runtime `dist/cli.mjs`
- child process exits non-zero
- child process cannot start

## Required behavior

Return the child process exit code when available. Print a clear error when the script is missing or cannot start.

## Safety rule

Wrapper failures must not silently fall back to unsafe behavior.
