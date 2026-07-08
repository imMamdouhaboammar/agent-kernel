# Public CLI routing release requirements

## Required before release

- `agent-kernel` bin points to wrapper
- `ak` bin points to wrapper
- `agent-kernel link` routes to safe-link behavior
- `agent-kernel git-hook install` routes to safe-git-hook behavior
- helper binaries remain packaged

## Safety rule

A release must not expose the old destructive link behavior through the public binary.
