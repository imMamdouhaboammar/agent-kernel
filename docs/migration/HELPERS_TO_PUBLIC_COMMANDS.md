# Helpers to public commands migration

## Old transitional commands

```bash
agent-kernel-safe-link .
agent-kernel-safe-git-hook .
```

## Preferred production commands

```bash
agent-kernel link .
agent-kernel git-hook install .
```

## Migration rule

Existing helper commands remain valid during the transition window.
