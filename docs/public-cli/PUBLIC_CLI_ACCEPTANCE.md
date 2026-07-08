# Public CLI acceptance

## Required behavior

- `agent-kernel link` preserves existing project files
- `agent-kernel git-hook install` preserves existing hooks
- `agent-kernel --version` delegates to runtime CLI
- helper binaries remain packaged
- smoke tests cover routed commands

## Safety rule

The public CLI must be the safest path, not the legacy overwrite path.
