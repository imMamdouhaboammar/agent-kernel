# Production remediation plan

This document tracks the production-readiness remediation pass created after the strict repository review.

It is intentionally operational. Each row maps to a GitHub issue and describes the intended fix, validation, and release risk.

---

## Agent discovery on macOS

Agent Kernel is not automatically discovered by every AI coding agent just because the repository exists on the machine.

Correct model:

1. The package must be installed or available through `npx`.
2. `agent-kernel init --sync --enforce` must run at least once on the machine.
3. `agent-kernel sync` writes user-level guidance for supported agents such as Claude, Codex, and Gemini.
4. `agent-kernel-safe-link <project>` writes project-level guidance for the current repository.
5. Agents may create pending memory proposals through the CLI or MCP. They should not silently approve or publish memory.

Expected trust boundary:

```text
agent detects durable rule or repeated failure
  -> agent creates proposal or captures evidence
  -> user reviews inbox
  -> user approves and publishes
  -> Agent Kernel compiles and syncs guidance
  -> future agents inherit the approved guidance
```

Supported public behavior after this remediation pass:

- Public `agent-kernel link --dry-run --hooks` must not write files or hooks.
- Public `agent-kernel hook pre-tool-use` blocks protected and outside-root writes before delegating to the runtime hook.
- Public `agent-kernel guard --staged` blocks protected paths before delegating to runtime guard.
- Public `agent-kernel episode ...` redacts known secret patterns from episode archive files after capture or sync.
- Public `agent-kernel start <agent>` no longer launches through a shell.

Known limitation:

- The monolithic runtime in `src/cli.mjs` still needs a direct core patch for full parity. This repository currently enforces `src/cli.mjs === dist/cli.mjs`, so core runtime changes must be made carefully and rebuilt together.

---

## Issues and fix plan

| Issue | Severity | Goal | Files | Validation | Risk |
|---|---:|---|---|---|---|
| #10 | Medium | Align core `commandLink()` with `CLAUDE.md` output | `src/cli.mjs`, `dist/cli.mjs`, direct core-link test | `node dist/cli.mjs link <project>` creates `CLAUDE.md` | Medium because `src` and `dist` must stay byte-identical |
| #11 | Medium | Make `link --dry-run --hooks` a true dry-run | `bin/agent-kernel.mjs`, `test/public-cli-safe-link.mjs` | smoke test confirms no hook writes | Low |
| #12 | High | Block protected paths in pre-commit guard path | `bin/agent-kernel.mjs`, later `src/cli.mjs` | staged `.env` is denied | Medium |
| #13 | High | Block writes outside git root | `bin/agent-kernel.mjs`, later `src/cli.mjs` | hook denies `../file` and absolute outside paths | Medium |
| #14 | Medium | Make repo secret scan match its stated coverage | `scripts/lint.mjs` | fake secret in README/workflow fails lint | Medium |
| #15 | Low | Ignore local secrets and Agent Kernel generated artifacts | `.gitignore` | `.env`, `.npmrc`, keys, backups ignored | Low |
| #16 | Low | Avoid shell launch in public `start` path | `bin/agent-kernel.mjs` | start spawns allowlisted binary directly | Low |
| #17 | High | Redact episode archive secrets | `bin/agent-kernel.mjs`, later `src/cli.mjs` and MCP path | captured/synced episodes do not retain raw known secret patterns | Medium |
| #18 | Medium | Prevent GitHub Release before npm package is visible | `.github/workflows/release.yml` | release workflow checks `npm view` before creating release | Medium |
| #19 | Medium | Add dependency audit gate | `.github/workflows/ci.yml`, `.github/workflows/npm-publish.yml` | high runtime dependency vulnerability fails CI/publish | Low |

---

## Commit sequence

| Commit | Goal | Files | Risk |
|---|---|---|---|
| 1 | Harden public CLI wrapper safety paths | `bin/agent-kernel.mjs` | Medium |
| 2 | Ignore local secrets and generated artifacts | `.gitignore` | Low |
| 3 | Expand repository secret lint coverage | `scripts/lint.mjs` | Medium |
| 4 | Add dependency audit gates | `.github/workflows/ci.yml`, `.github/workflows/npm-publish.yml` | Low |
| 5 | Gate GitHub Release on npm visibility | `.github/workflows/release.yml` | Medium |
| 6 | Add regression test for public link dry-run hooks | `test/public-cli-safe-link.mjs` | Low |
| 7 | Document remediation plan and remaining core-runtime follow-up | `docs/PRODUCTION_REMEDIATION_PLAN.md` | Low |

---

## Release-readiness checklist

Before tagging the next release:

```bash
npm install
npm run build
npm run lint
npm run typecheck
npm test
npm audit --audit-level=high --omit=dev
npm run size
npm run publish:dry
```

Required manual checks:

```bash
agent-kernel link . --dry-run --hooks
agent-kernel guard --staged
agent-kernel hook pre-tool-use < sample write payload
agent-kernel episode add --title redaction-test --text '<redacted secret fixture>'
```

Do not publish a production-grade release until the core runtime follow-up for `src/cli.mjs` / `dist/cli.mjs` parity is complete.
