# Mode environment variables

Mode should normally be stored in `config.json`.

## Future optional override

A future environment override may use:

```bash
AGENT_KERNEL_MODE=approval
AGENT_KERNEL_MODE=trusted
AGENT_KERNEL_MODE=bypass
```

## Precedence proposal

```text
explicit CLI flag -> environment override -> config.json -> approval default
```

## Safety rule

Environment overrides should not silently persist unless the user runs `agent-kernel-mode set`.
