# Public link routing test plan

## Cases

1. existing `AGENTS.md` is preserved
2. marked block is appended
3. second run replaces marked block without duplication
4. backups are created for existing files
5. command exits non-zero when dist output is missing

## Pass condition

`agent-kernel link` behaves like safe-link through the public binary path.
