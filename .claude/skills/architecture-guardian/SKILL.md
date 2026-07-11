---
name: architecture-guardian
description: Prevent AI coding agents from introducing architectural drift. Use before non-trivial features, refactors, cross-module fixes, new services, new dependencies, schema changes, public API changes, or edits governed by a change contract.
---

# Architecture Guardian

Use Agent Kernel's local architecture conformance loop before non-trivial code changes.

1. Run `agent-kernel architecture doctor .`.
2. Run `agent-kernel architecture discover . --json`.
3. Search reuse candidates before creating a new capability.
4. Create or validate a change contract.
5. Implement only inside the approved scope.
6. Run `agent-kernel architecture check . --json`.
7. Treat only new findings as regressions; keep baseline debt visible.
8. Use scoped expiring exceptions only after review.

Do not create duplicate sources of truth, bypass reviewed interfaces, reverse dependency direction, suppress findings permanently, or block on low-confidence semantic guesses.

Canonical skill and references: `skills/architecture-guardian/`.
