# Safe routing regression rules

## Regression examples

- public bin points directly to `dist/cli.mjs`
- `agent-kernel link` bypasses safe-link
- `agent-kernel git-hook install` bypasses safe-git-hook
- helpers are removed before migration window
- smoke suite does not include public routing tests

## Safety rule

A regression in public routing should block release.
