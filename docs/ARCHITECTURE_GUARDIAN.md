# Architecture Guardian

Architecture Guardian is Agent Kernel's local architecture conformance layer. It prevents AI coding agents from creating hidden dependency drift, duplicate sources of truth, circular dependencies, and edits outside a reviewed task boundary.

## Start

```bash
agent-kernel architecture init .
# edit .agent-kernel/architecture/policy.json
agent-kernel architecture policy validate .
agent-kernel architecture discover . --json
# review existing findings before accepting a baseline
agent-kernel architecture baseline . --json
```

For a change:

```bash
agent-kernel architecture contract init . \
  --task "Add subscription cancellation" \
  --owner billing \
  --allow "src/billing/**,test/billing/**" \
  --expect "src/billing/cancel-subscription.ts,test/billing/cancel-subscription.test.ts" \
  --dependencies "" \
  --tests "cancel active subscription,idempotent cancellation"

agent-kernel architecture reuse "cancel subscription" . --json
agent-kernel architecture check . --json
```

Review mode is the default. It reports candidate blockers but exits successfully so a team can tune policy and baselines safely. Use strict mode for enforced local gates and CI:

```bash
agent-kernel architecture check . --strict --json
```

## Enforcement model

The engine separates deterministic violations from semantic review hints. New blocking violations fail only in strict mode. Baseline violations remain visible but are not attributed to an unrelated change. Scoped exceptions require a reason, owner, and expiry.

Architecture maps retain importer evidence for external packages. With a reviewed baseline, new packages must appear in the active contract's `allowedNewDependencies`. Expected files and required tests remain review findings unless project policy explicitly promotes their severity.

The Claude `PreToolUse` hook checks Write, Edit, and MultiEdit scope. It follows policy mode by default and accepts `AGENT_KERNEL_ARCHITECTURE_MODE=review|strict` as an explicit runtime override.

The runtime is dependency-free and reads bounded source files without executing them.

See `skills/architecture-guardian/references/` for policy, contract, baseline, exception, hook, evaluation, and threat-model details.
