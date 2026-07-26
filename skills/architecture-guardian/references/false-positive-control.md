# False-positive control

Architecture enforcement is safe only when detector confidence and evidence quality are explicit.

## Deterministic blockers

Good blocking candidates include:

- parsed forbidden dependency direction
- internal cycle with importer evidence
- contract scope violation
- denied external package
- expired or mismatched exception
- unapproved new dependency when policy requires approval

## Review-only findings

Normally keep these as review hints:

- semantic similarity
- abstraction quality
- naming concerns
- possible duplicate responsibility without enough evidence
- expected file or test completeness unless policy explicitly promotes them

## Confidence

Findings below `confidenceThreshold` should be omitted before reporting. Confidence must not be used to conceal weak evidence under a high severity label.

## Triage loop

1. reproduce the finding on a minimal fixture
2. inspect path, importer, symbol, and rule evidence
3. determine whether the code, policy, baseline, exception, or detector is wrong
4. add positive and negative regression fixtures
5. avoid globally suppressing one local false positive

Track false-positive rate separately from detection rate.
