# Agent-Approved Updater Implementation Plan

## Status

Implemented on branch `feat/agent-approved-updater` through a test-first workflow. The design source is `docs/superpowers/specs/2026-07-14-agent-approved-updater-design.md`.

## Goal

Add a secure, configurable CLI updater that trusted AI agents can invoke after one-time user authorization and that surfaces cached update notices across connected agent guidance.

## Final architecture

The public router sends the `update` command family to `bin/agent-kernel-update.mjs`.

Registry access and exact-version global installation are isolated in that helper. Configuration, cache, and audit state remain under `AGENT_KERNEL_HOME`.

`bin/agent-kernel-update-guidance.mjs` is a separate offline publisher. The router invokes it after successful `update`, `init`, `compile`, `sync`, and `link` commands so cached notices survive generated-file rewrites without adding updater logic or network access to the monolithic core CLI.

The canonical `src/cli.mjs -> scripts/build.mjs -> dist/cli.mjs` pipeline remains unchanged.

## Constraints retained

- Package name is fixed to `@mamdouh-aboammar/agent-kernel`.
- Node.js support remains `>=18.18.0`.
- No runtime dependency was added.
- Agent-approved mode is disabled by default.
- Default update channel is `latest`.
- Trust and channel changes require terminal confirmation or `--yes`.
- Apply requires an explicitly allowlisted agent identity.
- Normal commands never make blocking registry requests.
- No daemon, release, publish, version bump, default-branch write, or merge is part of this work.

## Implemented files

- `bin/agent-kernel-update.mjs`
  - command parsing
  - safe channel and identity validation
  - additive config defaults
  - atomic config and cache writes
  - cache expiry
  - npm channel lookup
  - agent authorization
  - exact-version installation
  - post-install verification
  - one rollback attempt
  - bounded audit records
  - human and JSON output

- `bin/agent-kernel-update-guidance.mjs`
  - local cache and config reads only
  - bounded managed notification block
  - existing Codex, Claude, Cursor, Antigravity, and Gemini targets
  - atomic writes
  - block removal when no update is available

- `bin/agent-kernel-router.mjs`
  - `update` routing
  - cached stderr notice for non-JSON commands
  - lifecycle guidance refresh after successful operations

- `test/public-cli-update.mjs`
  - fake npm and installed-CLI executables
  - isolated Agent Kernel home
  - complete behavioral coverage without real network or global install mutation

- `test/smoke.mjs`
  - updater test registration

- `docs/UPDATES.md`
  - operator and agent runbook

- `README.md`
- `docs/README.md`
- `docs/ARCHITECTURE_NOW.md`
- `docs/public-cli/ROUTED_COMMANDS.md`
  - discovery, architecture, safety, and command reference updates

## Test-first execution

### RED

The updater contract test was added and wired before implementation.

The first useful RED run passed lint, typecheck, manifest, dependency audit, and docs checks while the smoke matrix failed because the routed updater behavior did not exist.

A prior lint failure caused by a literal secret-shaped fixture was corrected before accepting RED evidence.

### GREEN

The focused updater, router integration, guidance publisher, and test seams were implemented.

GitHub Actions CI run 547 passed:

- build, lint, and smoke on Node 18.x
- build, lint, and smoke on Node 20.x
- build, lint, and smoke on Node 22.x
- TypeScript typecheck
- manifest discipline and package dry-run
- dependency audit
- docs sanity

## Covered behavior

The smoke module verifies:

- default disabled state
- confirmation requirements
- safe dist-tags and exact semantic versions
- invalid channel rejection
- normalized trusted agent allowlists
- trust and revoke operations
- update availability checks
- cache reuse and forced refresh
- registry failure handling
- authorization before npm execution
- identity from `--agent` and `AGENT_KERNEL_AGENT_ID`
- exact target installation
- CLI version, doctor, compile, and sync verification
- verification failure and rollback
- bounded audit output without secret-shaped subprocess text
- managed guidance publication
- cached router notices
- JSON output without extra cached notice stderr

## Implementation correction

An initial attempt to inject update guidance through `scripts/build.mjs` was rejected after CI showed that extending the existing compatibility-patch generator created an unnecessarily fragile escaping boundary.

The final implementation restored the exact canonical build script blob and moved notification publication to a focused offline helper. This reduced core coupling and preserved the existing generated-file workflow.

## Remaining handoff steps

1. Run CI on the final documentation head.
2. Review the complete compare diff for scope, generated drift, secrets, and remote drift.
3. Update the pull request body with exact validation evidence and independent verification commands.
4. Mark the draft pull request ready for independent review when all final checks pass.
5. Do not merge.
