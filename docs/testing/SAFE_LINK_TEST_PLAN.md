# Safe link test plan

Safe project linking must preserve user-owned project instructions.

## Required cases

1. target file does not exist
2. target file exists without Agent Kernel markers
3. target file exists with Agent Kernel markers
4. dry-run does not write files
5. backup is created before modifying an existing file

## Pass condition

Existing project content remains outside the Agent Kernel marked block after repeated runs.
