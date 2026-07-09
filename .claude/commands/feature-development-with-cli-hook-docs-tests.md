---
name: feature-development-with-cli-hook-docs-tests
description: Workflow command scaffold for feature-development-with-cli-hook-docs-tests in agent-kernel.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /feature-development-with-cli-hook-docs-tests

Use this workflow when working on **feature-development-with-cli-hook-docs-tests** in `agent-kernel`.

## Goal

Implements a new feature (here, 'failure lessons') by adding CLI commands, hook adapters, documentation, example/test data, and tests, then exposing the feature in the main CLI and package.

## Common Files

- `bin/agent-kernel-<feature>.mjs`
- `bin/agent-kernel-<feature>-hook.mjs`
- `docs/<FEATURE>_PROTOCOL.md`
- `docs/hooks/<FEATURE>_HOOK.md`
- `examples/<feature>-example.json`
- `examples/<feature>-settings.json`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Create CLI entry point for the feature (bin/agent-kernel-<feature>.mjs)
- Implement hook adapter for the feature (bin/agent-kernel-<feature>-hook.mjs)
- Document the feature protocol (docs/<FEATURE>_PROTOCOL.md)
- Document hook usage (docs/hooks/<FEATURE>_HOOK.md)
- Add example/test data (examples/<feature>-example.json, examples/<feature>-settings.json)

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.