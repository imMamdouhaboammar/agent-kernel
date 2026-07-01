# AGENTS.md — Contributor and coding-agent guide

This file is the **canonical compact guide** for humans and coding
agents working on `agent-kernel`. Read it before any non-trivial change.

## Hard rules (do not break)

1. **Never change the package name** (`@mamdouh-aboammar/agent-kernel`)
   without explicit instruction. The `@mamdouh` scope does not exist
   on npm — see `docs/audits/REPO-HARDENING-AUDIT.md` for the
   historical context.
2. **Never change the version drift contract** — `package.json#version`
   must equal `const VERSION = '...'` in `src/cli.mjs` and
   `dist/cli.mjs`. `scripts/build.mjs` injects the version from
   `package.json` automatically; `scripts/check-version.mjs` fails
   CI on drift. If you change the version, `npm run build` then
   `npm test` is the minimum to clear it.
3. **Never write to the user's real `~/.agent-kernel/` during tests.**
   `test/_lib/helpers.mjs` creates an isolated tempdir via
   `makeEnv()` — use that pattern. Anything in `test/*.mjs` that
   does not use `makeEnv()` is a bug.
4. **Never commit `node_modules/`, `audit.json`, `.env`, `package-lock.json`
   changes that are not intentional.** `npm pack --dry-run` should
   never see them; `test/package-files.mjs` enforces this.
5. **Never hand-edit the placeholder folders** `src/{adapters,commands,core,hooks}/`.
   They are not imported by `src/cli.mjs` today. Edits to them are
   no-ops. See `docs/ARCHITECTURE_NOW.md`.

## Pre-flight checklist (run before every commit)

```bash
npm install              # only if package.json changed
npm run build            # src → dist with VERSION injection
npm run lint             # 14+ repo consistency checks + check-version
npm test                 # 7 focused tests in test/*.mjs
npm run typecheck        # tsc --noEmit
```

All five must be green before pushing. If `npm test` or `npm run lint`
fails, fix the underlying issue — do not skip or `--no-verify`.

## Versioning and releases

- Bump version in `package.json` + `CHANGELOG.md` `[Unreleased]` →
  new version section.
- `scripts/build.mjs` reads `package.json#version` and substitutes
  the `const VERSION` in both `src/cli.mjs` and `dist/cli.mjs`. You
  should not edit `VERSION` directly.
- The release flow is tag-driven:
  ```bash
  git commit -am "release: v0.1.0 — <tagline>"
  git push origin master
  git tag -a v0.1.0 -m "v0.1.0 — <tagline>"
  git push origin v0.1.0
  # → .github/workflows/npm-publish.yml publishes to npm
  # → .github/workflows/release.yml creates the GitHub Release
  ```
- Manual recovery: if the auto-publish fails, run
  `npm publish --access public` locally and then
  `gh release upload v0.1.0 <tarball> --clobber` to reattach the
  tarball to the existing release.

## Adding a new command

1. Find the relevant section in `src/cli.mjs` (the file is one big
   dispatch — search for the closest existing command).
2. Add the case to the `dispatch()` function.
3. Update `--help` text near the top of the file.
4. Add a smoke check to `test/smoke.mjs` or a new
   `test/<command>.mjs` file.
5. `npm run build && npm test && npm run lint`.

## Adding a new MCP tool

- Add a new entry in the `mcp tools` block of `src/cli.mjs` and a
  matching handler in the `mcp call` dispatch.
- Add the tool name to the `mcpTools` list in
  `scripts/lint.mjs` so it is enforced.
- Add a smoke check: `mcp test` should list it.

## Tests

- Tests live in `test/*.mjs`. Each one exports `name` and `run()`.
- `test/smoke.mjs` imports them and runs them sequentially. Any
  failure exits 1.
- New tests should use `test/_lib/helpers.mjs`:
  ```js
  import { makeEnv, runCli, runCliTolerateFailure, assertContains } from './_lib/helpers.mjs';
  export async function run() {
    const { env } = makeEnv();
    const out = runCli(env, 'memory', 'list');
    assertContains(out, 'rules.json', 'memory list should mention rules.json');
  }
  export const name = 'my-test';
  ```
- Add the new test to the `tests` array in `test/smoke.mjs`.

## Repository conventions

- **Single-file CLI** — `src/cli.mjs` is intentionally one file. Do
  not split it into modules unless the maintainer opens a
  modularization epic. Track modularization work in
  `development/BACKLOG.md`.
- **Zero runtime dependencies** — `commander` was the original
  dep, now removed. The CLI must run with just Node ≥ 18.18.
  Adding a runtime dep is a major decision.
- **JSON-first memory** — `~/.agent-kernel/source/memories/*.json`
  is the source of truth. Markdown files in `dist/` are
  *generated* and must not be hand-edited (they will be
  overwritten on `agent-kernel compile`).
- **Approvals are required** — agents propose via
  `agent-kernel propose`, the user approves via
  `agent-kernel approve <id> --publish`. Do not add an env flag
  that auto-publishes without review.

## File map

| Path | Purpose |
| --- | --- |
| `src/cli.mjs` | The whole CLI. ~85 kB. |
| `dist/cli.mjs` | Identical to `src/cli.mjs` after a VERSION swap. |
| `scripts/build.mjs` | Injects `package.json#version` into `VERSION`. |
| `scripts/check-version.mjs` | SSOT check (fails on drift). |
| `scripts/lint.mjs` | 14+ repo consistency checks. |
| `test/*.mjs` | Focused tests, run by `test/smoke.mjs`. |
| `test/_lib/helpers.mjs` | Test helpers (`makeEnv`, `runCli`, etc.). |
| `docs/` | Architecture + protocol docs. |
| `docs/ARCHITECTURE_NOW.md` | Single-file architecture + migration plan. |
| `docs/audits/` | Hardening audits. |
| `development/` | Canonical roadmap (BACKLOG, EPICS, MILESTONES, SPRINT-PLAN). |
| `develpment/` | Legacy alias — kept for backward compat. |
| `examples/` | CI guard workflow, sample memory rules, sample episode. |
| `.github/workflows/` | ci.yml, npm-publish.yml, release.yml. |
| `.claude-plugin/` | Claude Code marketplace manifest. |
| `SKILL.md` | Skills.sh + Claude marketplace discovery. |
| `skills.sh.json` | Skills.sh leaderboard groupings. |
| `CHANGELOG.md` | Version history (Keep a Changelog format). |
| `AGENTS.md` | This file. |
| `CONTRIBUTING.md` | Tag-driven release flow. |
| `SECURITY.md` | Threat model + bypass reporting. |

## When in doubt

- Open a discussion before changing the package name, `prepack` script,
  the npm `files` whitelist, the GitHub workflows, the placeholder
  `src/{adapters,commands,core,hooks}/` folders, or the JSON memory layout.
- For new features, add an entry to `development/BACKLOG.md` first.
- For bugs, write a test that reproduces the bug first.