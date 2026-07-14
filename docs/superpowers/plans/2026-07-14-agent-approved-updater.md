# Agent-Approved Updater Implementation Plan

## Status

Implemented on branch `feat/agent-approved-updater` through a test-first workflow. The final design is recorded in `docs/superpowers/specs/2026-07-14-agent-approved-updater-design.md`.

## Goal

Add a secure, configurable CLI updater that trusted AI agents can invoke after one-time user authorization and that surfaces update notices across connected agent guidance.

## Final architecture

The public router sends the `update` command family to `bin/agent-kernel-update.mjs`.

Registry access and exact-version global installation are isolated in that helper. Configuration, cache, and audit state remain under `AGENT_KERNEL_HOME`.

`bin/agent-kernel-update-guidance.mjs` is a separate offline publisher. The router invokes it after successful `update`, `init`, `compile`, `sync`, and `link` commands so cached notices survive generated-file rewrites without adding installation logic to the monolithic core CLI.

When agent-approved mode is enabled, the router also refreshes stale metadata before selected human lifecycle commands. This bounded check may contact npm but cannot install a package, is skipped for JSON calls, and cannot fail the requested command.

The canonical `src/cli.mjs -> scripts/build.mjs -> dist/cli.mjs` pipeline remains unchanged.

## Constraints retained

- Package name is fixed to `@mamdouh-aboammar/agent-kernel`.
- Node.js support remains `>=18.18.0`.
- No runtime dependency was added.
- Agent-approved mode is disabled by default.
- Default update channel is `latest`.
- Trust and channel changes require terminal confirmation or `--yes`.
- Governance changes require initialized, valid core config.
- Apply requires an explicitly allowlisted agent identity.
- Lifecycle refreshes never install a package and are interval-limited.
- No daemon, release, publish, version bump, default-branch write, or merge is part of this work.

## Implemented files

### Runtime

- `bin/agent-kernel-update.mjs`
  - strict config parsing and preservation
  - safe channel and identity validation
  - additive updater defaults
  - atomic config and cache writes
  - explicit and cached channel checks
  - compatible-cache preservation after outages
  - agent authorization before npm
  - exact-version global installation
  - Windows-safe command selection
  - post-install verification
  - one rollback attempt
  - separate verification and rollback audit records
  - deterministic human and JSON output

- `bin/agent-kernel-update-guidance.mjs`
  - local cache and config reads only
  - bounded managed notification block
  - existing Codex, Claude, Cursor, Antigravity, and Gemini targets
  - atomic writes
  - block removal when no update is available
  - skip-on-malformed-marker behavior

- `bin/agent-kernel-router.mjs`
  - `update` routing
  - stale metadata refresh for `doctor`, `start`, `compile`, `sync`, and `status`
  - cache interval and offline override handling
  - cached stderr notices for non-JSON commands
  - lifecycle guidance publication

### Tests

- `test/public-cli-update.mjs`
  - fake npm and installed-CLI executables
  - isolated Agent Kernel homes
  - uninitialized and malformed config coverage
  - confirmation, channel, trust, cache, outage, authorization, install, rollback, audit, guidance, and lifecycle refresh coverage
  - no real registry or global package mutation

- `test/smoke.mjs`
  - updater test registration

### Documentation

- `docs/UPDATES.md`
- `README.md`
- `docs/README.md`
- `docs/ARCHITECTURE_NOW.md`
- `docs/public-cli/ROUTED_COMMANDS.md`
- updater design and implementation records

## Test-first evidence

### RED

The updater contract test was added and wired before implementation.

The accepted RED workflow passed lint, typecheck, manifest, dependency audit, and docs checks while the Node 18, 20, and 22 smoke jobs failed because the routed updater behavior did not exist.

An earlier lint failure caused by a literal secret-shaped fixture was corrected before accepting RED evidence.

### GREEN

The helper, router integration, guidance publisher, and test seams were implemented. Subsequent CI passed the complete Node matrix and repository checks.

Review feedback then identified JSON stream, hardcoded-version, and package-spec parsing weaknesses. All were corrected with regression coverage.

A final hardening pass added:

- strict malformed-config preservation
- initialized governance requirements
- valid-cache retention after registry failure
- Windows executable selection
- verification audit events
- malformed guidance marker preservation
- interval-limited lifecycle metadata checks

## Implementation correction

An initial attempt to inject update guidance through `scripts/build.mjs` was rejected after CI showed that extending the existing compatibility-patch generator created a fragile escaping boundary.

The exact canonical build script blob was restored. Notification publication moved to the focused offline helper, reducing core coupling and preserving the existing generated-file workflow.

## Final handoff checklist

- Run the complete CI matrix on the final documentation and hardening head.
- Review the compare diff for scope, secrets, generated drift, and remote drift.
- Resolve review threads only after the final checks prove the fixes.
- Update the PR body with exact evidence and unavailable local checks.
- Mark the draft PR ready for independent review.
- Do not merge.
