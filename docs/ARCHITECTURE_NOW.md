# Architecture (current state)

This document describes what the repo **actually is** today, not what
it aspires to be. It exists to prevent future contributors from
mistaking placeholder folders for implemented modules.

## TL;DR

`agent-kernel` is intentionally a **single-file CLI** (`src/cli.mjs`,
~85 kB) that gets copied to `dist/cli.mjs` at build time. The
`src/{adapters,commands,core,hooks}/` folders are aspirational
placeholders — they are not yet wired into the runtime.

This is a deliberate trade-off:

- **Pro**: single-file ship keeps the npm package < 100 kB, easy to
  audit, no internal API surface to maintain, no import-resolution
  cost.
- **Con**: harder to navigate than a modular layout. Lines can run
  long when one logical section touches multiple concerns.

When the project grows beyond a comfortable single-file size, the
modularization is tracked in `development/BACKLOG.md` (item: "Modular
extraction of `src/cli.mjs`").

## Runtime flow

```text
src/cli.mjs  ── (scripts/build.mjs: VERSION injection)  ──>  dist/cli.mjs
                                                              │
                                                              ▼
                                                `agent-kernel` binary on PATH
                                                              │
                                                              ▼
                                              ~/.agent-kernel/  (memory home)
                                                  │
                                                  ├── config.json
                                                  ├── source/memories/*.json
                                                  ├── episodes/
                                                  ├── inbox/{pending,approved,rejected}/
                                                  ├── dist/  (compiled AGENTS.md, etc.)
                                                  └── logs/  (JSONL event log)
```

The CLI does five broad things:

1. **Manage memory** (`memory` command): `remember`, `list`, `search`,
   `show`, validate. Reads/writes `source/memories/*.json`.
2. **Approve workflow** (`propose`, `inbox`, `approve`, `reject`,
   `publish`): agents write to `inbox/pending/*.json`, the user
   reviews via `inbox` and moves them to `source/memories/`.
3. **Capture episodes** (`episode` command): `add`, `sync`, `search`,
   `show`, `stats`, `reindex`. Reads/writes `episodes/index.json` and
   `episodes/archive/*.json`.
4. **Compile instructions** (`compile`, `sync`, `link`): reads
   `source/memories/*.json` and writes the agent-specific
   instruction files (`AGENTS.md`, `CLAUDE.md`, `.cursor/rules/*.mdc`,
   etc.) into `dist/`.
5. **Guard** (`guard` command + `DEFAULT_DENY_COMMANDS` +
   `DEFAULT_SECRET_PATTERNS`): pattern-matches commands and file
   contents against a small deny list.

## Files that matter

| Path | Purpose |
| --- | --- |
| `src/cli.mjs` | The whole CLI. ~85 kB. |
| `dist/cli.mjs` | Identical to `src/cli.mjs` after a `VERSION` token swap. |
| `scripts/build.mjs` | Injects `package.json#version` into both `src/cli.mjs` and `dist/cli.mjs`. |
| `scripts/check-version.mjs` | SSOT check (fails CI on drift). |
| `scripts/lint.mjs` | 14 repo consistency checks (scope, version, files, secrets). |
| `test/smoke.mjs` | Smoke test exercising the top-level commands end-to-end. |
| `docs/*.md` | Architecture + protocol docs. |
| `examples/*` | CI guard workflow, sample memory rules, sample episode. |

## Files that look real but are not (placeholders)

The following directories exist in `src/` but contain **only a single
README each** explaining the future layout. **Do not edit them expecting
a runtime effect** — they are not imported by `src/cli.mjs` today.

```text
src/adapters/    (placeholder — future agent-specific adapters)
src/commands/    (placeholder — future per-command modules)
src/core/        (placeholder — future core utilities)
src/hooks/       (placeholder — future Claude hook scripts)
```

If you intend to add a new command or helper today, edit `src/cli.mjs`
directly and follow the existing dispatch pattern. Adding a file to
`src/commands/foo.mjs` will not wire it into the runtime — it will be
ignored.

## Migration plan to a modular layout

When the maintainer decides the file is large enough to split, the
target layout is:

```text
src/core/paths.mjs        — path helpers, home dir, AGENT_KERNEL_HOME
src/core/json.mjs         — JSON read/write, pretty/compact toggle
src/core/memory-store.mjs — rules/preferences/workflows JSON store
src/core/episodes.mjs     — episode archive + index
src/core/policies.mjs     — policy pack arrays
src/core/compile.mjs      — memory → AGENTS.md / CLAUDE.md / .cursor
src/core/guard.mjs        — deny patterns + secret scanner
src/core/mcp.mjs          — MCP tool registry + handler
src/commands/init.mjs     — `init` command
src/commands/memory.mjs   — `memory` subcommand
src/commands/episode.mjs  — `episode` subcommand
src/commands/mcp.mjs      — `mcp` subcommand
src/commands/guard.mjs    — `guard` command
src/commands/status.mjs   — `doctor`, `status`, `validate`, `compile`
src/cli.mjs               — entry point + dispatch
```

Until this lands, the placeholder folders above will remain empty
placeholders and editing them is a no-op.

## Tests

The smoke test (`test/smoke.mjs`) currently exercises the top-level
commands in one file with a shared `AGENT_KERNEL_HOME` tempdir. A
hardening pass splits this into focused test files (see Phase 7 in
the hardening audit).

## CI

Three GitHub Actions workflows:

- `ci.yml` — build + test + typecheck + manifest + docs on every push to `master`.
- `npm-publish.yml` — publishes to npm on every `v*` tag push, with retry-aware verify.
- `release.yml` — creates a GitHub Release with CHANGELOG excerpt + source tarball on every `v*` tag push.

`NPM_TOKEN` secret is configured on the repo.

## Repository layout (full)

See `README.md#project-layout` for the canonical layout including
`development/` (canonical roadmap) and `develpment/` (legacy alias).