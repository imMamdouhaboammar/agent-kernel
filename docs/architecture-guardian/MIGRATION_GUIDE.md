# Architecture Guardian adoption guide

Adopt Architecture Guardian in stages. The objective is trustworthy enforcement, not maximum blocking on day one.

## Stage 1: discovery only

```bash
agent-kernel architecture init .
agent-kernel architecture discover . --json
agent-kernel architecture check . --review --json
```

Review source roots, ignored paths, layer detection, package evidence, and cycles. Correct project-specific aliases or generated directories before judging findings.

## Stage 2: reviewed baseline

Inspect the complete report, then create a baseline:

```bash
agent-kernel architecture baseline . --json
```

Do not accept unknown findings merely to reduce noise.

## Stage 3: contracts on high-risk work

Require contracts first for cross-module features, new dependencies, migrations, provider changes, and public API changes.
Practice scope changes through review. Avoid a policy that requires contracts for trivial typo fixes unless the team intentionally wants that cost.

## Stage 4: review-mode CI

Run architecture checks in CI but do not block. Archive reports and measure false positives.

## Stage 5: selected strict rules

Promote deterministic rules with strong evidence, such as forbidden layer direction, cycles, denied packages, and contract scope.

## Stage 6: protected gate

Require strict CI only after:

- baseline is reviewed
- false-positive rate is acceptable
- exception ownership is defined
- developers understand contract workflow
- report fingerprints are stable

Never auto-update baselines or create exceptions in CI.
