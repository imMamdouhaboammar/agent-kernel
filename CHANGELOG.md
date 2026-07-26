# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [1.15.0] - 2026-07-26

### Fixed

- Hardened Project Context Broker entrypoint and Windows command execution boundaries.
- Dereferenced executable and module paths before platform wrapper checks.
- Bound Windows provider execution to exact trusted launcher files (`.cmd`, `.bat`).
- Implemented ephemeral trampoline scripts for safe batch argument passing.
- Synchronized Node builtin ESM child-process exports with the compatibility boundary.

## [1.14.0] - 2026-07-24

### Added

- Added Project Connection CLI suite (`connect`, `disconnect`, `status`, `doctor`, `reconnect`).
- Added IssueOps Validator workflow (`issue-validator.yml`) with `issue-ops/validator@v4.0.0`.
- Added Codacy Security Scan workflow (`codacy.yml`) with SARIF output and automated GitHub Issue creation.
- Added Kilo Code Bot workflow (`kilo-code-bot.yml`) for issue classification and fix proposals.
- Added Lovable.dev AI Developer workflow (`lovable-dev.yml`) for OSS feature contributions.
- Added CodeRabbit AI Final Review Gate workflow (`coderabbit.yml` & `.coderabbit.yaml`) for pre-merge gating.
- Added Privacy & Dynamic Path Verification script (`check-privacy-and-paths.mjs`) to prevent machine footprint or secret leaks.

### Fixed

- Supported cross-platform Windows executable extension lookup (`.cmd`, `.exe`, `.bat`) in `project-context-broker`.

- Added a project-scoped production provider approval lifecycle: `approvals request`, `list`, `approve`, `deny`, and `revoke`, with JSON output and bounded 1-60 minute TTLs.
- Added one-time approval consumption for production Supabase database writes/migrations and GCloud operations.
- Added project-scoped provider audit inspection through `audit list`/`audit tail` and validated `context enter`/`context switch` JSON workflows.

### Fixed

- Enforced manifest-bound Supabase and GCloud targets even when callers pass conflicting split-form or `--flag=value` overrides.
- Made provider shims and `env exec` fail closed when a child executable cannot start, instead of returning a false success.
- Made provider executable discovery use platform-aware PATH separators, skip non-executable decoys, and removed the external `sleep` dependency from lock retries.
- Removed the provider command separator before invoking the underlying CLI and restored linked-worktree branch drift enforcement.
- Kept the dashboard Retention section hidden for projects with no runtime state or raw session logs.
- Classified Supabase database writes, migrations, and GCloud deployments explicitly; unknown Supabase commands now fail closed as sensitive operations instead of defaulting to read-only.
- Required mapped capabilities and sensitive environment risk metadata to be explicitly configured instead of allowing missing values.
- Made routed broker command families fail nonzero for unknown or unsupported subcommands instead of printing help with a false success.
- Bound active context sessions to the current manifest project and declared environment before writing owner-only session state.

### Security

- Serialized provider audit appends with stale-lock recovery, enforced owner-only audit permissions, and redacted recognized secret values before persistence.
- Blocked GCloud caller overrides for configuration, account, service-account impersonation, billing project, project, and region.
- Made production approvals project/environment/provider/operation scoped, owner-only, auditable, secret-redacted, single-use, resistant to malformed-state overwrite, and non-stackable while an active request exists.

## [1.13.0] - 2026-07-21

This release ships the **Agent Kernel Project Connection Command Suite** (`connect`, `disconnect`, `reconnect`, `status`, `doctor`) with native Bun first-class support.

### Added

- **First-Class Project Connection Suite**:
  - `agent-kernel project connect`: Connects any repository securely and idempotently to the global Agent Kernel runtime.
  - `agent-kernel project disconnect`: Gracefully removes global project registration and managed instruction adapters.
  - `agent-kernel project status`: Displays real-time connection state, provider bindings, and diagnostic readiness.
  - `agent-kernel project doctor`: Runs 15+ integrity diagnostics on project configuration, managed blocks, and global registration with `--fix` support.
  - `agent-kernel project reconnect`: Repairs missing adapters, stale registrations, or broken `.gitignore` blocks.
  - Direct CLI shortcuts: `agent-kernel connect` and `agent-kernel disconnect`.
