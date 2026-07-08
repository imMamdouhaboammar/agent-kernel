# Memory pollution controls

Shared memory is useful only when it stays clean.

## Pollution risks

- agents saving temporary guesses
- broad rules that apply to every project
- duplicate preferences
- contradictions between old and new rules
- private client facts saved globally

## Required controls

1. default agent writes should be pending proposals
2. critical or global memories require user approval
3. duplicate detection should run before publish
4. rejected proposals should remain auditable
5. project facts should prefer project scope

## Safety rule

When uncertain, create a narrow project-scoped proposal instead of a broad global rule.
