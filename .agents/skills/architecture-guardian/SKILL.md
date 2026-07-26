---
name: architecture-guardian
description: |
  Use before non-trivial features, refactors, cross-module fixes, new capabilities, dependencies,
  schema changes, public API changes, or contract-governed edits. Requires discovery, reuse-first
  search, reviewed scope, baseline-aware classification, and a final architecture check.
---

# Architecture Guardian for AGENTS-compatible agents

The canonical workflow lives in [`skills/architecture-guardian/SKILL.md`](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/skills/architecture-guardian/SKILL.md).

## Required sequence

1. Read `AGENTS.md` and the current architecture policy.
2. Run `agent-kernel architecture doctor . --json`.
3. Run `agent-kernel architecture discover . --json`.
4. Search reuse candidates before creating a parallel capability.
5. Create or validate a change contract for non-trivial work.
6. Implement only inside the reviewed scope.
7. Run `agent-kernel architecture check . --json` before commit.
8. Separate baseline debt from new regressions.
9. Use only scoped, owned, expiring exceptions.
10. Capture repeated architecture failures as Failure Lessons.

```bash
agent-kernel architecture reuse "<capability>" . --json
agent-kernel architecture contract init . \
  --task "<task>" \
  --owner "<owner>" \
  --allow "src/area/**,test/area/**" \
  --expect "src/area/file.ts,test/area/file.test.ts" \
  --tests "<behavior>"
agent-kernel architecture check . --json
```

## Hard boundaries

- Do not create a second source of truth without evidence.
- Do not move business rules into UI, transport, persistence, provider, or framework layers.
- Do not bypass a public interface to reach infrastructure.
- Do not broaden a contract because implementation drifted.
- Do not weaken policy or hide a blocker behind an aggregate score.
- Do not treat expired exceptions or baseline findings as authorization for new violations.
- Use strict mode only after policy, baseline, contract, and exception review.

Read [docs/ARCHITECTURE_GUARDIAN.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/ARCHITECTURE_GUARDIAN.md) and [docs/architecture-guardian/COMMAND_REFERENCE.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/architecture-guardian/COMMAND_REFERENCE.md).
