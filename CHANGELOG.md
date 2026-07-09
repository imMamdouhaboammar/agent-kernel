# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- `docs/OPERATING_MODEL.md` to explain the day-to-day Agent Kernel governance loop: propose, approve, publish, capture, search, and promote.

### Changed

- `README.md` now gives a clearer install path, safe project adoption flow, operating loop, command map, and documentation map.
- `docs/README.md` now separates first-time setup, runtime docs, integration docs, schema docs, development docs, and ownership rules.
- `docs/INTEGRATIONS.md` now recommends `agent-kernel-safe-link` and `agent-kernel-safe-git-hook` as the default adoption path for existing projects.
- `docs/SAFE_LINKING.md` now documents idempotency, duplicate marked-block cleanup, backup behavior, direct-link comparison, and what agents should not edit.

### Planned

- Modularize `src/cli.mjs` into `src/core/*` and `src/commands/*` (tracked
  in `development/BACKLOG.md`). The repo keeps a single-file CLI today
  because that fits the < 100 KB npm package budget.

## [1.0.0] — 2026-07-09

First stable release. Local-first governance kernel for AI coding agents is now considered production-ready: shared memory, rule distribution, approval inbox, episodic recall, Failure Lessons, MCP tools, Claude + git hooks, deterministic guard, and a single-file CLI under the 100 KB npm budget.

### Added

- `docs/README.md` — canonical documentation map with reading order, ownership rules, and docs-update checklist.
- Deep documentation refresh for current runtime behavior after Failure Lessons, hook hardening, and ECC bundle merges.
- Failure Lessons loop — capture build/test/edit errors with `agent-kernel failure capture`, search before retry with `agent-kernel failure search`, and promote recurring lessons to rules, policies, workflows, skills, or notes via the approval inbox.
- `safe-link` regression coverage — re-running `agent-kernel-safe-link` now replaces the marked Agent Kernel block instead of duplicating it, and pre-existing duplicate marked blocks are collapsed to a single canonical block.
- Per-module smoke orchestrator (`test/smoke.mjs`) — 16 focused test modules with isolated tempdirs and a clear pass/fail summary.
- Final-gate release checklists for package contents, helper continuity, public routing idempotency, public routing backups, public hook safety, public link safety, public bin targets, wrapper delegation, and `ak` alias safety.

### Changed

- `README.md` now explains current command surfaces, Failure Lessons, hook best practices, MCP, integrations, ECC bundle files, and the documentation map.
- `docs/ARCHITECTURE_NOW.md` now reflects the actual post-merge architecture: single-file core CLI, helper binaries, Failure Lessons, modular tests, Claude hooks, MCP, and repo-local ECC artifacts.
- `docs/MEMORY_PROTOCOL.md` now clearly separates approved memory, pending proposals, Failure Lessons evidence, generated files, and direct-edit policy.
- `docs/MCP_SERVER.md` now documents the current MCP trust model, approval boundary, tool categories, episode tools, and troubleshooting path.
- `docs/INTEGRATIONS.md` now covers Claude Code, Codex, Cursor, OpenCode, Antigravity, Gemini CLI, Skills.sh, marketplace metadata, and ECC scaffolds.
- `AGENTS.md` now gives agents updated contributor instructions for the current repo layout, Failure Lessons protocol, hook protocol, MCP protocol, release discipline, and docs alignment.

### Fixed

- `agent-kernel-safe-link` no longer duplicates the Agent Kernel marked block when a project's `AGENTS.md` already starts with the block, and pre-existing duplicate blocks are collapsed on the next run.

## [0.0.9] — 2026-07-01

### Added

- `AGENTS.md` at repo root — repo-level instructions for AI coding
  agents. Covers the single-file CLI layout, hard rules (no real code
  in `src/{adapters,commands,core,hooks}/`), version-bump discipline,
  new-command runbook, release checklist, and Skills.sh + Claude
  marketplace discovery pointers.
- `docs/ARCHITECTURE_NOW.md` — explicit "what the repo actually is
  today" doc to prevent future contributors from mistaking the
  `src/{adapters,commands,core,hooks}/` placeholder folders for
  implemented modules. Includes a runtime flow diagram, the migration
  plan, and the deliberate single-file trade-off.
- `docs/audits/REPO-HARDENING-AUDIT.md` — baseline audit capturing
  package name, version, files whitelist, source layout, CI workflows,
  and the 12 risks this hardening cycle addresses.
- `scripts/check-version.mjs` — single-source-of-truth check that
  fails if `package.json#version` differs from the `VERSION` constant
  in `src/cli.mjs` or `dist/cli.mjs`. Wired into `npm run lint`,
  `npm test`, and `npm run typecheck`.
- `scripts/lint.mjs` — expanded from 8 to 15 repository consistency
  checks. Now covers README install name, npm/bundlephobia badge
  scope, CHANGELOG latest header, `package.json#files` whitelist,
  `develpment/` → `development/` compatibility pointer, stale
  `@mamdouh/agent-kernel` references, and the hardcoded-secret scan.
