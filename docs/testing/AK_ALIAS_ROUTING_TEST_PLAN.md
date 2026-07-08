# ak alias routing test plan

## Cases

1. `ak --version` delegates to runtime CLI
2. `ak link .` routes to safe-link
3. `ak git-hook install .` routes to safe-git-hook
4. routed behavior matches `agent-kernel`
5. bin lint verifies the alias target exists

## Pass condition

`ak` is a safe alias, not a bypass around wrapper routing.
