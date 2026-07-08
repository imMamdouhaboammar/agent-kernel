# `agent-kernel link` safe default

`agent-kernel link` should preserve existing project files by default.

## Required behavior

- create missing files
- append Agent Kernel blocks to existing files
- replace only marked Agent Kernel blocks on later runs
- write backups before modifying existing files

## Safety rule

`agent-kernel link` must not overwrite user-owned project instructions.
