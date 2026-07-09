---
name: feature-bugfix-followup
description: Workflow command scaffold for feature-bugfix-followup in agent-kernel.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /feature-bugfix-followup

Use this workflow when working on **feature-bugfix-followup** in `agent-kernel`.

## Goal

Implements a new feature file, then quickly follows up with a bugfix or typo correction in the same file.

## Common Files

- `bin/agent-kernel-<feature>.mjs`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Add new CLI or feature file (bin/agent-kernel-<feature>.mjs)
- Commit a fix to the same file (bin/agent-kernel-<feature>.mjs)

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.