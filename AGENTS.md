# AGENTS.md

Instructions for AI coding agents working on or with the
`agent-kernel` repository.

## What this project is

`agent-kernel` is a local-first governance kernel for AI coding
agents. It provides:

- a shared JSON-first memory layer (rules, preferences, workflows,
  project notes, skills) at `~/.agent-kernel/source/memories/`
- an episodic memory archive at `~/.agent-kernel/episodes/`
- an approval inbox (`~/.agent-kernel/inbox/`) so agents can
  propose new rules but only the kernel publishes them
- a compiler that turns the JSON source into agent-specific
  instruction files (`AGENTS.md`, `CLAUDE.md`, `.cursor/rules/*.mdc`,
  `GEMINI.md`, etc.)
- Claude `PreToolUse` / `PostToolUse` hooks, git `pre-commit` hooks,
  and a deterministic policy guard
- MCP tools so agents can search/read/capture episodes
  directly: `agent_kernel_search_episodes`,
  `agent_kernel_read_episode`, `agent_kernel_capture_episode`,
  `agent_kernel_sync_episodes`

Read [`docs/ARCHITECTURE_NOW.md`](./docs/ARCHITECTURE_NOW.md) for the
current source layout and the explicit list of files that matter.

## Source layout (read this before editing)

```text
agent-kernel/
├── src/cli.mjs              # Source CLI — single ESM file (~85 kB)
├── dist/cli.mjs             # Built CLI (copy of src via scripts/build.mjs)
├── scripts/
│   ├── build.mjs            # copyFileSync src → dist + chmod
│   ├── lint.mjs             # MCP tool name + secret pattern sanity
│   └── check-version.mjs    # version sanity checks
├── test/smoke.mjs           # Integration smoke test
├── docs/                    # Architecture + protocol docs (read these)
├── examples/                # CI guard workflow + sample rules + sample episodes
├── development/             # Roadmap (BACKLOG, EPICS, MILESTONES, SPRINT-PLAN)
├── SKILL.md                 # Skills.sh + Claude marketplace discovery
├── .claude-plugin/          # Claude Code marketplace manifest
├── package.json             # npm metadata
└── tsconfig.json            # TypeScript config (kept for future src/**/*.ts)
```

## Hard rules — do not violate

1. **Do not add real code** to `src/adapters/`, `src/commands/`,
   `src/core/`, or `src/hooks/`. Those folders are **placeholders**
   for the planned modularization tracked in
   [`development/BACKLOG.md`](./development/BACKLOG.md). Adding
   files there today will be ignored at runtime and will mislead
   future contributors.
2. **The CLI is a single file**. All commands live in
   `src/cli.mjs`. Find the `dispatch(args)` function and add a new
   `case` there. Do not split into modules without first updating
   the modularization epic.
3. **`scripts/build.mjs` only copies**. It reads `src/cli.mjs`,
   injects `VERSION` from `package.json`, writes
   `dist/cli.mjs`, and `chmod`s it. Anything beyond that is out of
   scope.
4. **Bump the version** in `package.json` for every release. The
   `.claude-plugin/marketplace.json` and `.claude-plugin/plugin.json`
   `version` fields must move in lock-step — bump them together.
5. **Do not commit secrets**, `.env` files, `node_modules/`, or
   anything matching `DEFAULT_SECRET_PATTERNS` in `src/cli.mjs`.

## Adding a new command

1. Edit `src/cli.mjs` — find `dispatch(args)` and add a `case`.
2. Update `--help` output and the README core-commands section.
3. Add a smoke test to `test/smoke.mjs`.
4. Run `npm run build && npm test` locally before opening a PR.

## Install + verify

```bash
npm install
npm run build        # copyFileSync src/cli.mjs → dist/cli.mjs + chmod
npm test             # node scripts/check-version.mjs && node test/smoke.mjs
npm run typecheck    # tsc --noEmit
npm run lint         # node scripts/lint.mjs && node scripts/check-version.mjs
npm run size         # npm pack --dry-run (preview the published tarball)
```

## Release checklist

1. Bump `version` in `package.json`.
2. Bump `version` in `.claude-plugin/marketplace.json` and
   `.claude-plugin/plugin.json` to the same value.
3. Update `CHANGELOG.md` with the new version entry.
4. `npm test && npm run lint && npm run typecheck`.
5. Commit, push, tag (`git tag -a vX.Y.Z -m "..."`), and push the tag.
   The auto-publish workflow handles npm + GitHub release.

## Discovery (Skills.sh + Claude marketplace)

- `SKILL.md` — root Skills.sh skill (Claude Code, Codex, Cursor,
  Antigravity, Gemini CLI, +60 others via `npx skills add
  imMamdouhaboammar/agent-kernel`).
- `.claude-plugin/marketplace.json` + `.claude-plugin/plugin.json` —
  Claude Code marketplace manifests (`/plugin marketplace add
  imMamdouhaboammar/agent-kernel`).
- `skills.sh.json` — page layout for the repo on
  [skills.sh/imMamdouhaboammar/agent-kernel](https://skills.sh/imMamdouhaboammar/agent-kernel).

Keep all three in sync: when the package version moves, the plugin
manifests move, and the SKILL.md `description` reflects current
capabilities.

## When in doubt

Read [`docs/ARCHITECTURE_NOW.md`](./docs/ARCHITECTURE_NOW.md) first.
Then check [`development/BACKLOG.md`](./development/BACKLOG.md) for
planned work so you do not redo something already in flight.