- **First-Class Bun Support**: Full support for Bun for scripts, execution (`bunx`), lockfiles (`bun.lock`), and test runners.
- **Marker-Based Root Resolution**: Intelligently resolves project roots searching for `.git`, `package.json`, `bun.lock`, `pyproject.toml`, `Cargo.toml`, etc.
- **Managed Instruction Adapters**: Injects delimited instructions inside `CLAUDE.md` and `AGENTS.md` without overwriting user content.
- **Process-Safe File Locking**: Prevents race conditions during concurrent global registry writes using atomic mutex directory locking.
- **Comprehensive Documentation**: Added [`docs/PROJECT_CONNECTION.md`](./docs/PROJECT_CONNECTION.md).

## [1.12.0] - 2026-07-21

This release ships the **Agent Kernel Project Context Broker** — a secure, local-first environments controller, identity lock, and credential manager for development workspaces.

### Added

- **Project Context Broker Command Suite**: Commands for initialization, credentials configuration, and workspace status validations.
- **macOS Keychain Services API**: Full integration with the macOS system keychain using native security APIs.
- **Multistage Policy Gates**: Gating mechanics for repository-matching, git branches drift, environment classification, and role capability permissions.
- **Automatic PATH-injected Command Shims**: Secure interception shims loaded transparently in the runtime path.

### Fixed

- Improved router intercept logic to perfectly preserve existing registries and context command families.



## [1.11.0] - 2026-07-14

This release ships the **static local memory dashboard** — a
self-contained, read-only HTML snapshot of the agent-kernel
home, generated locally and opened in the user's default
browser. The dashboard is the first Agent Kernel feature that
intentionally produces a portable artifact (a single HTML file
no larger than ~35 KiB).

### Added

- **`agent-kernel dashboard` command family.** New public router
  commands routed through `bin/agent-kernel-dashboard.mjs`:
  - `dashboard`                — generate the static snapshot at
                                `~/.agent-kernel/reports/dashboard.html`
                                and open it in the user's default browser
  - `dashboard --out <path>`   — write to a custom path (validated for
                                unsafe targets, symbolic parents, and
                                non-regular files)
  - `dashboard --project <p>`  — point the renderer at a project other
                                than the cwd
  - `dashboard --no-open`      — generate without launching a browser
  - `dashboard --open`         — force-launch even when `--json` is set
  - `dashboard --json`         — emit a JSON envelope
                                (`{ ok, path, generatedAt, opened, sections, scripts }`)
- **Sections rendered in v1.11.0:**
  Approved proposals, durable memories, rules, policies, agents,
  update status, retention, audit summary. Each section is
  adaptive: empty stores stay hidden, malformed records are
  counted in a diagnostic banner, and the writer records survive
  even when one upstream store is corrupt.
- **Inline copy filter** — the search box at the top filters
  records in place; record IDs are exposed as one-click copy
  buttons; pending records carry copy-only inbox / approval /
  rejection / ID controls.
- **Restrictive Content-Security-Policy.** The generated HTML
  sets `default-src 'none'`, `script-src 'unsafe-inline'`, and
  `style-src 'unsafe-inline'`. No external assets are loaded.
- **Path redaction** — the kernel home, project path, and
  `$HOME` are replaced with `[AGENT_KERNEL_HOME]`, `[PROJECT]`,
  and `~` respectively before HTML rendering. Secret patterns
  (`OPENAI_API_KEY`, `sk-…`, `ghp_…`, `github_pat_…`, `xox-…`,
  `AIza…`) and sensitive JSON keys (`token`, `password`,
  `secret`, `credential`, `authorization`, `cookie`, `api_key`,
  `private_key`) are also redacted.
- **Audit trail** — every dashboard run appends a bounded record
  to `~/.agent-kernel/logs/audit.jsonl` with `ok`, `path`,
  `generatedAt`, `opened`, `browser`, `browserError`, and the
  list of `sections` rendered.
- **Discovery docs.** `docs/STATIC_MEMORY_DASHBOARD.md` is the
  runbook; `docs/superpowers/specs/…-design.md` and
  `docs/superpowers/plans/…-plan.md` are the design + plan.

### Security

- **Immediate-parent symlink check.** The output target's
  immediate parent is checked for symbolic links and
  non-directory status. A user-controlled symlinked parent
  (e.g. `~/link → /etc`) is rejected with `unsafe-output`.
  System paths above the immediate parent (e.g. `/var` on
  macOS) are not walked.
