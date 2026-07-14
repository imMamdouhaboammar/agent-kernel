# Safe Git hook installation

`agent-kernel-safe-git-hook` injects the Agent Kernel staged-file guard into the effective Git `pre-commit` hook without deleting existing hook logic.

The public command routes to the same installer:

```bash
agent-kernel git-hook install .
```

## Recommended flow

Preview first:

```bash
agent-kernel-safe-git-hook . --dry-run
```

Install after reviewing the resolved hook path and action:

```bash
agent-kernel-safe-git-hook .
```

The managed block is:

```sh
# agent-kernel:start
agent-kernel guard --staged
status=$?
if [ $status -ne 0 ]; then
  echo "Agent Kernel blocked this commit."
  exit $status
fi
# agent-kernel:end
```

Code outside this block remains user-owned.

## Git repository and worktree discovery

The installer asks Git for three paths instead of assuming `<project>/.git/hooks`:

```bash
git rev-parse --show-toplevel
git rev-parse --git-common-dir
git rev-parse --git-path hooks
```

This supports:

- normal repositories
- linked Git worktrees where `.git` is a file
- repositories with a configured `core.hooksPath`
- absolute or relative hooks paths returned by Git

The project argument must already exist, must be a directory, and must belong to a Git worktree. Missing paths and non-Git directories fail without creating files.

## Argument validation

Supported options:

```text
--dry-run
--force
--no-backup
--help
```

Unknown options, duplicate options, and more than one project path fail with a non-zero exit code. Use `--` before a project path that begins with a dash.

```bash
agent-kernel-safe-git-hook -- ./-project-name
```

## Marker behavior

| Existing hook state | Result |
|---|---|
| No hook | Create a shell hook with one managed block |
| Hook without Agent Kernel markers | Preserve its shell code and append one managed block |
| One complete managed block | Replace that block with the current guard block |
| Multiple complete managed blocks | Collapse them into one block |
| Unmatched or nested marker lines | Fail before writing |

Corrupt marker layouts are ambiguous, so repair requires explicit review:

```bash
agent-kernel-safe-git-hook . --force --dry-run
agent-kernel-safe-git-hook . --force
```

Force repair removes Agent Kernel marker lines, preserves all other shell text, and appends one current managed block. Text that was inside an unmatched block is preserved for human review rather than deleted silently.

## Target safety

The installer refuses to modify:

- a symbolic `pre-commit` hook
- an existing target that is not a regular file
- a symbolic hooks directory
- a hooks path that exists as a non-directory

The target is resolved from Git before any backup or write.

## Atomic replacement

The new hook is written to a temporary sibling file, assigned its final permissions, and renamed into place.

On platforms where replacing an existing file by rename is restricted, the installer temporarily displaces the old hook, installs the new file, and restores the original if installation fails. Temporary and rollback files are removed after completion.

## Permissions

For an existing hook, the installer preserves its current permission bits and adds user execute permission when missing.

Examples:

```text
0600 -> 0700
0700 -> 0700
0755 -> 0755
```

A newly created hook uses mode `0755`.

## Backups

Existing hooks are backed up by default under:

```text
<project>/.agent-kernel-backups/
```

The backup preserves the original content and permission mode.

Skip persistent backups only in a controlled or disposable repository:

```bash
agent-kernel-safe-git-hook . --no-backup
```

Atomic replacement safety still applies when persistent backups are disabled.

## Dry-run guarantee

`--dry-run` performs project discovery, Git path resolution, target validation, and marker analysis. It prints the planned action but does not create the hooks directory, modify the hook, change permissions, or create backups.

## Removal

This command installs or refreshes the managed block. It does not currently remove the block. Remove it manually only after preserving the rest of the hook, or use a future dedicated removal command when one is added and tested.
