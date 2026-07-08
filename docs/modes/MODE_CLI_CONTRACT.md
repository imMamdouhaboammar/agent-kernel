# Mode CLI contract

Mode commands must be simple and native.

## Commands

```bash
agent-kernel-mode show
agent-kernel-mode set approval
agent-kernel-mode set trusted
agent-kernel-mode set bypass
```

## Output rule

`show` should print machine-readable JSON.

## Safety rule

`set bypass` must be explicit. No alias should accidentally select bypass.
