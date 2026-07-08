# Helper deprecation path

The helper binaries stay available while their behavior becomes the public CLI default.

## Transitional helpers

```text
agent-kernel-safe-link
agent-kernel-safe-git-hook
```

## Public commands

```text
agent-kernel link
agent-kernel git-hook install
```

## Deprecation rule

Do not remove helpers until public CLI behavior has shipped and users have a migration window.
