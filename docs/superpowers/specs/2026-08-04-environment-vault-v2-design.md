# Project Environment Vault v2 Design

## Purpose

Project Environment Vault v2 keeps project environment files available across local clones without placing secrets in Git or remote storage

The feature remains local-first and stores files only under the Agent Kernel home directory

The public command is `agent-kernel env`

## Goals

- Derive a stable project identity across SSH and HTTPS clones of the same Git repository
- Store environment files with restrictive permissions and atomic writes
- Detect local edits and synchronize them through explicit commands, Agent Kernel hooks, and an optional watcher
- Restore missing files on session start without silently overwriting local content
- Report conflicts, permission defects, corrupt metadata, and unsafe file types clearly
- Support monorepos and custom environment file paths
- Respect `AGENT_KERNEL_HOME`
- Provide human-readable and JSON output
- Keep destructive deletion separate from unlinking

## Non-goals

- Cloud synchronization
- Team secret sharing
- Secret rotation
- Automatic decryption from external secret managers
- Transparent interception of every editor or shell write when the watcher is not running
- OS keychain encryption in the first v2 release

## Architecture

The feature is split into a focused command and small modules

```text
bin/agent-kernel-env-vault.mjs
src/env-vault/
  common.mjs
  identity.mjs
  discovery.mjs
  storage.mjs
  manifest.mjs
  engine.mjs
  watcher.mjs
```

`bin/agent-kernel-router.mjs` routes `agent-kernel env` to the focused command

The existing hook entry points in `src/cli.mjs` call the v2 engine for session restore and post-write synchronization

## Project identity

Identity priority

1. Canonical Git remote identity
2. Initial Git commit hash
3. Absolute path only when the user passes `--allow-path-identity`

Canonical remote identities normalize common SSH and HTTPS forms to the same value

```text
git@github.com:owner/repo.git
ssh://git@github.com/owner/repo.git
https://github.com/owner/repo.git
https://token@github.com/owner/repo.git
```

All become

```text
remote:github.com/owner/repo
```

Credentials, query strings, fragments, trailing slashes, and `.git` suffixes are removed before hashing

The vault identifier is the full lowercase SHA256 digest of the canonical identity

The manifest records the identity source and a redacted canonical identity but never stores credentials

A repository with no remote and no initial commit fails to link unless `--allow-path-identity` is present

## Vault paths

The root is

```text
${AGENT_KERNEL_HOME:-~/.agent-kernel}/vault/env/<sha256>/
```

Each vault contains

```text
manifest.json
files/<encoded-relative-path>
revisions/<revision-id>/<encoded-relative-path>
.lock
```

Directories use `0700`

Secret files and metadata use `0600`

Permission repair runs after every create or replace operation on POSIX platforms

Windows keeps the same API behavior while documenting that POSIX mode bits are advisory there

## File discovery

Default discovery includes regular files matching

```text
.env
.env.*
**/.env
**/.env.*
```

Default exclusions

```text
.env.example
.env.sample
.env.template
.env.defaults
node_modules/**
.git/**
dist/**
build/**
coverage/**
```

Discovery remains inside the resolved project root

Symlinks, directories, sockets, devices, FIFOs, and files outside the project root are rejected

The default maximum file size is 1 MiB

Users may add exact relative paths through repeated `--include`

Users may exclude exact paths or glob patterns through repeated `--exclude`

The linked manifest persists the selected file set so later sync operations are deterministic

## Manifest

Manifest version is `2`

Required fields

```json
{
  "version": 2,
  "fingerprint": "<full sha256>",
  "identity": {
    "source": "remote",
    "canonical": "remote:github.com/owner/repo"
  },
  "projectName": "repo",
  "lastKnownPath": "/workspace/repo",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601",
  "files": {
    ".env": {
      "sha256": "<sha256>",
      "sizeBytes": 123,
      "mode": "0600",
      "updatedAt": "ISO-8601",
      "revision": "<revision-id>"
    }
  }
}
```

Manifest parsing is strict

Unsupported versions, malformed JSON, path traversal entries, duplicate normalized paths, and invalid hashes make the vault unhealthy and block writes until repaired

## Atomic storage

Every file and manifest replacement follows this sequence

1. Create a temporary file in the destination directory with exclusive creation
2. Write all bytes
3. Flush the file descriptor
4. Apply `0600`
5. Rename the temporary file over the target
6. Flush the parent directory when supported

The implementation refuses final-component symlinks and verifies that opened sources are regular files

A per-vault lock uses exclusive creation

The lock records process ID, host, command, and creation time

