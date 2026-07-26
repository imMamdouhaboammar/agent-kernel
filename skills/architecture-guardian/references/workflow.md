# Workflow

Architecture Guardian uses a closed control loop:

```text
understand -> validate state -> map -> search reuse -> declare scope
  -> implement -> compare -> classify -> report -> learn
```

## Before design

1. Read repository instructions and `.agent-kernel/architecture/policy.json`.
2. Run `agent-kernel architecture doctor . --json`.
3. Run `agent-kernel architecture discover . --json`.
4. Review source roots, layers, internal edges, external packages, cycles, and current findings.

Do not design from file names alone. Use the discovered import graph and public interfaces.

## Before creating a capability

```bash
agent-kernel architecture reuse "<business responsibility>" . --json
```

Search by responsibility, not only the proposed class or function name. Review adjacent symbols, files, and integration boundaries.

## Before writing

For non-trivial work, create or validate a change contract. The contract should name the task, owner, allowed files, expected files, approved new dependencies, and required tests.

The contract is an execution boundary, not a permanent architecture document.

## During implementation

- keep edits inside allowed patterns
- preserve one source of truth per business rule
- use public interfaces across layers
- record newly required dependencies in the reviewed contract
- do not broaden the contract because implementation drifted

## Before commit

```bash
agent-kernel architecture check . --json
```

Classify findings as new blockers, baseline debt, valid exceptions, semantic review hints, or detector defects.

A completion statement should cite the current report and the tests run. A stale report is not evidence for the current tree.

## After repeated failure

Capture a Failure Lesson, then propose durable guidance through the normal review flow. Do not mutate architecture policy automatically from one failure.
