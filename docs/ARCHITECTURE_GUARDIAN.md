# Architecture Guardian

Architecture Guardian is Agent Kernel's local architecture conformance layer. It helps coding agents change a repository without silently introducing dependency drift, cycles, duplicate sources of truth, unreviewed packages, or edits outside a task boundary.

## What it does

- discovers source roots, symbols, imports, layers, packages, and cycles
- searches reuse candidates before a new capability is created
- validates project architecture policy
- stores a reviewed baseline of existing debt
- creates short-lived change contracts
- checks scope, dependency direction, packages, cycles, and file limits
- manages scoped expiring exceptions
- emits deterministic JSON reports
- supports review and strict modes
- provides a narrow Claude pre-write scope hook

It reads bounded source text and does not execute repository code.

## State layout

```text
<project>/.agent-kernel/architecture/
  policy.json
  current-map.json
  baseline.json
  change-contract.json
  exceptions.json
  reports/latest.json
```

These files are reviewable governance state. Do not mutate them silently to make a check pass.

## Initial adoption

```bash
agent-kernel architecture init .
agent-kernel architecture policy validate . --json
agent-kernel architecture doctor . --json
agent-kernel architecture discover . --json
agent-kernel architecture check . --json
```

Start in review mode. Inspect findings before creating a baseline.

```bash
agent-kernel architecture baseline . --json
```

A baseline records reviewed existing debt. It is not a blanket ignore file.

## Non-trivial change workflow

### Discover

```bash
agent-kernel architecture doctor . --json
agent-kernel architecture discover . --json
```

Review source roots, layers, edges, cycles, package importers, and current findings.

### Search reuse

```bash
agent-kernel architecture reuse "cancel subscription" . --json
```

Search by business responsibility. A different class name does not prove a different responsibility.

### Create a contract

```bash
agent-kernel architecture contract init . \
  --task "Add subscription cancellation" \
  --owner billing \
  --allow "src/billing/**,test/billing/**" \
  --expect "src/billing/cancel-subscription.ts,test/billing/cancel-subscription.test.ts" \
  --dependencies "" \
  --tests "cancel active subscription,idempotent cancellation"

agent-kernel architecture contract validate . --json
```

Contracts are short-lived implementation boundaries. Expand them through review, not after an out-of-scope edit.

### Check

```bash
agent-kernel architecture check . --json
agent-kernel architecture check . --strict --json
```

Strict mode should be enabled only after policy, baseline, contract, and exceptions are trustworthy.

### Close

```bash
agent-kernel architecture contract close . --json
```

## Finding classification

A report may include:

- new deterministic blocker
- unchanged baseline debt
- resolved baseline finding
- valid active exception
- expired or mismatched exception
- semantic review hint
- detector or policy defect

Only new unsuppressed findings configured as blocking should fail strict mode.

## Deterministic checks

Deterministic checks can include forbidden layer direction, forbidden dependency pairs, internal cycles, denied or unapproved packages, contract scope drift, maximum file count, invalid governance state, and expired exceptions.

Semantic similarity, naming, abstraction quality, and possible duplicate responsibility normally remain review hints unless evidence is strong and policy explicitly promotes them.

## Baselines

```bash
agent-kernel architecture baseline . --json
agent-kernel architecture diff . --json
```

Update a baseline only after reviewing an intentional migration or detector change. Never auto-update it in CI.
Stable finding fingerprints prevent a comment-only change from turning old debt into a new blocker.

## Exceptions

```bash
agent-kernel architecture exception add . \
  --rule no-cycles \
  --files "src/legacy/**" \
  --reason "Reviewed two-release migration" \
  --owner platform \
  --expires "2026-12-31T00:00:00.000Z"

agent-kernel architecture exception list . --json
agent-kernel architecture exception revoke . <exception-id>
```

Every exception needs a narrow scope, reason, owner, and expiry. Suppressed findings remain visible.

## Hook behavior

`agent-kernel-architecture-hook` supports a narrow Claude `PreToolUse` scope check for Write, Edit, and MultiEdit.

```bash
AGENT_KERNEL_ARCHITECTURE_MODE=review agent-kernel-architecture-hook
AGENT_KERNEL_ARCHITECTURE_MODE=strict agent-kernel-architecture-hook
```

The hook checks path scope before a write. It cannot validate future imports or cycles before content exists. Run `architecture check` after writing.

Hooks must not modify policy, baseline, contract, or exceptions.

## Language support

The scanner recognizes JavaScript, TypeScript, Python, Go, Java, Ruby, PHP, C#, Rust, Kotlin, and Swift source files.

Relative JavaScript and TypeScript dependency resolution is strongest. Repository aliases, reflection, macros, generated code, and framework dependency injection may require explicit policy or future adapters.

Do not treat uncertain semantic extraction as deterministic proof.

## CI adoption

```bash
agent-kernel architecture policy validate . --json
agent-kernel architecture contract validate . --json
agent-kernel architecture check . --base origin/master --strict --json
npm run build
npm run lint
npm run typecheck
npm test
```

Adopt in stages: local review, review-mode CI, strict selected rules, then a required protected-branch gate after false-positive control.

Archive `.agent-kernel/architecture/reports/latest.json` when CI evidence is needed. Do not create exceptions or update baselines automatically.

## Security boundary

Primary risks include path or symlink escape, secret leakage, huge repositories, malicious policy weakening, broad exceptions, unstable fingerprints, and heuristic overreach.

Mitigations include normalized repository-relative paths, bounded files, ignored generated directories, no source execution, confidence gates, reviewed policy changes, and explicit expiring exceptions.

## Completion evidence

A useful completion summary states:

- policy and contract inspected
- reuse candidates reviewed
- files and layers changed
- new dependencies requested or rejected
- architecture check result
- baseline versus new findings
- exceptions used, with owner and expiry
- functional tests run
- remaining review hints

## References

- `architecture-guardian/COMMAND_REFERENCE.md`
- `architecture-guardian/MIGRATION_GUIDE.md`
- `architecture-guardian/REPORTING.md`
- `architecture-guardian/SECURITY.md`
- `../skills/architecture-guardian/SKILL.md`
- `../skills/architecture-guardian/references/`
