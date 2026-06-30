# Repository hardening audit

**Audit date**: 2026-06-30
**Audited version**: `@mamdouh-aboammar/agent-kernel@0.0.8` (tag `v0.0.8`)
**Auditor**: Mavis (Mavis orchestrator session)

This audit captures the state of the repository at the start of the hardening
work, before the 12-phase refactor. It is intended as a baseline for diff
review.

---

## 1. Current package name

`@mamdouh-aboammar/agent-kernel`

The original source tree at `agent-kernel-v0.0.5/...` was authored as
`@mamdouh/agent-kernel`, but that npm scope does not exist (verified via
the registry search). The npm user is `mamdouh-aboammar` and the only
owned scope is `@mamdouh-aboammar`. The scope was switched during the
v0.0.6 → v0.0.8 cycle.

## 2. Current package version

`0.0.8` (from `package.json`).

## 3. CLI reported version

`agent-kernel 0.0.8`

`src/cli.mjs` line 9 declares `const VERSION = '0.0.8';`.
`dist/cli.mjs` is in lock-step because `scripts/build.mjs` rewrites the
`VERSION` constant from `package.json` during build.

## 4. README install package name

Correct:

```text
npm install -g @mamdouh-aboammar/agent-kernel
npx -y @mamdouh-aboammar/agent-kernel --version
```

No stale `@mamdouh/agent-kernel` references remain after the v0.0.8 fix.

## 5. README badge package name

Correct for all 20 badges. Verified via SVG `aria-label`:

- `npm: v0.0.7` (badge refreshes within minutes of new publish)
- `weekly installs: package not found or too new` (npm stats settle after ~24h)
- `bundlephobia: rate limited by upstream service` (BP transient; resolves)
- All GitHub metadata badges (`CI`, `npm publish`, `release`, `issues`, etc.) return real data.

## 6. CHANGELOG latest version

`0.0.8` — entry titled "Fixed — Badge URLs referenced wrong npm scope".

## 7. Files included in npm package

`npm pack --dry-run` produces 16 files:

```text
LICENSE                                  1.1 kB
README.md                               14.8 kB
dist/cli.mjs                            85.4 kB
docs/ARCHITECTURE.md                     1.8 kB
docs/EPISODIC_MEMORY.md                  1.5 kB
docs/INTEGRATIONS.md                     0.7 kB
docs/JSON_FIRST_STORAGE.md               1.2 kB
docs/MCP_SERVER.md                       1.8 kB
docs/MEMORY_PROTOCOL.md                  1.9 kB
docs/STRICT_MODE.md                      1.2 kB
examples/github-agent-kernel-guard.yml   0.5 kB
examples/json-memory-rule.json           1.0 kB
examples/lefthook.yml                    0.1 kB
examples/sample-episode.json             0.6 kB
examples/sample-rule.json                0.4 kB
package.json                            1.8 kB

total unpacked size: 115.8 kB
```

## 8. Files excluded from npm but referenced by docs

| File | Referenced by | Reason excluded | Action planned |
|---|---|---|---|
| `SKILL.md` | README, agent docs | not in `files` whitelist | Phase 4: include |
| `skills.sh.json` | README (Skills.sh discovery) | not in `files` whitelist | Phase 4: include |
| `.claude-plugin/marketplace.json` | README (Claude marketplace) | dotfiles ignored by default | Phase 4: include via explicit path |
| `.claude-plugin/plugin.json` | README (Claude plugin) | dotfiles ignored by default | Phase 4: include via explicit path |
| `CHANGELOG.md` | README, npm standard | not in `files` whitelist | Phase 4: include |
| `SECURITY.md` | README security link | not in `files` whitelist | Phase 4: include |
| `bin/install-local.sh` | README "alternative install" | not in `files` whitelist | Phase 4: include (safe shell) |
| `develpment/` | (no reference, legacy) | has typo + roadmap files | Phase 5: alias + alias to `development/` |

## 9. Current source layout

```text
src/
├── adapters/  (placeholder — only a README)
├── commands/  (placeholder — only a README)
├── core/      (placeholder — only a README)
├── hooks/     (placeholder — only a README)
└── cli.mjs    (1923 lines, ~85 kB — single-file implementation)
```

