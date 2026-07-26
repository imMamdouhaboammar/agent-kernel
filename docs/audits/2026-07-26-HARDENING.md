# Hardening review: 2026-07-26

## Scope

This review covered the local working-tree diff for Agent Kernel `1.15.1`, with emphasis on filesystem boundaries, daemon exposure, command execution, provider configuration, CI permissions, and release integrity.

## Validated findings fixed

1. File-backed identifiers could be interpreted as relative paths in several session, proposal, episode, commit-link, identity-filter, and file-record routes. Central validation now rejects path-like identifiers before read, write, rename, or append operations.
2. The daemon could be deliberately bound remotely without an authentication requirement. Remote mode now requires explicit opt-in and a bearer token of at least 32 bytes.
3. Daemon requests had no explicit body ceiling. Requests over 1 MiB now fail with `413` and malformed URLs fail closed.
4. A GCloud profile read from project configuration could escape its Agent Kernel configuration directory. Provider profile names are now validated before path and credential use.
5. One CLI launch path used `shell: true`. Child processes now receive executable and argument arrays without shell interpolation.
6. CI contained redundant, obsolete, or over-privileged workflows. The maintained set is reduced to seven purpose-specific workflows with SHA-pinned actions and least-privilege permissions.
7. npm and GitHub Packages release paths conflicted because the npm scope differs from the repository owner. npmjs is now the single package registry target.

## Regression coverage

Focused negative tests reproduce and prevent each validated traversal or authentication issue. The complete smoke suite contains 46 tests and covers daemon, session, commit-link, identity, file-reference, provider, Windows, update, package, documentation, and architecture surfaces.

## Release evidence

- build: passed
- lint and version consistency: passed
- typecheck: passed
- smoke tests: 46 passed, 0 failed
- runtime dependency audit: 0 vulnerabilities
- package dry run: passed
- package size: 381.6 kB compressed and 1.4 MB unpacked
- clean tarball installation: passed; all primary binaries executable
- Node 18.20.8: 46 passed, 0 failed
- Node 20.20.2: 46 passed, 0 failed
- Node 22.23.1: 46 passed, 0 failed
- npm registry precondition: `1.15.1` not previously published
- trusted-publisher administration: current publish credential returned `403`; OIDC-first workflow retains a temporary one-command token fallback

## Residual trust assumptions

Processes running as the same operating-system user can access local Agent Kernel state. Remote daemon security depends on network placement and token confidentiality. External compromises of npm, GitHub, Node.js, the host operating system, or configured providers remain outside the application boundary.

## Release decision

The local diff is eligible for protected-branch review as `1.15.1`. Publication remains contingent on successful GitHub Actions checks, merge to `master`, tag verification, npm provenance, and GitHub Release checksum verification.
