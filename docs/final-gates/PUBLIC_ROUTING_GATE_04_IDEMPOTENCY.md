# Gate 04: Idempotency

Public safe commands must be safe to run more than once.

## Check

Run both commands twice:

```bash
agent-kernel link .
agent-kernel link .
agent-kernel git-hook install .
agent-kernel git-hook install .
```

## Pass condition

Marked blocks are not duplicated.
