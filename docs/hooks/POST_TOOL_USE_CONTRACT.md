# PostToolUse contract

`PostToolUse` runs after a write-capable tool has changed files.

## Scope

It should scan affected files for:

- hardcoded secrets
- forbidden local fallback patterns
- obvious production-data hardcoding
- policy-specific content patterns

## Decision rule

If violations are found, the hook must block continuation and report the files and rules involved.

## Limitation

Post-write blocking cannot undo file changes by itself. The agent must revert or fix the violation after the hook reports it.
