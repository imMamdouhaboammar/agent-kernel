# Policy model

The project policy lives at:

```text
.agent-kernel/architecture/policy.json
```

It defines reviewed architecture expectations, not implementation suggestions.

## Deterministic controls

Policy can govern:

- source roots and ignored paths
- layer names and dependency direction
- forbidden dependency pairs
- internal cycle enforcement
- denied or allowlisted external packages
- maximum files per change
- whether a change contract is required
- confidence threshold
- severities that block in strict mode
- review or strict default mode

## Review versus strict

Review mode reports findings and exits successfully for adoption and policy tuning.

Strict mode returns a nonzero exit for new unsuppressed findings whose severity is included in `blockOn`.

A finding should not block merely because it exists. It must also be new relative to the reviewed baseline, unsuppressed, sufficiently confident, and configured as blocking.

## Policy changes

Treat policy changes as security-sensitive architecture changes. Review:

- which layer edge is being added or removed
- whether a package denial is being weakened
- whether the confidence threshold changes detector behavior
- whether contract requirements or file caps are being bypassed
- whether strict mode is being enabled before false positives are controlled

Do not change policy only to make one PR green. Fix the code, detector, or reviewed architecture decision.
