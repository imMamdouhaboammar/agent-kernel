# Public CLI delegation QA runbook

## Run

```bash
agent-kernel --version
agent-kernel status
agent-kernel doctor
```

## Verify

These commands should delegate to the existing runtime CLI without changing behavior.

## Safety rule

Public routing should not break unrelated commands.
