---
name: architecture-guardian
description: Prevent AI coding agents from introducing architectural drift. Use before non-trivial features, refactors, cross-module fixes, new services, new dependencies, schema changes, public API changes, or edits governed by a change contract.
---

# Architecture Guardian

Architecture Guardian is a local-first conformance workflow for AI coding agents. It requires evidence before new abstractions, checks dependency boundaries, separates pre-existing debt from new violations, and can block writes outside an approved change contract.

## Required workflow

1. Read project instructions and the current architecture policy.
2. Run `agent-kernel architecture doctor .`.
3. Run `agent-kernel architecture discover . --json`.
4. Search for reuse candidates before creating a function, class, service, validator, repository, adapter, hook, state store, or utility:
   `agent-kernel architecture reuse "<capability>" . --json`
5. Create or validate an active change contract for non-trivial work.
6. Implement only within the approved scope.
7. Run `agent-kernel architecture check . --json` before commit.
8. Review only new findings as regressions. Do not attribute baseline findings to the current change.
9. Use scoped, expiring exceptions only when the user accepts the trade-off.
10. Capture repeated architectural failures as Failure Lessons, then propose durable rules for user review.

## Hard rules

- Do not create a second source of truth for the same business rule without evidence that the responsibilities differ.
- Do not move business rules into transport, UI, persistence, or framework layers.
- Do not bypass an existing public interface to reach infrastructure directly.
- Do not add dependencies that violate the reviewed layer graph.
- Do not suppress findings without a reason, owner, scope, and expiry.
- Do not treat a high aggregate score as permission to ignore one critical violation.
- Do not block on low-confidence semantic guesses. Report them for review instead.

## Commands

```bash
agent-kernel architecture init .
agent-kernel architecture policy validate .
agent-kernel architecture contract init . --task "..." --owner "..." --allow "src/domain/**,test/domain/**"
agent-kernel architecture discover . --json
agent-kernel architecture reuse "validate customer email" . --json
agent-kernel architecture baseline . --json
agent-kernel architecture diff . --json
agent-kernel architecture check . --json
agent-kernel architecture exception add . --rule no-cycles --files "src/legacy/**" --reason "..." --expires "2026-12-31T00:00:00.000Z"
agent-kernel architecture doctor . --json
```

Read the focused references only when needed:

- `references/workflow.md`
- `references/policy-model.md`
- `references/change-contracts.md`
- `references/baselines.md`
- `references/exceptions.md`
- `references/reuse-first.md`
- `references/hooks.md`
- `references/false-positive-control.md`
- `references/language-support.md`
- `references/ci-and-gates.md`
- `references/evaluation.md`
- `references/threat-model.md`
