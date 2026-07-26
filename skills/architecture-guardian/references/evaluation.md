# Evaluation

Architecture Guardian evaluation requires positive and negative fixtures.

## Detection cases

Include:

- forbidden layer direction
- internal cycle
- contract scope drift
- denied package
- unapproved dependency
- expired exception
- duplicate responsibility review hint

## Non-detection cases

Include:

- comments and strings that resemble imports
- approved dependency direction
- active scoped exception
- unchanged baseline debt
- allowed new dependency in the active contract
- valid worktree paths
- generated or ignored directories

## Metrics

Track separately:

- detection rate
- false-positive rate
- false-negative rate
- stable fingerprint rate
- runtime and bounded-file behavior
- cross-platform consistency

A detector that catches every violation but blocks valid work is not production-safe.
