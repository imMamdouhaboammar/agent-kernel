# Safe git hook test plan

Safe git hook installation must preserve existing hook logic.

## Required cases

1. repository has no pre-commit hook
2. repository has an existing pre-commit hook
3. dry-run does not write files
4. backup is created before modifying an existing hook
5. repeated runs do not duplicate the Agent Kernel block

## Pass condition

Existing hook commands remain in the hook file after Agent Kernel injection.
