# Mode config schema

Agent write mode lives in `config.json`.

## Fields

```json
{
  "agentWriteMode": "approval",
  "memoryWritePolicy": {
    "mode": "approval",
    "default": "pending",
    "bypassRequiresExplicitMode": true
  }
}
```

## Valid modes

```text
approval
trusted
bypass
```

## Safety rule

Unknown modes must be rejected instead of silently falling back to bypass.
