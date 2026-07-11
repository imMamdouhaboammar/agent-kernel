---
name: architecture-guardian
description: |
  Prevent AI coding agents from introducing architectural drift. Use before
  non-trivial features, refactors, cross-module fixes, new services, new
  dependencies, schema changes, public API changes, or edits governed by a
  change contract. Architecture Guardian is a local-first conformance workflow
  with discovery, dependency rules, change contracts, baselines, scoped
  expiring exceptions, and reuse-first search.
---

# Architecture Guardian — Agent Skill

Use this skill in any AGENTS.md-compatible agent before any non-trivial code
change. The canonical skill with all command references lives at
[`skills/architecture-guardian/SKILL.md`](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/skills/architecture-guardian/SKILL.md).
Read the references under `skills/architecture-guardian/references/` when a
specific capability is needed.

Required workflow:

1. Run `agent-kernel architecture doctor .` to confirm governance state is valid.
2. Run `agent-kernel architecture discover . --json` to see source roots and layers.
3. Search reuse candidates before creating a new capability:
   `agent-kernel architecture reuse "<business capability>" . --json`.
4. Create or validate an active change contract for non-trivial work.
5. Implement only inside the approved scope. The hook can block writes
   outside an active contract.
6. Run `agent-kernel architecture check . --json` before commit.
7. Treat only new findings as regressions. Keep baseline debt visible.
8. Use scoped, expiring exceptions only after the user accepts the trade-off.
9. Capture repeated architectural failures as Failure Lessons.

Hard rules:

- Do not create a second source of truth without evidence that responsibilities differ.
- Do not move business rules into transport, UI, persistence, or framework layers.
- Do not bypass an existing public interface to reach infrastructure directly.
- Do not add dependencies that violate the reviewed layer graph.
- Do not suppress findings without a reason, owner, scope, and expiry.
- Do not treat a high aggregate score as permission to ignore one critical violation.
- Do not block on low-confidence semantic guesses. Report them for review instead.

Quick command surface:

```bash
agent-kernel architecture init .
agent-kernel architecture policy validate .
agent-kernel architecture discover . --json
agent-kernel architecture baseline . --json
agent-kernel architecture reuse "<capability>" . --json
agent-kernel architecture contract init . \
  --task "<reviewed task>" \
  --owner "<domain or team>" \
  --allow "src/area/**,test/area/**" \
  --expect "src/area/file.ts,test/area/file.test.ts" \
  --tests "<observable behavior>"

agent-kernel architecture check . --json
agent-kernel architecture check . --strict --json
```

Full documentation:

- [docs/ARCHITECTURE_GUARDIAN.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/ARCHITECTURE_GUARDIAN.md)
- [docs/architecture-guardian/COMMAND_REFERENCE.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/architecture-guardian/COMMAND_REFERENCE.md)
- [docs/architecture-guardian/SECURITY.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/architecture-guardian/SECURITY.md)

License: MIT
