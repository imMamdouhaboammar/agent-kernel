# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- `docs/audits/REPO-HARDENING-AUDIT.md` — baseline audit capturing package
  name, version, files whitelist, source layout, CI workflows, and the
  12 risks this hardening cycle addresses.
- `scripts/check-version.mjs` — single-source-of-truth check that fails
  if `package.json#version` differs from the `VERSION` constant in
  `src/cli.mjs` or `dist/cli.mjs`. Run via `npm run check-version`.
- `scripts/lint.mjs` — expanded from 8 to 14 repository consistency
  checks. Now also covers README install name, npm/bundlephobia badge
  scope, CHANGELOG latest header, `package.json#files` whitelist,
  `develpment/` → `development/` compatibility pointer, and stale
  `@mamdouh/agent-kernel` references in active docs.
- `npm run lint` now also runs `check-version`.
- `npm test` now also runs `check-version` (fails on future drift).

### Changed

- `package.json#files` whitelist expanded to include discovery and
  governance metadata: `SKILL.md`, `skills.sh.json`, `.claude-plugin`,
  `CHANGELOG.md`, `SECURITY.md`, `bin/install-local.sh`.
- Created canonical `development/` folder with the roadmap documents;
  kept `develpment/` as a legacy compatibility pointer.
- `README.md` re-formatted for readability and re-written to soften
  several overclaims (Skills.sh "60+", "every command is an MCP tool",
  "fully backward compatible with v0.0.1", "rule auto-attaches").
- README now includes a quick-verify section, security caveats, and
  a complete project-layout tree.

### Fixed

- Several long paragraphs in `README.md` and `CHANGELOG.md` broken into
  shorter lines for easier review.

### Planned

- Modularize `src/cli.mjs` into `src/core/*` and `src/commands/*` (tracked
  in `development/BACKLOG.md`). The repo keeps a single-file CLI today
  because that fits the < 100 KB npm package budget.

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
  npm package page shows the verified GitHub Actions build source.
- Added `funding` field (GitHub Sponsors link).
- Updated GitHub repo homepage URL to point at the npm package page.
- Updated GitHub repo description to mention npm package name.
- Added 6 GitHub topics for discoverability:
  `agentic-coding`, `claude-code`, `governance`, `mcp`, `memory`, `npm`.

### Verified (this release)

- `agent-kernel` is in the user's npm profile (15 packages total).
- `npm view @mamdouh-aboammar/agent-kernel` shows:
  - `homepage` → GitHub repo
  - `repository.url` → `git+https://github.com/imMamdouhaboammar/agent-kernel.git`
  - `bugs.url` → GitHub issues
  - `author.url` → GitHub profile
  - `gitHead` → exact commit SHA at publish time
- GitHub repo About section now links to npm package page.

## [0.0.6] — 2026-06-30

### Added — Standalone OSS release with full CI/CD infrastructure

The agent-kernel project is now a standalone OSS package with
auto-publish and auto-release workflows. The npm scope switched from
the unowned `@mamdouh` to the user-owned `@mamdouh-aboammar` (the
only npm scope this user has access to).

**What changed since v0.0.5:**

- Renamed npm package to `@mamdouh-aboammar/agent-kernel` (matches npm user).
- Fixed `tsconfig.json` so `tsc --noEmit` finds the bundled `.mjs`
  source (`include: ["src/**/*"]` + `allowJs: true`).
- Added `scripts/lint.mjs` — sanity linter for command surface,
  MCP tool names, secret patterns, deny commands, version consistency.
- Added `scripts.lint` + `scripts.size` + `scripts.publish:dry` +
  `scripts.prepack` to `package.json`.
- Added comprehensive CI matrix:
  - `build-and-test` (Node 18/20/22, smoke tests).
  - `typecheck` (tsc --noEmit).
  - `manifest-validate` (SKILL.md, marketplace.json, plugin.json,
    skills.sh.json).
  - `docs` (README, CHANGELOG, LICENSE, docs/ count).
- Added auto-publish workflow (`.github/workflows/npm-publish.yml`).
  - Triggers on `v*` tag push.
  - Verifies package version matches tag.
  - Publishes to npm with provenance.
  - Manual `workflow_dispatch` for dry-run testing.
- Added auto-release workflow (`.github/workflows/release.yml`).
  - Triggers on `v*` tag push.
  - Parses `CHANGELOG.md` for structured release notes.
  - Creates GitHub Release + attaches source tarball via `gh release upload`.
- Added `SKILL.md` at root for Skills.sh discovery.
- Added `.claude-plugin/marketplace.json` + `.claude-plugin/plugin.json`
  for Claude Code marketplace.
