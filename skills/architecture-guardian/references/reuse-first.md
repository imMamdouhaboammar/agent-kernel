# Reuse-first search

Reuse-first search prevents a coding agent from creating a second source of truth for an existing responsibility.

```bash
agent-kernel architecture reuse "validate customer email" . --json
```

## Search strategy

Search with:

- business responsibility
- domain term
- public interface name
- state ownership concept
- provider or integration boundary
- error or validation outcome

Do not search only for the proposed class name.

## Decision

Reuse is not blind DRY. Similar syntax may represent different responsibilities. A separate abstraction is acceptable when ownership, lifecycle, or policy meaning is genuinely different and documented.

The prohibited case is an unreviewed second implementation of the same validation rule, authorization decision, state owner, pricing rule, provider target, or integration boundary.

When no candidate is suitable, record the reason in the change contract or PR summary.