- **Output must be a regular file.** Writing through an
  existing symlink is rejected.
- **Browser invocation is configurable.** A custom
  `AGENT_KERNEL_BROWSER_BIN` + `AGENT_KERNEL_BROWSER_ARGS_JSON`
  bypasses the platform default browser. Malformed args JSON
  fails closed and does **not** write the dashboard.
- **HTML escaping.** All stored content is escaped before render
  (the safety test injects `<script>` content and asserts the
  rendered HTML contains the escaped form).
- **Pending controls are copy-only.** The dashboard exposes
  proposal IDs and the next three commands
  (`agent-kernel approve <id> --publish`,
  `agent-kernel reject <id>`) as text. It does not expose
  approval/rejection buttons that could fire actions on the
  user's behalf.

### Verified

- `npm ci` (clean install)
- `npm run build` (regenerates `dist/cli.mjs` at v1.11.0)
- `npm run lint` (zero warnings)
- `npm run typecheck` (TypeScript types pass)
- `npm test` (39/39 smoke scenarios pass, including the new
  `public-cli-dashboard` and `public-cli-dashboard-safety`
  suites)
- `npm run docs:check` and `node scripts/check-version.mjs`
  (18/18 version surfaces agree)
- `npm pack --dry-run` (clean tarball preview)
- End-to-end on macOS: `agent-kernel dashboard` generates a
  32 KiB HTML file with CSP and inline scripts, writes it to
  `~/.agent-kernel/reports/dashboard.html`, and the file opens
  cleanly in a browser. A user-controlled symlinked parent
  (`~/link → /real`) is rejected with `unsafe-output`.

## [1.10.1] - 2026-07-14

This patch release hardens the CLI surface discovered during an
end-to-end user-journey test of v1.10.0 against a fresh install. The
new `--command` flag closes a critical gap in the public guard
command, and the `--json` envelopes make `inbox`, `status`, and
`doctor` scriptable.

### Fixed

- **`agent-kernel doctor` exit code.** Doctor now exits 1 on
  `Status: ATTENTION REQUIRED` (was: always exit 0). CI scripts and
  the runtime-doctor can now detect doctor failures.
- **`agent-kernel guard --command`** (security). The `--command`
  flag is now honored by the public CLI: any command is checked
  against the deny-pattern policies in `policies.json`
  (`dangerous-rm`, `curl-pipe-shell`, `chmod-777`,
  `force-push-main`, `delete-git`) and rejected with exit 2 on
  violation. Before this fix, the deny policies were only enforced
  via the Claude PreToolUse hook, not the public CLI, so any direct
  CLI user could `agent-kernel guard --command "rm -rf ~"` and
  receive `OK`.
- **`--json` envelopes** for `inbox`, `status`, and `doctor`
  (plus the file-scan and command-scan variants of `guard`).
  Output shapes:
  - `inbox --json` → `{ ok, count, items[] }`
  - `status --json` → `{ ok, version, home, approvedRules, pendingProposals, dist }`
  - `doctor --json` → `{ ok, version, status, home, checks[] }`
  - `guard --command --json` → `{ ok, blocked, kind: "command", message }`
  - `guard (file scan) --json` → `{ ok, blocked, kind: "files", scanned | violations }`
- **Help text.** `agent-kernel guard` now documents `--command` and
  `--json`.

### Tests

- 38/38 smoke scenarios pass (was 37/37). New: `cli-status-json`
  covers the JSON envelopes and the doctor exit-code behavior on
  a fresh install (verified by running `init` in a tmpdir without
  Claude/Codex globals and asserting that doctor exits 1 with
  `ok: false` in `--json` mode).
- `guard` test now covers the new `--command` flag for `rm -rf`,
  `curl|sh`, and `chmod 777` (all blocked with exit 2) plus a
  safe command (OK with exit 0), and the `--json` envelope.

### Verified

- `npm ci` (clean install)
- `npm run build` (regenerates `dist/cli.mjs` at v1.10.1)
- `npm run lint` (zero warnings)
- `npm run typecheck` (TypeScript types pass)
- `npm test` (38/38 smoke scenarios pass)
- `npm run docs:check` (markdown link sanity)
- `node scripts/check-version.mjs` (18/18 version surfaces agree)
- `npm pack --dry-run` (clean tarball preview)

## [1.10.0] - 2026-07-14

