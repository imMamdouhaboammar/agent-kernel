# Static Memory Dashboard Implementation Plan

## Status

Implemented on `feat/static-memory-dashboard-v2` through three test-first cycles. The final design is recorded in `docs/superpowers/specs/2026-07-14-static-memory-dashboard-design.md`.

## Goal

Add `agent-kernel dashboard`, a self-contained read-only HTML snapshot that opens locally and exposes copy-only review commands for pending records.

## Final architecture

```text
bin/agent-kernel-router.mjs
  -> bin/agent-kernel-dashboard.mjs
       -> bin/dashboard/common.mjs
       -> bin/dashboard/state.mjs
       -> bin/dashboard/render.mjs
```

The focused helper modules keep command orchestration, filesystem/browser safety, state normalization, and HTML rendering independently reviewable. The existing portability and `report` implementation remains unchanged.

## Constraints retained

- Node.js `>=18.18.0`
- zero runtime dependencies
- no server, daemon requirement, frontend build, remote API, or external asset
- read-only browser behavior limited to filtering and copying rendered text
- secret redaction and HTML escaping before output
- atomic output replacement and symlink refusal
- no manual edit to `dist/cli.mjs`
- no release, package-version bump, tag, publish, default-branch write, or merge

## Completed work

### Public contract and routing

- Added `test/public-cli-dashboard.mjs` before production implementation.
- Wired the contract through `test/smoke.mjs`.
- Added explicit router delegation for `agent-kernel dashboard` and `ak dashboard`.
- Added `--out`, `--project`, `--open`, `--no-open`, `--json`, and `--help` behavior.

### Adaptive local snapshot

- Added diagnostic-safe readers for proposal lifecycle, memories, policies, episodes, Failure Lessons, sessions, registries, commit links, updater cache, retention, audit history, and project Architecture Guardian state.
- Added derived Rules and Skill triggers sections.
- Omitted empty sections and reduced sensitive stores to bounded summaries.
- Counted malformed optional records without exposing paths.

### Static HTML renderer

- Added the Agent Kernel dark visual system and responsive layout.
- Added summary metrics, section navigation, local search, expandable metadata, status pills, and copy-only pending controls.
- Added Content Security Policy and blocked external assets and network primitives by test.
- Added HTML injection and unsafe identifier regression coverage.

### Filesystem and browser boundary

- Added atomic output replacement.
- Rejected existing symlinks, non-regular targets, and symbolic existing parent directories.
- Added platform browser selection without a shell.
- Validated injected browser arguments before creating output.
- Preserved valid HTML when the operating system browser could not open.
- Added structured JSON error envelopes for automation.

### Audit and immutability

- Appended one bounded redacted `dashboard.generate` event per successful generation.
- Verified source inbox, memory, policy, episode, registry, session, commit, updater, and config files remain byte-identical.

### Documentation

- Added `docs/STATIC_MEMORY_DASHBOARD.md`.
- Updated documentation discovery and routed-command documentation.
- Updated the approved design to match the focused module boundary.
- Remaining public architecture and README discovery are completed in the same PR before handoff.

## TDD evidence

### RED 1

The initial dashboard contract was wired before routing or implementation. CI passed non-smoke checks and failed smoke because `dashboard` did not exist.

### GREEN 1

A minimal helper, router path, static renderer, redaction, atomic output, and browser opener made the initial contract pass.

### RED 2

The contract expanded to all adaptive stores, lifecycle history, architecture summaries, malformed records, browser failures, output safety, and source immutability. Smoke failed on the missing expanded behavior.

### GREEN 2

The complete adaptive snapshot and failure-containment behavior passed the Node 18, 20, and 22 smoke matrix.

### RED 3

A dedicated safety contract required CSP, stored-HTML escaping, structured JSON failures, malformed config preservation, browser preflight, missing-project rejection, and symbolic-parent refusal.

### GREEN 3

The implementation was split into focused modules and all safety requirements passed the repository CI matrix.

## Final verification checklist

- [x] build, lint, and smoke on Node 18
- [x] build, lint, and smoke on Node 20
- [x] build, lint, and smoke on Node 22
- [x] TypeScript typecheck
- [x] manifest discipline and package dry-run
- [x] dependency audit
- [x] docs sanity
- [ ] final post-documentation CI on the exact PR head
- [ ] independent PR review
- [ ] PR body and verification handoff

The PR remains unmerged. Independent approval, release, and merging belong to a separate maintainer or coding agent.
