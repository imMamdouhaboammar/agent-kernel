# Threat model

Architecture Guardian reads untrusted repository content but does not execute scanned source files.

## Assets

- reviewed policy
- baseline and finding fingerprints
- active change contract
- exception store
- conformance reports
- repository source and import evidence

## Threats

- path traversal through project or file inputs
- symlink escape from the repository boundary
- secret leakage into reports
- denial of service through huge trees or files
- malicious policy weakening
- broad or non-expiring exceptions
- unstable fingerprints that misclassify baseline debt
- heuristic findings presented as deterministic authority
- generated code or aliases that mislead dependency extraction

## Mitigations

- repository-relative normalized paths
- file-count and file-size caps
- ignored generated and dependency directories
- local JSON storage
- reviewed policy and exception changes
- confidence thresholds
- deterministic evidence for blockers
- separate baseline classification
- no repository code execution
- focused positive and negative fixtures

## Residual risk

Regex-based extraction cannot model every language or framework. Treat unsupported aliasing, reflection, macros, generated code, and runtime dependency injection as known limitations, not proof of compliance.