This release ships the **agent-approved CLI updater**: a secure self-update
surface that lets configured AI agents discover newer reviewed npm releases,
surface them inside connected agent guidance, and apply the exact version
only after the user enables `agent-approved` mode and allowlists the calling
identity. The updater is fail-closed by default, audited end-to-end, and
never calls npm without an explicit, authorized identity.

### Added

- **`agent-kernel update` command family.** New public router commands
  routed through `bin/agent-kernel-update.mjs`:
  - `update status` — current mode, channel, trusted agents, cache
  - `update check` — contact the registry and refresh the cache
  - `update enable` / `update disable` — toggle `agent-approved` mode
    (governance change, requires confirmation or `--yes`)
  - `update channel <dist-tag|version>` — switch release channel
  - `update trust <agent>` / `update revoke <agent>` — manage the
    explicit allowlist of agents authorized to apply updates
  - `update apply` — install the cached target version after agent
    authorization, then verify and audit
- **Cached update guidance publisher.**
  `bin/agent-kernel-update-guidance.mjs` publishes bounded release
  notices into the existing Codex, Claude, Cursor, Antigravity, Gemini,
  and AGENTS.md integration surfaces. It never contacts npm, uses
  managed markers with safe write/rollback, and skips symlinks and
  malformed marker pairs instead of truncating user content.
- **Lifecycle refresh hook.** `agent-kernel doctor`, `start`,
  `compile`, `sync`, and `status` opportunistically refresh the
  update cache (gated on `mode === 'agent-approved'`, a stale cache,
  and a non-JSON request). The refresh is a 20-second bounded
  `spawnSync` and cannot fail the delegated command.
- **Update audit trail.** Every check, authorization, install,
  verification, rollback, and final outcome is appended to
  `~/.agent-kernel/logs/updates.jsonl` with bounded, redacted
  fields (action, outcome, agent, channel, previousVersion,
  targetVersion).
- **Trusted updater runbook** in `docs/UPDATES.md` and
  **routed updater commands** reference in
  `docs/public-cli/ROUTED_COMMANDS.md`. The architecture trust
  boundary is documented in `docs/ARCHITECTURE_NOW.md`.
- **Upstream design and plan artefacts** in
  `docs/superpowers/specs/2026-07-14-agent-approved-updater-design.md`
  and `docs/superpowers/plans/2026-07-14-agent-approved-updater.md`
  for traceability.

### Changed

- **Public router** (`bin/agent-kernel-router.mjs`): now routes the
  `update` command family, prints cached human notices to stderr
  (preserving the JSON stdout stream), recognizes `--json` and
  assigned forms such as `--json=true`, and republishes guidance
  after successful `update`, `init`, `compile`, `sync`, and `link`.
- **Build pipeline** is unchanged. The updater and guidance helper
  ship alongside the existing dist without altering the canonical
  build script.

### Security

- **Fail-closed by default.** Mode starts at `disabled`; an explicit
  `update enable` plus at least one `update trust <agent>` entry is
  required before any npm call.
- **No shell interpolation.** All subprocess invocations use
  `childProcess.execFileSync` with argument arrays. The npm install
  command is `npm install --global <package>@<version>` with the
  version pre-validated against a strict semver pattern.
- **Authorization before network.** `authorize()` runs before
  `checkForUpdate()`, so an untrusted or missing agent identity
  is denied before any registry call.
- **Cache failure safety.** A check failure preserves a previous
  `targetVersion` only when the cached record's channel and current
  version match the new request and `updateAvailable === true`;
  otherwise the cache is cleared so a stale target cannot be
  silently re-applied.
- **Bounded rollback.** A single rollback to the previous version
  is attempted after a post-install verification failure. Both the
  verification failure and the rollback outcome are audited, and
  the final `UpdateError` carries `rollbackAttempted` /
  `rollbackSucceeded` in `details` for JSON consumers.
- **Symlink-safe guidance writes.** Each target file is checked
  with `fs.lstatSync(...).isSymbolicLink()` before any read or
  write, and symlinks are skipped rather than followed or replaced.

### Verified

- `npm ci` (clean install from lockfile)
- `npm run build` (regenerates `dist/cli.mjs` at v1.10.0)
- `npm run lint` (zero warnings)
- `npm run typecheck` (TypeScript types pass)
- `npm test` (`test/smoke.mjs` — 37/37 scenarios pass on Node 18.x,
  20.x, and 22.x, including the new `public-cli-update` suite)
