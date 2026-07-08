# Wrapper error test plan

## Cases

1. missing safe-link helper exits non-zero
2. missing safe-git-hook helper exits non-zero
3. missing `dist/cli.mjs` exits non-zero for delegated commands
4. child process non-zero status is preserved
5. error message identifies the missing script

## Pass condition

Wrapper failures are explicit and do not fall back to unsafe behavior.
