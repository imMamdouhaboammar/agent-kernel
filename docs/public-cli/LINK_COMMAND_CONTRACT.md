# `agent-kernel link` command contract

`agent-kernel link` is the production command for linking Agent Kernel context into a project.

## Contract

- create missing instruction files
- preserve existing instruction files
- inject generated content inside markers
- create backups before changing existing files
- avoid duplicate marked blocks on repeated runs

## Safety rule

The command must not behave like a destructive file overwrite.