- Added `skills.sh.json` for Skills.sh leaderboard groupings.
- Added issue templates (bug, feature, question) + PR template.
- Added `CONTRIBUTING.md` with tag-driven release flow.
- Added `SECURITY.md` with threat model + bypass reporting.
- Polished `README.md` with 4-section badge layout
  (Install / Status / Quality / Ecosystem / Stack).
- `publishConfig.provenance = false` (OIDC requires GH Actions only).

**Verified:**

- `npm run typecheck && npm test && npm run lint && npm run build` → all green.
- `@mamdouh-aboammar/agent-kernel@0.0.5` published manually (CDN propagation).
- Both `agent-kernel` and `ak` binaries work after install.
- `agent-kernel doctor` runs and reports kernel state correctly.

## [0.0.5] — 2026-06-30

### Added — Initial standalone OSS release

`agent-kernel` is now a standalone npm package + GitHub repo with
auto-publish + auto-release infrastructure.

**What ships in v0.0.5:**

- `agent-kernel` / `ak` CLI — single 85 KB ESM file at `dist/cli.mjs`.
- JSON-first shared memory at `~/.agent-kernel/source/memories/*.json`
  (rules / preferences / workflows / project-notes / skills).
- Episodic memory archive at `~/.agent-kernel/episodes/`
  (add / sync / search / show / stats / reindex).
- Approval inbox at `~/.agent-kernel/inbox/{pending,approved,rejected}/`.
- Generated instruction files for every agent: `AGENTS.md`,
  `CLAUDE.md`, `.cursor/rules/00-agent-kernel.mdc`,
  `.agents/agents.md`, `GEMINI.md`.
- Claude `PreToolUse` + `PostToolUse` hooks, git `pre-commit`,
  deterministic policy guard.
- MCP tools: `agent_kernel_search_episodes`, `agent_kernel_read_episode`,
  `agent_kernel_capture_episode`, `agent_kernel_sync_episodes`.
- 8 architecture + protocol docs in `docs/`.
- Backward compatibility with v0.0.1 flat file layout
  (`agent-kernel migrate json`).

**OSS packaging (this release):**

- npm package `@mamdouh-aboammar/agent-kernel@0.0.5` — published via
  auto-publish workflow.
- GitHub release auto-created on tag push (`release.yml`).
- npm publish auto-triggered on tag push (`npm-publish.yml`).
- CI matrix: Node 18.x / 20.x / 22.x (`build-and-test` job).
- Manifest validation: SKILL.md frontmatter, `marketplace.json`,
  `plugin.json`, `skills.sh.json` (`manifest-validate` job).
- TypeScript typecheck (`typecheck` job).
- Docs sanity (README / CHANGELOG / LICENSE + `docs/` count).
- Skills.sh discovery: `SKILL.md` at root + `skills.sh.json`.
- Claude Code marketplace: `.claude-plugin/marketplace.json` + `plugin.json`.
- README badges (npm version, CI, license, node engine, Skills.sh,
  downloads).

## [0.0.4] — 2026-06-30

### Added

- Added `/develpment/` backlog directory requested by the project owner.
  (See "Unreleased" above — this typo path is now aliased to
  `development/`.)
- Added `develpment/BACKLOG.md` with roadmap from `v0.1` to `v2.0`.
- Added `develpment/EPICS.md` grouped by product epic.
- Added `develpment/MILESTONES.md` with release targets.
- Added `develpment/SPRINT-PLAN.md` for the immediate `v0.1.0` sprint.
- Added `develpment/RELEASE-GATES.md` for packaging and quality checks.
- Added `develpment/backlog.json` as a machine-readable roadmap for
  agents and automation.

### Changed

- Bumped package version to `0.0.4`.
- Added `develpment` to the npm package `files` list.

## [0.0.3] — 2026-06-30

### Added

- Added JSON-first memory storage under `source/memories/`.
- Added generated JSON Schema files under `source/schemas/`.
- Added policy pack folder under `source/policies/`.
- Added `agent-kernel validate`.
- Added `agent-kernel migrate json`.
- Added `agent-kernel memory list`, `memory search`, and `memory show`.
- Added backward compatibility for v0.0.1 flat source files.
- Added JSON-first documentation and sample memory rule.
- Expanded smoke tests for JSON-first layout.

## [0.0.1] — 2026-06-30

### Added

- Initial local Agent Kernel CLI.
- Shared rules compilation to `AGENTS.md`, `CLAUDE.md`, Cursor,
  Antigravity, and Gemini files.
- Approval inbox for agent-proposed memories.
- Claude hook installation.
- Guard scanner and pre-commit hook support.