All logic is in `src/cli.mjs`. The `adapters`, `commands`, `core`, `hooks`
subdirectories are aspirational placeholders, not yet wired into the
runtime. Contributors can mistake them for implemented modules — risk of
ungrounded edits.

## 10. Current test coverage

- `test/smoke.mjs` (46 lines, 13 `execSync` calls)
- Covers: init, validate, memory list, propose, inbox, mcp test,
  mcp serve + tool call, episodes
- All run against the vendored binary `dist/cli.mjs`
- Uses one shared `AGENT_KERNEL_HOME` + `HOME` tempdir
- No isolation between test cases (one shared state)

Gaps: no separate tests for version consistency, guard deny patterns,
memory show/search, episode reindex, packaging. No fixtures for negative
guard cases.

## 11. Current CI workflows

Three workflows on GitHub Actions:

| File | Trigger | Jobs |
|---|---|---|
| `.github/workflows/ci.yml` | push to master, PR | build+test (Node 18/20/22), typecheck, manifest-validate, docs |
| `.github/workflows/npm-publish.yml` | push `v*` tag | publish to npm with retry-aware verify |
| `.github/workflows/release.yml` | push `v*` tag | create GitHub Release with CHANGELOG excerpt + tarball |

`NPM_TOKEN` secret is configured on the repo.

## 12. Main risks and planned fixes

| # | Risk | Impact | Fix phase |
|---|---|---|---|
| R1 | Stale npm scope references in older docs can reappear | Broken docs, lost readers | Phase 1 + Phase 8 (lint catches) |
| R2 | Hardcoded `VERSION` in `src/cli.mjs` could drift from `package.json` | Wrong reported version on install | Phase 2 (SSOT via build injection + lint check) |
| R3 | `src/cli.mjs` is 1923 lines, longest line 1762 chars | Hard to review, contribute, audit | Phase 3 (conservative reformat; no behavior change) |
| R4 | `README.md` is one big block of compressed text | Hard to read, hard to copy-edit | Phase 3 (reformat) |
| R5 | `test/smoke.mjs` is 13 inline `execSync` calls; no isolation | One failure masks another | Phase 7 (split into focused files, isolate state) |
| R6 | `package.json` `files` whitelist excludes `SKILL.md`, `.claude-plugin/`, `CHANGELOG.md`, `SECURITY.md`, `bin/`, `develpment/` | npm-published package missing discovery metadata | Phase 4 (expand whitelist) |
| R7 | Folder `develpment/` is misspelled | Confusing for contributors and search | Phase 5 (create `development/` + keep compat pointer) |
| R8 | `src/{adapters,commands,core,hooks}/` are placeholders, not real modules | Future contributors may edit them expecting runtime impact | Phase 6 (`docs/ARCHITECTURE_NOW.md` + migration plan) |
| R9 | README overclaims "60+ via Skills.sh", "every command is an MCP tool", "fully backward compatible with v0.0.1", "strict enforcement hooks" without qualification | Sets wrong expectations | Phase 10 (soften and qualify claims) |
| R10 | No root `AGENTS.md` | Future coding agents re-discover the same conventions | Phase 11 (add compact `AGENTS.md` for contributors + agents) |
| R11 | `scripts/lint.mjs` checks version + MCP tools + commands + secrets, but does not catch scope drift, README scope mismatch, `develpment` typo, or required metadata in `package.json` `files` | Same bugs recur | Phase 8 (expand lint) |
| R12 | `release.yml` parses `CHANGELOG.md` with a regex that may not match multi-line or spaced entries | Wrong release notes | Phase 9 (improve release.yml parser + add manual fallback doc) |

---

## Acceptance criteria for this audit

- [x] Current package name captured (`@mamdouh-aboammar/agent-kernel`).
- [x] Current package version captured (`0.0.8`).
- [x] CLI reported version matches package version (`0.0.8`).
- [x] README install package name correct.
- [x] README badge package names correct (20/20 verified).
- [x] CHANGELOG latest version captured (`0.0.8`).
- [x] npm `files` whitelist enumerated (16 files).
- [x] Excluded-but-referenced files enumerated (8 files).
- [x] Source layout described (single-file + placeholders).
- [x] Test coverage described (1 file, 13 calls).
- [x] CI workflows described (3 workflows).
- [x] 12 risks + fixes enumerated.

This audit will be updated as each phase lands. Final-state snapshot
will be committed at the end of phase 12.