# Wrapper agent instruction example

Use Agent Kernel before starting the target agent.

## Wrapper setup

```bash
agent-kernel compile
agent-kernel-safe-link .
agent-kernel-safe-git-hook .
```

## Memory capture command

Expose this to the target agent:

```bash
agent-kernel-agent-propose --from <agent-name> --reason "<reason>" --text "<memory>"
```

## Safety rule

The wrapper should preserve existing project files and hooks.
