# Baselines

A baseline records reviewed architecture fingerprints and known finding fingerprints. It separates existing debt from regressions introduced by the current change.

## Create only after review

```bash
agent-kernel architecture discover . --json
agent-kernel architecture check . --json
agent-kernel architecture baseline . --json
```

Review the complete report before accepting it. A baseline is not an ignore file.

## Classification

After a baseline exists, findings can be classified as:

- existing and still present
- new in the current tree
- resolved since baseline
- changed evidence under the same rule

Only new unsuppressed blockers should fail strict mode.

## Update discipline

Update the baseline when the team has reviewed an intentional architecture migration or when detector behavior changes and the new evidence has been evaluated.

Do not update it automatically in CI. Do not baseline a new violation just to unblock a PR.

A comment-only or formatting change must not make old cycles appear new. Stable fingerprints and normalized paths are required for useful classification.
