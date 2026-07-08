# Public git hook routing test plan

## Cases

1. no existing pre-commit hook creates a hook
2. existing pre-commit hook is preserved
3. marked block is injected
4. repeated runs do not duplicate marked block
5. backups are created before modifying existing hooks

## Pass condition

`agent-kernel git-hook install` behaves like safe-git-hook through the public binary path.
