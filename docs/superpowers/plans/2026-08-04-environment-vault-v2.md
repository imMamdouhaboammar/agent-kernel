# Project Environment Vault v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking

**Goal:** Replace the first Environment Vault implementation with a safer routed command that preserves local-first storage, stable project identity, conflict-aware restore, automatic hooks, a watcher, and complete operator documentation

**Architecture:** Keep `src/env-vault.mjs` as the public module consumed by existing hook code, then move implementation responsibilities into focused modules under `src/env-vault/`. Route `agent-kernel env` through a dedicated executable while retaining hook compatibility in `src/cli.mjs`

**Tech Stack:** Node.js ES modules, built-in `fs`, `crypto`, `child_process`, `path`, and `os`, custom smoke tests, GitHub Actions release verification

## Global Constraints

- Node.js minimum remains `18.18.0`
- No runtime dependency is added
- Vault data remains local under `AGENT_KERNEL_HOME`
- Secret values never appear in output or logs
- Directories use `0700` and files use `0600` where POSIX modes apply
- Restores do not overwrite differing local files without `--force`
- Automatic session restore writes only missing files
- Every production behavior starts with a focused failing regression test
- The final verification command is `npm run verify:release`

---

### Task 1: Add failing v2 behavioral tests

**Files:**
- Create: `test/env-vault-v2.mjs`
- Modify: `test/smoke.mjs`

**Interfaces:**
- Consumes: `runCli`, `makeEnv`, and `repo` from `test/_lib/helpers.mjs`
- Produces: focused behavioral coverage for identity, permissions, conflict handling, unsafe files, router dispatch, and JSON output

- [ ] **Step 1: Add a remote canonicalization test**

Create temporary Git repositories with HTTPS and SCP-style SSH remotes for the same owner and repository, call `calculateProjectFingerprint`, and assert that both return the same 64-character fingerprint and canonical identity `remote:github.com/owner/repo`

- [ ] **Step 2: Run the focused test and confirm RED**

Run

```bash
node scripts/build.mjs && node test/smoke.mjs
```

Expected failure is a missing v2 identity field or a 16-character fingerprint

- [ ] **Step 3: Add storage and restore tests**

Cover these independent behaviors

```text
AGENT_KERNEL_HOME controls the vault root
linked files and metadata are 0600 on POSIX
symlink sources are rejected
pull restores missing files
pull refuses differing local files
pull --force creates a backup before overwrite
JSON output does not contain a known secret value
```

- [ ] **Step 4: Add routing and automatic hook tests**

Assert that the public router dispatches `env` to the focused executable, session start restores only missing linked files, and post tool use synchronizes only the named linked environment file

- [ ] **Step 5: Register the module in `test/smoke.mjs`**

Import `run` from `./env-vault-v2.mjs` and add `['env-vault-v2', runEnvVaultV2]` directly after the existing Environment Vault test

- [ ] **Step 6: Commit the failing tests**

```bash
git add test/env-vault-v2.mjs test/smoke.mjs
git commit -m "test: define environment vault v2 behavior"
```

### Task 2: Implement stable identity and safe storage primitives

**Files:**
- Create: `src/env-vault/common.mjs`
- Create: `src/env-vault/identity.mjs`
- Create: `src/env-vault/storage.mjs`
- Create: `src/env-vault/manifest.mjs`
- Modify: `src/env-vault.mjs`
- Modify: `scripts/build.mjs`

**Interfaces:**
- Produces: `kernelHome()`, `vaultRoot()`, `canonicalizeRemote()`, `calculateProjectIdentity()`, `atomicWriteFile()`, `withVaultLock()`, `readManifest()`, and `writeManifest()`

- [ ] **Step 1: Implement common paths and validation**

`kernelHome()` returns `process.env.AGENT_KERNEL_HOME || path.join(os.homedir(), '.agent-kernel')`

`assertRelativeProjectPath()` rejects absolute paths, `..` traversal, empty paths, and normalized duplicates

- [ ] **Step 2: Implement remote canonicalization**

Normalize SCP-style SSH, `ssh://`, `git://`, `http://`, and `https://` forms, remove credentials, query strings, fragments, trailing slashes, and `.git`, lowercase the host, and preserve the repository path

- [ ] **Step 3: Implement full SHA256 project identity**

Return

```js
{
  fingerprint,
  source: 'remote' | 'commit' | 'path',
  canonical,
  gitRemote,
  projectName,
  projectRoot
}
```

Path identity requires `{ allowPathIdentity: true }`

- [ ] **Step 4: Implement atomic owner-only writes**

Use exclusive temporary file creation, write, `fsync`, `chmod(0o600)`, rename, and best-effort parent directory sync

Reject final-component symlinks and non-regular source files

- [ ] **Step 5: Implement per-vault locks**

Use exclusive `.lock` creation, record PID, host, command, and timestamp, reject active locks, and remove stale locks only under the design rules

- [ ] **Step 6: Implement strict manifest version 2 parsing**

Reject malformed JSON, unsupported versions, invalid fingerprints, traversal paths, duplicate normalized paths, and invalid hashes

- [ ] **Step 7: Update the build script**

Copy `src/env-vault.mjs` and the full `src/env-vault/` directory into `dist/`

- [ ] **Step 8: Run focused and full smoke tests**

```bash
node scripts/build.mjs
node test/smoke.mjs
```

- [ ] **Step 9: Commit**

```bash
git add src/env-vault.mjs src/env-vault scripts/build.mjs
git commit -m "feat(env): add safe identity and storage primitives"
```

### Task 3: Implement discovery, revisions, sync, restore, and doctor

**Files:**
- Create: `src/env-vault/discovery.mjs`
- Create: `src/env-vault/engine.mjs`
- Modify: `src/env-vault.mjs`
- Modify: `test/env-vault-v2.mjs`

