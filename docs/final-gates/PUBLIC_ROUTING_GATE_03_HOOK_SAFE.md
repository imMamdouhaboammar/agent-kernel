# Gate 03: Public hook safety

`agent-kernel git-hook install` must preserve existing pre-commit hook logic.

## Check

Create a repo with an existing `.git/hooks/pre-commit`, run the command, and confirm the original hook body remains.

## Pass condition

Agent Kernel guard logic is injected without erasing existing hook commands.