- `npm run docs:check` and `node scripts/check-version.mjs`
  (18/18 version surfaces agree)
- `npm pack --dry-run` (clean tarball preview)

## [1.9.0] - 2026-07-14

This release hardens the trust, atomicity, and portability surfaces of Agent
Kernel. The agent proposal helper now enforces strict option parsing and JSON
envelopes, the safe-link and safe Git hook installers ship worktree- and
transaction-aware fixes, and a new portability helper makes retention exports
and imports safe to run against an existing home. Agent runtime write modes
gain a dedicated reference for capture-only and propose-only identities.

### Added

- **`agent-kernel portability` (experimental).** New
  `bin/agent-kernel-portability.mjs` helper wired to the public router
  with `export`, `import`, `view`, and `report` subcommands. Retention
  defaults to 30 days, secret patterns are redacted before write, and
  `import` refuses to merge into a non-empty home without `--force`.
  The retention + portability guide ships in
  `docs/RETENTION_AND_PORTABILITY.md`.
- **Agent write modes reference.** `docs/AGENT_WRITE_MODES.md` documents
  the four trust modes (`read-only`, `capture-only`, `propose-only`,
  `trusted-local`), the unknown-agent fallback, and the structured
  JSON envelopes for `mode`, `session`, and `observe` commands.
- **Agent proposal trust boundary reference.**
  `docs/AGENT_PROPOSALS.md` documents strict option parsing, the
  `--from` / `--agent` alias conflict, single-source text resolution,
  enum and CSV validation, subprocess timeouts, atomic identity
  enrichment, and the review-first lifecycle.

### Changed

- **Agent proposal helper** (`bin/agent-kernel-agent-propose.mjs`):
  rejects unknown and duplicate options, refuses `--from` and `--agent`
  used together, accepts text from exactly one source
  (`--text` / positional / stdin), validates `type`, `scope`, and
  `level` against fixed enums, deduplicates CSV values, bounds
  subprocess execution to a 30 s timeout and 1 MiB output buffer,
  redacts secrets in failure diagnostics, and returns structured
  JSON envelopes with `--json`.
- **safe-link installer** (`bin/agent-kernel-safe-link.mjs`): option
  parser now validates project paths up front, marker edits are
  guarded by explicit prefix checks, symbolic target writes are
  classified precisely, and the project write is made atomic and
  reversible.
- **safe Git hook installer** (`bin/agent-kernel-safe-git-hook.mjs`):
  resolves hooks through the active Git worktree path, validates
  custom options, repairs managed blocks explicitly, writes hooks
  atomically while preserving modes, and rejects symbolic hooks
  directories. New `docs/SAFE_GIT_HOOKS.md` documents the
  worktree-safe installation path.
- **Public router** (`bin/agent-kernel-router.mjs`): routes the new
  `portability` subcommand alongside architecture without
  regressing architecture-specific handlers.

### Fixed

- `agent-kernel portability import` will not silently merge into a
  populated home. The CLI now reports the conflict and exits non-zero
  unless `--force` is supplied.
- safe-link marker repair no longer overwrites unmanaged content
  outside the Agent Kernel block and no longer creates dangling
  symlinks on rollback.
- safe Git hook installation in a worktree no longer resolves hooks
  through the main checkout's `.git` directory.
- The agent-propose smoke test no longer fails on a fresh sandbox
  when the persistent agents file has not been seeded by `init`.

### Security

