---
name: architecture-guardian
description: |
  Prevent AI coding agents from introducing architecture drift. Use before non-trivial features,
  refactors, cross-module fixes, new services, repositories, validators, state stores, dependencies,
  schema changes, public API changes, or edits governed by a change contract. Architecture Guardian
  provides bounded discovery, reuse-first search, dependency rules, reviewed baselines, short-lived
  change contracts, scoped expiring exceptions, deterministic reports, and optional strict gates.
---

# Architecture Guardian

Architecture Guardian is Agent Kernel's local conformance workflow for AI-assisted code changes. It separates existing debt from new regressions, requires reuse evidence before parallel abstractions, and keeps implementation inside a reviewed task boundary.

## Activate this skill when

- a feature spans more than one module or layer
- a refactor changes dependencies or public interfaces
- a new service, repository, adapter, hook, validator, state store, or utility is proposed
- a package, schema, migration, provider integration, or deployment boundary changes
- a change contract already exists
- the user asks to prevent architecture drift, cycles, duplicate sources of truth, or out-of-scope edits
- CI reports Architecture Guardian findings

Do not require a full contract for a trivial typo or isolated documentation correction unless project policy explicitly requires it.

## Required workflow

### 1. Read project governance

Read `AGENTS.md`, relevant agent instructions, and `.agent-kernel/architecture/policy.json` when present. Do not infer policy from a roadmap or an old report.

### 2. Validate current state

```bash
agent-kernel architecture doctor . --json
agent-kernel architecture policy validate . --json
```

If policy or stored architecture state is malformed, stop and repair the state before enforcing it.

### 3. Discover the current structure

```bash
agent-kernel architecture discover . --json
```

Use the discovered map to identify source roots, layers, internal edges, external packages, cycles, and importer evidence. Discovery reads bounded source files; it does not execute repository code.

### 4. Search reuse candidates

Before creating a capability:

```bash
agent-kernel architecture reuse "<business capability>" . --json
```

Review symbols and files with adjacent responsibility. Do not create a parallel source of truth just because an existing abstraction has a different name.

### 5. Establish the task boundary

For non-trivial work:

```bash
agent-kernel architecture contract init . \
  --task "<reviewed task>" \
  --owner "<domain or team>" \
  --allow "src/area/**,test/area/**" \
  --expect "src/area/file.ts,test/area/file.test.ts" \
  --dependencies "<new packages, if any>" \
  --tests "<observable behavior>"

agent-kernel architecture contract validate . --json
```

The contract should be narrow enough to detect drift and broad enough to complete the reviewed task. Do not silently add unrelated directories.

### 6. Implement inside scope

Keep business rules in the reviewed domain layer. Use public interfaces rather than reaching into infrastructure internals. Preserve one source of truth for each rule.

A Claude `PreToolUse` hook can enforce Write, Edit, and MultiEdit scope. Review mode reports; strict mode denies.

### 7. Check before commit

```bash
agent-kernel architecture check . --json
```

For an intentionally enforced project:

```bash
agent-kernel architecture check . --strict --json
```

Classify every finding:

- new deterministic blocker
- existing baseline debt
- covered by a valid scoped exception
- semantic review hint
- false positive that requires policy or detector correction

Do not hide a critical violation behind an aggregate score.

### 8. Close or update reviewed state

Close the contract after the task is complete:

```bash
agent-kernel architecture contract close . --json
```

Update a baseline only after reviewing existing findings. A baseline is not an ignore file.

## Hard rules

- Do not create a second source of truth without evidence that responsibilities differ.
- Do not move business rules into transport, UI, persistence, provider, or framework layers.
- Do not bypass an existing public interface to access infrastructure directly.
- Do not add a dependency outside the reviewed layer graph or active contract.
- Do not broaden a contract because implementation drifted.
- Do not suppress findings without rule, scope, reason, owner, and expiry.
- Do not treat an expired exception as authorization.
- Do not attribute baseline findings to the current change.
- Do not block on low-confidence semantic guesses; report them for review.
- Do not weaken policy to make a single PR green without user review.

## Baselines

Create a baseline only after discovery and review:

```bash
agent-kernel architecture baseline . --json
agent-kernel architecture diff . --json
```

A baseline records reviewed existing findings and package/import evidence. New blockers remain distinguishable from old debt.

## Exceptions

```bash
agent-kernel architecture exception add . \
  --rule no-cycles \
  --files "src/legacy/**" \
  --reason "Migration is split across two reviewed releases" \
  --owner platform \
  --expires "2026-12-31T00:00:00.000Z"

agent-kernel architecture exception list . --json
agent-kernel architecture exception revoke . <exception-id>
```

Exceptions must be narrow, owned, and expiring. Prefer fixing the architecture or detector over creating long-lived exemptions.

## Review and strict modes

Review mode is the adoption default. It reports candidate blockers without preventing work.

Strict mode returns a nonzero exit for new blocking violations. Enable it only after policy, baseline, contract, and exceptions are trustworthy.

The hook override is explicit:

```bash
AGENT_KERNEL_ARCHITECTURE_MODE=review agent-kernel architecture check . --json
AGENT_KERNEL_ARCHITECTURE_MODE=strict agent-kernel architecture check . --json
```

## Failure handling

When an architecture check exposes a repeated agent mistake:

```bash
agent-kernel failure capture \
  --from <agent> \
  --type architecture-failure \
  --command "agent-kernel architecture check . --strict --json" \
  --exit-code 2 \
  --text "<redacted finding>" \
  --root-cause "<supported cause>" \
  --fix "<verified correction>"
```

Promote a reusable lesson through the normal proposal and approval flow. Do not mutate policy automatically from one finding.

## Output expectations

A complete Architecture Guardian response should state:

- policy and contract state inspected
- reuse candidates considered
- files and layers changed
- new dependencies requested or rejected
- baseline versus new findings
- tests and architecture checks run
- exceptions used, including owner and expiry
- remaining review hints or limitations

## References

Read only the focused reference needed for the task:

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

Canonical docs:

- [Architecture Guardian](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/ARCHITECTURE_GUARDIAN.md)
- [Command reference](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/architecture-guardian/COMMAND_REFERENCE.md)
- [Security boundary](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/architecture-guardian/SECURITY.md)
