# Approval inbox

The approval inbox is the control point between agent-captured memory and shared memory.

## Folders

```text
inbox/pending/
inbox/approved/
inbox/rejected/
```

## User commands

```bash
agent-kernel inbox
agent-kernel approve <proposal-id> --publish
agent-kernel reject <proposal-id>
```

## Agent rule

Agents write to pending proposals. Users decide what becomes shared memory.

## Safety rule

Rejected proposals should remain available for audit instead of disappearing silently.