A stale lock may be removed only when it is older than the configured timeout and the owning process is not running on the same host

## Synchronization rules

`link`

- Resolves project identity
- Discovers files
- Creates the vault
- Stores initial revisions
- Fails when no eligible files are found unless `--allow-empty` is set

`push`

- Copies changed local files into the vault
- Adds newly selected files
- Does not treat a missing local file as deletion unless `--prune` is set
- Creates a revision before replacing a stored file

`pull`

- Restores missing files by default
- Reports a conflict when local and vault hashes differ
- Requires `--force` to overwrite a differing local file
- Creates a local backup under `.agent-kernel/env-backups/<timestamp>/` before forced overwrite unless `--no-backup` is present

`status`

- Reports `IN_SYNC`, `MODIFIED_LOCAL`, `MISSING_LOCAL`, `UNSAVED_LOCAL`, `MISSING_VAULT`, `PERMISSION_DRIFT`, or `UNHEALTHY`
- Never prints secret contents

`unlink`

- Marks the current path as detached from automatic hooks
- Retains vault data

`purge`

- Deletes the vault only with `--yes`
- Refuses deletion when the identity cannot be resolved exactly

## Automatic behavior

Session start

- Resolves the project identity
- Restores only missing linked files
- Does not overwrite existing files
- Emits a concise message only when files were restored or the vault is unhealthy

Post tool use

- Runs only when the tool payload indicates a write to a linked environment file
- Pushes that exact file after validating it
- Does not scan or copy unrelated files

Watcher

- `agent-kernel env watch [project]` watches linked parent directories
- Events are debounced
- A periodic reconciliation catches dropped or coalesced file events
- The watcher stops cleanly on SIGINT and SIGTERM
- The watcher never follows newly introduced symlinks

## Command contract

```text
agent-kernel env link [project] [--include path] [--exclude pattern] [--allow-empty] [--allow-path-identity] [--json]
agent-kernel env status [project] [--json]
agent-kernel env push [project] [--file path] [--prune] [--dry-run] [--json]
agent-kernel env pull [project] [--file path] [--force] [--no-backup] [--dry-run] [--json]
agent-kernel env watch [project] [--interval seconds] [--json]
agent-kernel env doctor [project] [--repair-permissions] [--json]
agent-kernel env history [project] [--file path] [--json]
agent-kernel env restore [project] --file path --revision id [--force] [--json]
agent-kernel env list [--json]
agent-kernel env unlink [project] [--json]
agent-kernel env purge [project] --yes [--json]
```

Exit codes

- `0` success or healthy status
- `1` usage or unexpected runtime failure
- `2` conflict, unhealthy vault, unsafe file, or failed doctor check

## Security invariants

- Secret contents never appear in normal output, JSON output, logs, thrown errors, docs examples, or test snapshots
- Remote credentials never enter the manifest or fingerprint source
- All selected paths remain inside the project root
- Source and destination symlinks are rejected
- Restore never overwrites differing local content without explicit force
- Purge requires explicit confirmation
- Automatic hooks restore only missing files
- Metadata corruption blocks writes rather than being silently replaced
- Temporary files are removed after failure where possible

## Tests

Focused tests cover

- SSH and HTTPS remote canonicalization
- Credential redaction
- Full SHA256 identifiers
- `AGENT_KERNEL_HOME`
- Path identity opt-in
- Glob discovery and default exclusions
- Monorepo relative paths
- Symlink and non-regular file rejection
- Maximum file size
- Atomic replacement failure cleanup
- `0600` permission creation and repair on POSIX
- Lock contention and stale lock handling
- Push revisions
- Pull missing-only behavior
- Conflict refusal and forced overwrite backup
- Manifest corruption and traversal rejection
- Session start restore
- Post tool use exact-file sync
- Router command dispatch
- JSON output without secret values

The full release gate remains

```text
npm run verify:release
```

## Documentation changes

- Add `docs/ENVIRONMENT_VAULT.md`
- Update the README feature summary and command examples
- Update `docs/ARCHITECTURE_NOW.md`
- Update `docs/TROUBLESHOOTING.md`
- Update `skills/agent-kernel-ops/SKILL.md`
- Update `CHANGELOG.md`

## Rollout

The v2 reader recognizes the existing v1 directory format

`agent-kernel env doctor --migrate` converts a valid v1 vault to v2 after creating a backup

Normal commands do not silently migrate data

Repository: imMamdouhaboammar/agent-kernel
Version: 0a37e31d584be9050aec0d49917970f1795bde63
