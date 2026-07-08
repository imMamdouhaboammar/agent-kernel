# PreToolUse contract

`PreToolUse` is the first blocking layer before an agent executes a tool call.

## Scope

It should inspect:

- shell commands
- write paths
- protected files
- package manager commands
- obvious destructive operations

## Decision rule

If a policy match is found, the hook must deny the tool call and return a clear reason.

## Non-goal

`PreToolUse` is not a full static analyzer. It is a fast deterministic gate for high-risk operations.
