# Architecture Guardian security notes

Architecture Guardian scans untrusted repository content but does not execute scanned source files.

## Protected assets

- architecture policy
- baseline and fingerprints
- active change contract
- exception store
- reports
- repository path boundary

## Controls

- project paths are normalized and kept repository-relative
- generated and dependency directories are ignored by default
- source file count and size are capped
- scanning uses bounded text extraction
- findings require evidence and confidence
- policy and exception changes remain reviewable files
- exceptions require scope, reason, owner, and expiry
- strict blocking applies only to new unsuppressed configured severities

## Main risks

- path or symlink escape
- secret leakage into evidence
- denial of service through large trees
- malicious policy weakening
- permanent broad exceptions
- unstable fingerprints
- heuristic findings presented as deterministic authority

## Operational rules

- protect policy, baseline, contract, and exceptions through normal code review
- do not auto-update baselines or exceptions in CI
- do not enable strict mode before false-positive control
- keep uncertain semantic findings review-only
- add positive and negative fixtures before increasing detector severity

## Limitations

Aliases, reflection, macros, generated code, and runtime dependency injection may not be fully modeled. Treat unsupported behavior as a known limitation, not proof that the architecture is compliant.
