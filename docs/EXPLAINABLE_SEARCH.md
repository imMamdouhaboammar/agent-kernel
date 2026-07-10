# Explainable search scoring

Agent Kernel ranks local search results with deterministic text signals. Embeddings are not required.

## Explain a result

```bash
agent-kernel search "ERR_MODULE_NOT_FOUND" --debug
agent-kernel search "src/cli.mjs" --explain
agent-kernel search "safe-link idempotency" --budget 1200 --json
```

`--debug` and `--explain` expose the same scoring breakdown. JSON results include a `signals` array for every result.

```json
{
  "score": 34,
  "signals": [
    { "name": "file-match", "points": 7, "detail": "src/cli.mjs" },
    { "name": "exact-file", "points": 18, "detail": "src/cli.mjs" },
    { "name": "approved-memory", "points": 6, "detail": "approved" }
  ]
}
```

## Ranking signals

The scorer can use:

- exact and partial file matches
- exact and partial command matches
- exact and partial error signatures
- tag matches
- project matches
- recent session activity
- approved memory priority
- Failure Lesson recurrence count
- agent matches
- commit link matches

Exact matches receive more weight than partial matches. Equal scores are ordered by updated time, then record ID, making repeated searches deterministic.

## Result sections

JSON output separates results into:

- `approvedMemory`
- `failureLessons`
- `episodes`
- `rawObservations`

This prevents approved guidance from being presented as equivalent to unreviewed session evidence.

## Budgets

```bash
agent-kernel search "src/cli.mjs" --files --budget 1200
```

The budget limits rendered context characters. Results are accepted in ranking order until the next result would exceed the budget. JSON output includes `budget` and `budgetUsed`.
