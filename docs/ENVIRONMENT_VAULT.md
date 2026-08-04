# Project Environment Vault

Project Environment Vault keeps project environment files available across local clones without storing them in Git or sending them to a remote service

The vault is local to the current machine and current Agent Kernel home

```text
${AGENT_KERNEL_HOME:-~/.agent-kernel}/vault/env/<project-fingerprint>/
```

## Start here

Link the current Git project

```bash
agent-kernel env link
```

Check its state

```bash
agent-kernel env status
```

Restore files that are missing from a fresh clone

```bash
agent-kernel env pull
```

Push local changes into the vault

```bash
agent-kernel env push
```

## Project identity

The vault derives a stable project identity in this order

1. Canonical Git remote origin
2. Initial Git commit hash
3. Absolute path when `--allow-path-identity` is passed explicitly

Common SSH and HTTPS remotes for the same repository resolve to one identity

```text
git@github.com:owner/repo.git
https://github.com/owner/repo.git
```

Both resolve to

```text
remote:github.com/owner/repo
```

Credentials, query strings, fragments, trailing slashes, and `.git` suffixes are removed before hashing

The directory name is a full SHA256 digest

A project with no remote and no commit is rejected by default

```bash
agent-kernel env link --allow-path-identity
```

Path identity is suitable for a local-only project but does not survive moving or cloning the folder to another path

## Selected files

Default discovery scans the project root recursively for

```text
.env
.env.*
**/.env
**/.env.*
```

These documentation and template files are excluded

```text
.env.example
.env.sample
.env.template
.env.defaults
```

These directories are skipped

```text
.git
node_modules
dist
build
coverage
.next
.turbo
.cache
.agent-kernel
```

Add an exact file in a Monorepo

```bash
agent-kernel env link \
  --include apps/api/.env \
  --include apps/web/.env.local
```

Exclude a path or pattern

```bash
agent-kernel env link --exclude apps/demo/**
```

The default maximum file size is 1 MiB

```bash
agent-kernel env link --max-bytes 2097152
```

Symlinks, directories, sockets, devices, FIFOs, path traversal, and files outside the project root are rejected

## Command reference

### Link

```bash
agent-kernel env link [project]
```

Useful flags

```text
--include path
--exclude pattern
--allow-empty
--allow-path-identity
--max-bytes number
--json
```

Link discovers eligible files, creates a version 2 manifest, writes owner-only copies, and records the initial revisions

### Status

```bash
agent-kernel env status [project]
agent-kernel env status [project] --json
```

Possible file states

```text
IN_SYNC
MODIFIED_LOCAL
MISSING_LOCAL
MISSING_VAULT
PERMISSION_DRIFT
UNHEALTHY
```

Status output includes file names and hashes where needed for diagnosis but never includes secret contents

### Push

```bash
agent-kernel env push [project]
```

Push stores changed local files and creates a revision before replacing the current stored copy

Push does not interpret a missing local file as deletion unless `--prune` is present

```bash
agent-kernel env push --prune
```

Push one linked file

```bash
agent-kernel env push --file apps/api/.env
```

Preview without writing

```bash
agent-kernel env push --dry-run
```

### Pull

```bash
agent-kernel env pull [project]
```

Pull restores missing files and leaves matching files unchanged

A differing local file is reported as a conflict and is not overwritten

```bash
agent-kernel env pull --force
```

Forced restore creates a local backup first

```text
<project>/.agent-kernel/env-backups/<timestamp>/<relative-file-path>
```

Skip the backup only through an explicit command

```bash
agent-kernel env pull --force --no-backup
```

Preview without writing

```bash
agent-kernel env pull --dry-run
```

### Watch

```bash
agent-kernel env watch [project]
```

The watcher monitors parent directories for linked files, debounces write events, and performs periodic reconciliation to catch coalesced or dropped events

Set the reconciliation interval in seconds

```bash
agent-kernel env watch --interval 15
```

Stop with Ctrl+C

### Doctor

```bash
agent-kernel env doctor [project]
```

Doctor checks manifest validity, missing stored files, directory permissions, and file permissions

Repair owner-only permissions on POSIX systems

```bash
agent-kernel env doctor --repair-permissions
```

Migrate a matching version 1 vault

```bash
agent-kernel env doctor --migrate
```

Migration creates a backup under

```text
${AGENT_KERNEL_HOME:-~/.agent-kernel}/vault/legacy-backups/
```

The legacy vault is retained

### History and revision restore

List revisions

```bash
agent-kernel env history --file .env
```

Restore one revision

```bash
agent-kernel env restore \
  --file .env \
  --revision <revision-id>
```

Revision restore follows the same conflict and backup rules as pull

Use `--force` only after reviewing the local file

### List

```bash
agent-kernel env list
agent-kernel env list --json
```

List reports project identity, fingerprint, health, linked paths, and selected file names without reading secret values into output

### Unlink

```bash
agent-kernel env unlink [project]
```

Unlink detaches the current project path from automatic behavior and retains stored files and revisions

### Purge

```bash
agent-kernel env purge [project] --yes
```

Purge removes stored data for the exact resolved project identity

The command refuses to run without `--yes`

## Automatic session behavior

Agent Kernel hooks use the same vault engine

Session start restores linked files only when they are missing

Existing files are never overwritten by automatic session restore

Post tool use synchronization validates the file before storing it and rejects symlinks and unsafe file types

Running the watcher is recommended when environment files are edited by tools outside an Agent Kernel hook

## Storage safety

Vault directories use `0700` on POSIX systems

Manifests, locks, current files, revision files, and backups use `0600`

Writes use a temporary file in the destination directory, flush the file descriptor, apply owner-only permissions, rename over the target, and flush the parent directory when supported

A per-vault lock prevents concurrent writers from replacing the manifest at the same time

Stale lock removal is restricted to old locks created on the same host when the recorded process is no longer running

Windows exposes the same command behavior, while POSIX mode bits remain advisory because Windows access control is handled by the operating system

## Threat boundaries

Project Environment Vault protects against accidental Git commits, accidental output of secret content, unsafe restore overwrites, path traversal, final-component symlinks, non-regular files, partial writes, and concurrent local writers

It does not protect secrets after the current operating-system account is compromised

It does not synchronize secrets between machines

It does not replace a managed team secret service

It does not rotate credentials

For team environments, use an external secret manager and treat this vault as a local recovery and continuity feature

## Troubleshooting

### Project has no stable Git identity

Create the first commit or configure `remote.origin.url`

```bash
git add .
git commit -m "chore: initialize project"
git remote add origin <repository-url>
```

Use `--allow-path-identity` only for a deliberate local-only project

### Pull reports a conflict

Inspect status

```bash
agent-kernel env status
```

Preserve the local file manually or run a forced restore that creates a backup

```bash
agent-kernel env pull --force
```

### Permission drift

```bash
agent-kernel env doctor --repair-permissions
```

### Vault is locked

A live writer or watcher may still be active

Stop the other process and retry

Agent Kernel removes only a stale same-host lock whose recorded process is no longer running

### Manifest is corrupt

Do not delete it immediately

Review the vault directory and legacy backup first

A corrupt manifest blocks writes so secret files are not silently reassigned to the wrong project

### Fresh clone is not recognized

Confirm that the clone uses the same repository remote

```bash
git remote get-url origin
agent-kernel env status
```

SSH and HTTPS GitHub forms are normalized automatically

A fork or a different remote is treated as a different project identity
