# Architecture Guardian reporting

The latest report is written to:

```text
.agent-kernel/architecture/reports/latest.json
```

## Status

A report status can be:

- `passed`: no review or blocking finding requires attention
- `review`: findings exist but current mode does not block
- `failed`: strict mode found new unsuppressed blockers

## Finding classes

Reports should distinguish:

- new findings
- pre-existing baseline findings
- resolved baseline fingerprints
- active exception suppressions
- expired or invalid exceptions
- review-only semantic hints

Suppressed and baseline findings remain visible for audit.

## Evidence

A useful finding includes:

- rule ID
- severity
- confidence
- normalized files
- importer or edge evidence
- stable fingerprint
- baseline classification
- exception match when applicable

## CI use

Archive the report when required for review evidence. Do not treat a report from an earlier commit as proof for the current tree.

A report complements build, tests, lint, and typecheck. It does not replace them.
