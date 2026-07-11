# Architecture Guardian

Architecture Guardian is Agent Kernel's local architecture conformance layer. It prevents AI coding agents from creating hidden dependency drift, duplicate sources of truth, circular dependencies, and edits outside a reviewed task boundary.

## Start

```bash
agent-kernel architecture init .
# edit .agent-kernel/architecture/policy.json
agent-kernel architecture policy validate .
agent-kernel architecture baseline . --json
```

For a change:

```bash
agent-kernel architecture contract init . \
  --task "Add subscription cancellation" \
  --owner billing \
  --allow "src/billing/**,test/billing/**" \
  --tests "cancel active subscription,idempotent cancellation"

agent-kernel architecture reuse "cancel subscription" . --json
agent-kernel architecture check . --json
```

## Enforcement model

The engine separates deterministic violations from semantic review hints. New blocking violations can fail hooks and CI. Baseline violations remain visible but are not attributed to an unrelated change. Scoped exceptions require a reason, owner, and expiry.

The runtime is dependency-free and reads source files without executing them.

See `skills/architecture-guardian/references/` for policy, contract, baseline, exception, hook, evaluation, and threat-model details.
