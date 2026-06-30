# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.0.5] — 2026-06-30

### Added — Initial standalone OSS release

`agent-kernel` is now a standalone npm package + GitHub repo with
auto-publish + auto-release infrastructure.

**What ships in 0.0.5:**

- `agent-kernel` / `ak` CLI — single 85 KB ESM file at `dist/cli.mjs`
- JSON-first shared memory at `~/.agent-kernel/source/memories/*.json`
  (rules / preferences / workflows / project-notes / skills)
- Episodic memory archive at `~/.agent-kernel/episodes/` (add / sync / search / show / stats / reindex)
- Approval inbox at `~/.agent-kernel/inbox/{pending,approved,rejected}/`
- Generated instruction files for every agent: `AGENTS.md`, `CLAUDE.md`,
  `.cursor/rules/00-agent-kernel.mdc`, `.agents/agents.md`, `GEMINI.md`
- Claude `PreToolUse` + `PostToolUse` hooks, git `pre-commit`, deterministic policy guard
- MCP tools: `agent_kernel_search_episodes`, `agent_kernel_read_episode`,
  `agent_kernel_capture_episode`, `agent_kernel_sync_episodes`
- 8 architecture + protocol docs in `docs/`
- Backward compatibility with v0.0.1 flat file layout (`agent-kernel migrate json`)

**OSS packaging (this release):**

- npm package `@mamdouh/agent-kernel@0.0.5` — published via auto-publish workflow
- GitHub release auto-created on tag push (release.yml)
- npm publish auto-triggered on tag push (npm-publish.yml)
- CI matrix: Node 18.x / 20.x / 22.x (build-and-test job)
- Manifest validation: SKILL.md frontmatter, marketplace.json, plugin.json,
  skills.sh.json (manifest-validate job)
- TypeScript typecheck (typecheck job)
- Docs sanity (README/CHANGELOG/LICENSE + docs/ count)
- Skills.sh discovery: SKILL.md at root + skills.sh.json
- Claude Code marketplace: `.claude-plugin/marketplace.json` + `plugin.json`
- README badges (npm version, CI, license, node engine, Skills.sh, downloads)

## [0.0.4] — 2026-06-30

### Added
- Added `/develpment/` backlog directory requested by the project owner
- Added `develpment/BACKLOG.md` with roadmap from `v0.1` to `v2.0`
- Added `develpment/EPICS.md` grouped by product epic
- Added `develpment/MILESTONES.md` with release targets
- Added `develpment/SPRINT-PLAN.md` for the immediate `v0.1.0` sprint
- Added `develpment/RELEASE-GATES.md` for packaging and quality checks
- Added `develpment/backlog.json` as a machine-readable roadmap for agents and automation

### Changed
- Bumped package version to `0.0.4`
- Added `develpment` to the npm package `files` list

## [0.0.3] — 2026-06-30

- Added JSON-first memory storage under `source/memories/`
- Added generated JSON Schema files under `source/schemas/`
- Added policy pack folder under `source/policies/`
- Added `agent-kernel validate`
- Added `agent-kernel migrate json`
- Added `agent-kernel memory list`, `memory search`, and `memory show`
- Added backward compatibility for v0.0.1 flat source files
- Added JSON-first documentation and sample memory rule
- Expanded smoke tests for JSON-first layout

## [0.0.1] — 2026-06-30

- Initial local Agent Kernel CLI
- Shared rules compilation to `AGENTS.md`, `CLAUDE.md`, Cursor, Antigravity, and Gemini files
- Approval inbox for agent-proposed memories
- Claude hook installation
- Guard scanner and pre-commit hook support