**Interfaces:**
- Produces: `vaultLinkProject()`, `vaultSyncProject()`, `vaultRestoreProject()`, `vaultGetStatus()`, `vaultDoctor()`, `vaultHistory()`, `vaultRestoreRevision()`, `vaultListProjects()`, `vaultUnlinkProject()`, and `vaultPurgeProject()`

- [ ] **Step 1: Implement deterministic discovery**

Discover `.env` and `.env.*` recursively inside the project root, apply default exclusions, merge exact includes, apply user exclusions, reject unsafe files, and persist the selected relative path list

- [ ] **Step 2: Implement link and push**

Create revision records before replacing stored files, avoid deletion when a local file disappears unless `prune` is true, and return structured changed, unchanged, skipped, and pruned arrays

- [ ] **Step 3: Implement conflict-aware pull**

Restore missing files by default, emit conflicts for differing local files, require `force` to overwrite, and create local backups unless `noBackup` is true

- [ ] **Step 4: Implement status and doctor**

Return the exact statuses from the design, detect permission drift and corrupt metadata, and support owner-only permission repair

- [ ] **Step 5: Implement history and revision restore**

List revisions without secret content and restore a requested file revision through the same conflict and backup rules as pull

- [ ] **Step 6: Implement unlink and purge separation**

Unlink records detachment without deleting the vault, while purge requires `confirm: true`

- [ ] **Step 7: Run tests**

```bash
node scripts/build.mjs
node test/smoke.mjs
```

- [ ] **Step 8: Commit**

```bash
git add src/env-vault.mjs src/env-vault test/env-vault-v2.mjs
git commit -m "feat(env): add conflict-aware vault operations"
```

### Task 4: Add the routed command and watcher

**Files:**
- Create: `src/env-vault/watcher.mjs`
- Create: `bin/agent-kernel-env-vault.mjs`
- Modify: `bin/agent-kernel-router.mjs`
- Modify: `src/cli.mjs`
- Modify: `test/wrapper-routing.mjs`
- Modify: `test/env-vault-v2.mjs`

**Interfaces:**
- Public command: `agent-kernel env <subcommand>`
- Hook compatibility: existing session start and post tool use code continues to call exports from `src/env-vault.mjs`

- [ ] **Step 1: Implement command parsing and output**

Support all command forms in the design, repeated include and exclude flags, `--file`, `--json`, `--dry-run`, `--force`, `--no-backup`, `--prune`, `--yes`, and clear usage errors

- [ ] **Step 2: Route `env` through the public router**

Add the executable path and select it when `command === 'env'`

The helper receives `args.slice(1)` because the router consumes the top-level command

- [ ] **Step 3: Implement watcher behavior**

Watch selected parent directories, debounce events, periodically reconcile, and close on SIGINT or SIGTERM

- [ ] **Step 4: Narrow automatic post-write sync**

The hook synchronizes only when the written path is one of the linked environment paths

- [ ] **Step 5: Preserve session missing-only restore**

Session start uses missing-only mode and never passes force

- [ ] **Step 6: Run tests**

```bash
node scripts/build.mjs
node test/smoke.mjs
```

- [ ] **Step 7: Commit**

```bash
git add bin/agent-kernel-env-vault.mjs bin/agent-kernel-router.mjs src/cli.mjs src/env-vault/watcher.mjs test
git commit -m "feat(env): route advanced vault commands"
```

### Task 5: Update operator and contributor documentation

**Files:**
- Create: `docs/ENVIRONMENT_VAULT.md`
- Modify: `README.md`
- Modify: `docs/ARCHITECTURE_NOW.md`
- Modify: `docs/TROUBLESHOOTING.md`
- Modify: `skills/agent-kernel-ops/SKILL.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Produces: complete public command reference and operational guidance

- [ ] **Step 1: Write the dedicated guide**

Document identity, storage location, selected files, command examples, conflicts, backups, watcher behavior, permissions, migration, and threat boundaries

- [ ] **Step 2: Update README**

Replace the brief Vault claim with accurate v2 behavior and a concise first-run example

- [ ] **Step 3: Update architecture and troubleshooting**

Document the routed command and remedies for identity failure, conflicts, permission drift, locks, and corrupt manifests

- [ ] **Step 4: Update the operations skill**

Teach agents to use `status`, `doctor`, missing-only pull, and explicit push without printing secret contents

- [ ] **Step 5: Update changelog**

Add an unreleased Environment Vault v2 section without claiming release publication

- [ ] **Step 6: Run documentation checks**

```bash
npm run docs:check
```

- [ ] **Step 7: Commit**

```bash
git add README.md CHANGELOG.md docs skills/agent-kernel-ops/SKILL.md
git commit -m "docs: document environment vault v2"
```

### Task 6: Security review and release verification

**Files:**
- Modify only files required by verified findings

**Interfaces:**
- Produces: a reviewable PR with test evidence and known limitations

- [ ] **Step 1: Review the diff against the security invariants**

Check credential redaction, path containment, symlink handling, lock behavior, conflict policy, purge confirmation, and secret-free output

- [ ] **Step 2: Run the full release gate**

```bash
npm run verify:release
```

Expected result is exit code `0` with zero test, lint, typecheck, audit, build, docs, or package failures

- [ ] **Step 3: Inspect the package file list**

Confirm the new executable and all `dist/env-vault/` files are present in `npm pack --dry-run --ignore-scripts`

- [ ] **Step 4: Open a draft PR against `master`**

The PR body lists changed behavior, security properties, commands run, migration notes, and any remaining limitations

- [ ] **Step 5: Wait for GitHub Actions and review feedback**

Do not merge while required checks fail or actionable review threads remain
