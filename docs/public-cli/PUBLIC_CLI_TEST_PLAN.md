# Public CLI test plan

## Cases

1. `agent-kernel --version` delegates to runtime CLI
2. `agent-kernel link` preserves existing `AGENTS.md`
3. `agent-kernel link --hooks` also installs safe git hook
4. `agent-kernel git-hook install` preserves existing pre-commit hooks
5. helper binaries still work during transition

## Pass condition

The published command path uses safe behavior by default.