- The agent-propose helper redacts `OPENAI_API_KEY`,
  `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `sk-...`,
  `ghp_...`, `github_pat_...`, and `Bearer ...` tokens in any
  subprocess diagnostic it surfaces.
- The portability helper applies the same redactor plus
  `AIza...`, `xox[abposr]-...`, and a key-name heuristic
  (`token`, `password`, `secret`, `credential`, `authorization`,
  `cookie`, `api_key`, `private_key`) before writing export data.
- A denied unknown agent no longer creates a persistent registry
  entry. Lookups return a transient read-only identity and the
  helper refuses to create a proposal against it.

### Verified

- `npm ci` (clean install from lockfile)
- `npm run build` (regenerates `dist/cli.mjs` at v1.9.0)
- `npm run lint` (zero warnings)
- `npm run typecheck` (TypeScript types pass)
- `npm test` (`test/smoke.mjs` — 35/35 scenarios pass on Node 18.x,
  20.x, and 22.x)
- `npm run docs:check` and `node scripts/check-version.mjs`
  (18/18 version surfaces agree)
- `npm pack --dry-run` (clean tarball preview)

## [1.8.0] - 2026-07-11

Architecture Guardian is now a first-class, production-ready Agent Kernel
capability. This release ships the full conformance engine behind the public
`agent-kernel architecture` router, with discovery, change contracts, baselines,
scoped exceptions, reuse-first search, Claude PreToolUse scope enforcement, and
fail-closed governance state.

### Added

- **Architecture Guardian runtime.** `bin/agent-kernel-architecture.mjs` (full
  command surface) and `bin/agent-kernel-architecture-hook.mjs` (Claude
  PreToolUse scope enforcement) are now part of the public CLI and the npm
  package. The engine modules live in `bin/architecture-guardian/` and are
  consumable from the public router via `agent-kernel architecture ...`.
- **Architecture discovery and maps.** `agent-kernel architecture discover`
  produces a JSON project map with source roots, layers, dependencies, cycles,
  external package usage, and a stable map fingerprint. Project-local state
  lives at `.agent-kernel/architecture/current-map.json`.
- **Dependency rules and circular dependency detection.** `policy.json` now
  supports layer rules, forbidden dependency pairs, external package
  allow/deny lists, and a non-recursive iterative cycle detector that scales
  beyond 12 000 nodes without stack overflow.
- **Review and strict enforcement modes.** `agent-kernel architecture check`
  defaults to review (report candidate blockers) and supports
  `--strict` to enforce reviewed blocking severities without permanently
  changing the policy mode.
- **Change Contracts.** `agent-kernel architecture contract init/show/
  validate/close` creates an active contract with a task, owner, allowed
  files, forbidden files, expected files, allowed new dependencies, and
  required test descriptions. Contracts gate writes in strict mode.
- **Architecture baselines and diffs.** `agent-kernel architecture baseline`
  and `agent-kernel architecture diff` classify pre-existing findings so
  they are not attributed to the current change. A finding fingerprint
  prevents re-attribution of unchanged debt.
- **Scoped expiring exceptions.** `agent-kernel architecture exception add/
  list/revoke` records reviewable exceptions with scope, reason, owner, and
  ISO-8601 expiry. Expired exceptions stop suppressing findings
  automatically.
- **Reuse-first search.** `agent-kernel architecture reuse "<capability>"`
  searches existing symbols across supported languages before new
  capabilities are introduced. Returns ranked candidates with file, layer,
  and score.
- **Claude PreToolUse hook.** `agent-kernel-architecture-hook` denies writes
  outside an active change contract when
  `AGENT_KERNEL_ARCHITECTURE_MODE=strict` is set, and emits structured
  `additionalContext` feedback in review mode.
- **npm package and public router integration.** The package `bin` map
  exposes `agent-kernel-architecture` and `agent-kernel-architecture-hook`,
  and `package.json#files` ships the full engine module tree, skill,
  schemas, and templates.
- **Skills.sh and Claude plugin integration.**
  `skills/architecture-guardian/SKILL.md` is the canonical first-class
  skill, mirrored to `.claude/skills/architecture-guardian/SKILL.md` and
  `.agents/skills/architecture-guardian/SKILL.md`. The Claude plugin
  `agent-kernel` lists both `./` and `./skills/architecture-guardian` as
  bundled skills.
- **37-scenario torture bench.** `test/architecture-guardian.mjs` and
  `test/architecture-guardian-evals.mjs` cover layered, forbidden pair,
  cycle (2-node, 3-node, comment, dynamic, CommonJS, index-resolution),
  package policy, contract scope, baseline pre-existing vs new, exception
  suppression (active and expired), strict and review modes, source-root
  isolation, unapproved and approved new dependencies, missing and
  complete expected files, hook deny / allow / review, test companion
  review, and language-specific false-positive control for Node, Python,
  and Go standard libraries.
- **Fail-closed JSON handling.** Malformed policy, contract, baseline, and
  exception JSON is rejected with a clear error. Architecture checks return
  exit 1, doctor reports the failure, and the hook denies writes when
  governance state cannot be validated.
- **Iterative graph traversal.** Cycle detection uses an iterative
  worklist so it scales to large dependency graphs without stack overflow.