- Hardened `test/smoke.mjs` — refactored into a per-module
  orchestrator that runs each focused test in isolation and reports
  a pass/fail summary. The test surface is now split into:
  - `test/init.mjs`, `test/memory.mjs`, `test/episode.mjs`,
    `test/guard.mjs`, `test/mcp.mjs`, `test/version.mjs`,
    `test/package-files.mjs`, plus `test/_lib/helpers.mjs`.
- New `CONTRIBUTING.md` content documenting manual release recovery
  (the v0.0.6 → v0.0.7 npm CDN propagation retry pattern, and how to
  re-publish if `npm-publish.yml` ever needs to be re-run).
- Why Agent Kernel Exists section in README — frames the project
  around the "every new session starts with the same problem" pain
  point and the agent-proposes → you-approve → kernel-publishes
  governance loop.

### Changed

- `.claude-plugin/marketplace.json` and `.claude-plugin/plugin.json`
  bumped to version `0.0.8` and aligned with the current Claude
  marketplace spec: `displayName: "Agent Kernel"`, expanded
  per-plugin keywords, `homepage` / `repository` moved to the
  per-plugin level (the current spec puts them there, not at
  marketplace top level).
- `SKILL.md` description expanded to surface the full skill surface
  (shared memory, approval inbox, episodic recall, MCP tools,
  hooks, deterministic guard) and to list the trigger phrases
  agents use to invoke it.
- `skills.sh.json` — groupings and `featured` field tuned so the
  Skills.sh repo page surfaces agent-kernel in both the "Memory &
  governance" and "Cross-agent rule distribution" groups.
- `README.md` hero rewritten — capitalized `Agent Kernel` (was
  lowercase `agent-kernel`), tagline swapped to "Shared memory,
  rules, and safety for every AI coding agent on your machine.",
  added an ASCII architecture diagram showing how agents → kernel
  → project files, and a rule-flow diagram showing the
  propose → approve → publish → attach loop.
- `package.json#files` whitelist expanded to include discovery and
  governance metadata: `SKILL.md`, `skills.sh.json`,
  `.claude-plugin`, `CHANGELOG.md`, `SECURITY.md`,
  `bin/install-local.sh`.
- Created canonical `development/` folder with the roadmap
  documents; kept `develpment/` as a legacy compatibility pointer.
- `CONTRIBUTING.md` — added a Manual release recovery section
  covering what to do if `npm-publish.yml` ever needs a re-run
  (CDN propagation retry pattern from v0.0.6 → v0.0.7).
- `.github/workflows/ci.yml` — aligned with the local quality
  gates: now runs `npm run lint` (which includes `check-version`)
  on every PR, not just the build job.

### Fixed

- Several long paragraphs in `README.md` and `CHANGELOG.md` broken
  into shorter lines for easier review.
- The placeholder READMEs under `src/{adapters,commands,core,hooks}/`
  rewritten to clearly say "PLACEHOLDER (planned, not implemented)"
  + "Adding files to this folder has no runtime effect" + a pointer
  to `docs/ARCHITECTURE_NOW.md` and `development/BACKLOG.md`, so
  contributors do not add real code there expecting it to be
  picked up.

### Verified (this release)

- `npx skills add imMamdouhaboammar/agent-kernel --list` returns 1
  skill ("Agent Kernel") with the full description rendered.
- `npm run lint && npm test && npm run typecheck && npm run build`
  all green locally before tag push.
- All 4 JSON manifests (marketplace.json, plugin.json, skills.sh.json,
  package.json) parse cleanly and pass the JSON schema lint.
- README badge URLs (20 total) return real data via shields.io.
- `package.json#version` and `src/cli.mjs` `VERSION` constant
  agree (enforced by `scripts/check-version.mjs`).

## [0.0.8] — 2026-06-30

### Fixed — Badge URLs referenced wrong npm scope

The README badges for `npm version`, `npm weekly downloads`, and
`bundlephobia` referenced `@mamdouh/agent-kernel` (the originally-
intended scope), but the package was actually published to the
`@mamdouh-aboammar/agent-kernel` scope (the user's actual npm user).

Result: those 3 badges displayed "invalid", "package not found or
too new", and "rate limited" respectively.

Also fixed in all docs (`CHANGELOG.md`, `SKILL.md`, `CONTRIBUTING.md`,
`SECURITY.md`, `docs/*.md`, `examples/*`):
12 references to the wrong scope across the repo.

Verified all 20 badges now return real data (16 confirmed via SVG
`aria-label`s, 2 transient upstream issues resolve within minutes/hours).

## [0.0.7] — 2026-06-30

### Changed — Cross-linking GitHub ↔ npm

- Enabled npm Provenance (`publishConfig.provenance = true`) so the
