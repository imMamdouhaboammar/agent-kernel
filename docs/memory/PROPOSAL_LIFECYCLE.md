# Proposal lifecycle

Agent-written memory should move through a controlled lifecycle.

## Current lifecycle

```text
pending -> approved -> published
pending -> rejected
```

## Required behavior

- Agents create pending proposals.
- Users review through `agent-kernel inbox`.
- Approved items are compiled into generated files.
- Published items are synced to supported agent targets.

## Safety rule

No agent should silently upgrade a proposal into approved global memory.