- **Standard-library false-positive controls.** Node `node:*` builtins,
  Python `stdlib` packages, and Go `stdlib` packages are recognized and
  do not produce false dependency findings.
- **Node.js 18, 20, and 22 verification.** CI matrix runs build, lint, and
  smoke on all three Node majors.

### Changed

- `agent-kernel` public router now exposes the `architecture` subcommand and
  dispatches to `agent-kernel-architecture.mjs` for all architecture work.
- `SKILL.md` now lists Architecture Guardian as a first-class capability
  with required triggers, mental model, and command surface.
- `.claude/skills/agent-kernel/SKILL.md` and
  `.agents/skills/agent-kernel/SKILL.md` were rewritten with valid
  frontmatter and Architecture Guardian cross-references.
- `.claude/skills/architecture-guardian/SKILL.md` and
  `.agents/skills/architecture-guardian/SKILL.md` are now first-class
  skills pointing to the canonical references rather than one long prompt.
- `.claude-plugin/marketplace.json` and `.claude-plugin/plugin.json` bumped
  to `1.8.0` with `architecture-guardian` listed as a bundled skill.
- `README.md` now opens with an explicit v1.8.0 release callout and adds a
  CI example, a Claude `PreToolUse` hook example, and a fail-closed
  governance section.
- `docs/ARCHITECTURE_GUARDIAN.md` and `docs/architecture-guardian/*` are
  aligned with the shipped behavior: review mode, strict mode, change
  contract lifecycle, baselines, exceptions, hook fail-closed,
  standard-library false-positive handling, supported languages, CI
  integration, and migration from review to strict.
- All helper binaries (`bin/agent-kernel-architecture.mjs`,
  `bin/agent-kernel-architecture-hook.mjs`, `bin/agent-kernel-mode.mjs`,
  and other `bin/*.mjs` files) carry the new `VERSION = '1.8.0'`
  constant.
- `package-lock.json` regenerated to reflect the new `bin` entries for
  `agent-kernel-architecture` and `agent-kernel-architecture-hook`.
- `docs/BUNDLE_KB.md` example manifest updated to `agent_kernel_version:
  "1.8.0"`.

### Fixed

- `bin/agent-kernel-file-context.mjs` and
  `bin/agent-kernel-file-records-core.mjs` now canonicalize both the
  project root and the input file path before computing `path.relative`,
  fixing a macOS symlink mismatch where `/var/folders/...` (the cwd as
  passed to a child process) did not match `/private/var/folders/...`
  (the canonical form returned by `git rev-parse --show-toplevel`).
- `bin/architecture-guardian/common.mjs` `safeRelative` now canonicalizes
  the project root and the absolute file path through
  `fs.realpathSync.native` with a parent-directory fallback, so file
  references are matched consistently across macOS, Linux, and Windows
  paths.
- `test/public-cli-registries.mjs` now compares project roots through
  `fs.realpathSync.native` so the test is stable on macOS where
  `git rev-parse` returns the canonical path while the test's home is the
  non-canonical `/var/folders/...` form.

### Security

- Architecture Guardian is review-first. Agents may not silently broaden
  policy, baseline, contract, or exception scope.
- The Claude `PreToolUse` hook is fail-closed: any unparseable
  governance state (malformed JSON, missing files, invalid policy,
  invalid contract) results in a `permissionDecision: "deny"` so the
  Claude session is forced to either fix the state or stop.
- `safeRelative` resolves file paths through `fs.realpathSync.native`
  rather than string comparison, eliminating the macOS symlink
  normalization gap.

### Verified (this release)

- `npm ci && npm run build && npm run lint && npm run typecheck && npm test`
  green locally.
- 34/34 smoke tests pass, including the 37 architecture-guardian torture
  bench scenarios.
- `node scripts/check-version.mjs` confirms `package.json`,
  `src/cli.mjs`, and `dist/cli.mjs` all carry `1.8.0`.
- `npm run publish:dry` produces a clean tarball preview.
- `npm pack` tarball contains the public CLIs, all `bin/architecture-guardian/`
  modules, the `skills/architecture-guardian/` skill tree, schemas,
  templates, examples, and required docs.
- Isolated install from the tarball into a fresh `mktemp -d` succeeds and
  `agent-kernel --version` and `agent-kernel architecture --help` work.

## [1.0.0] - 2026-07-09

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
