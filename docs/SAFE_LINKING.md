# Safe project linking

`agent-kernel-safe-link` links generated Agent Kernel guidance into a project without overwriting existing project instructions.

Use it first when a repository already has hand-written agent files, team conventions, Cursor rules, Gemini guidance, or Antigravity `.agents` files.

---

## Why this exists

The direct `agent-kernel link` command writes generated files into a project. That is useful for clean projects, but risky when a project already has local guidance such as:

```text
AGENTS.md
CLAUDE.md
GEMINI.md
.cursor/rules/*.mdc
.agents/agents.md
.agents/skills/README.md
```

The safe-link path treats existing project files as user-owned files. Agent Kernel content is injected only inside a marked block:

```md
<!-- agent-kernel:start -->
...
<!-- agent-kernel:end -->
```

On the next run, only that marked block is replaced. Content outside the block stays intact.

---

## Recommended usage

```bash
agent-kernel init --sync
agent-kernel compile
agent-kernel-safe-link . --dry-run
agent-kernel-safe-link .
```

Add the safe git hook helper when you want guard behavior without replacing an existing hook:

```bash
agent-kernel-safe-git-hook . --dry-run
agent-kernel-safe-git-hook .
```

Run `--dry-run` first in any repository that already has project instructions or git hooks.

---

## Behavior

| Case | Behavior |
|---|---|
| Target file does not exist | Create file with a marked Agent Kernel block |
| Target file exists without markers | Back up the file, then append a marked Agent Kernel block |
| Target file exists with one marked block | Back up the file, then replace only the marked block |
| Target file contains duplicate complete marked blocks | Collapse duplicate Agent Kernel blocks into one canonical block |
| Target file has unmatched or nested marker lines | Fail before writing; use reviewed `--force` repair when appropriate |
| Target or target parent is unsafe | Fail during preflight before any project file is written |
| A write fails after earlier writes | Restore earlier files to their pre-run content |
| `--dry-run` | Run the same path and marker preflight, then print actions without writing |
| `--force` | Preserve non-marker text, remove corrupt marker lines, and rebuild one managed block |
| `--no-backup` | Skip persistent `.agent-kernel-backups/` files; in-process rollback still applies |

The safe-link path is idempotent. Running it repeatedly updates the Agent Kernel block rather than duplicating it.

---

## Input validation

Safe-link accepts at most one project path. The path must already exist and must be a directory.

Unknown options, duplicate options, and multiple project paths fail with a non-zero exit code. Use `--` before a project path that begins with a dash.

```bash
agent-kernel-safe-link -- ./-project-name
```

A failed argument or project-path check does not create directories or project files.

---

## Marker repair

Complete duplicate blocks are collapsed automatically. Unmatched or nested markers are treated differently because it is ambiguous which text is user-owned.

Default behavior is fail closed:

```bash
agent-kernel-safe-link .
# Corrupt Agent Kernel markers in AGENTS.md ...
```

Review the file, preview repair, then apply it explicitly:

```bash
agent-kernel-safe-link . --force --dry-run
agent-kernel-safe-link . --force
```

Force repair removes only Agent Kernel marker lines, preserves the remaining text, and appends one current managed block. Stale text that was between unmatched markers is preserved for human review rather than deleted silently.

---

## Target safety

Before writing any target, safe-link preflights the full target set.

It rejects:

- target files that are symbolic links
- parent directories that resolve outside the project root
- non-directory target parents
- target paths outside the canonical project root
- existing targets that are not regular files

This prevents an early file such as `AGENTS.md` from being changed before a later invalid target is discovered.

---

## Atomic writes and rollback

Each target is written through a temporary file in the same directory and renamed into place. Temporary files are removed after a failed write.

All target plans are validated before the first write. If an unexpected write fails after earlier targets were applied, safe-link restores earlier existing files from their in-memory pre-run content and removes files created by the failed run.

Persistent backups are created before writes unless `--no-backup` is set. Rollback does not depend on persistent backups.

---

## Files linked

```text
AGENTS.md
CLAUDE.md
GEMINI.md
.cursor/rules/00-agent-kernel.mdc
.agents/agents.md
.agents/skills/README.md
```

The source files are read from:

```text
$AGENT_KERNEL_HOME/dist/
```

Run one of these before safe-linking:

```bash
agent-kernel compile
agent-kernel init --sync
agent-kernel sync
```

---

## Backups

By default, safe-link creates backups before modifying existing files.

Backups live under:

```text
.agent-kernel-backups/
```

Use `--no-backup` only when the repository is disposable, already clean in git, or being modified by a controlled automation step. The command still keeps enough in-memory state to reverse writes from the current failed run.

---

## Safe-link vs direct link

| Need | Command |
|---|---|
| Existing repo with hand-written instructions | `agent-kernel-safe-link .` |
| Existing repo with custom pre-commit hook | `agent-kernel-safe-git-hook .` |
| New repo where generated guidance may own the files | `agent-kernel link . --hooks` |
| Preview before writing | `agent-kernel-safe-link . --dry-run` |
| Repair reviewed corrupt markers | `agent-kernel-safe-link . --force --dry-run`, then `--force` |

When in doubt, use the safe path first.

---

## What agents should not do

Agents should not edit generated files directly to add durable rules. The correct flow is:

```text
agent sees durable rule
  -> agent creates proposal
  -> user reviews inbox
  -> user approves
  -> Agent Kernel publishes
  -> safe-link refreshes generated project guidance
```

This keeps hand-written project guidance, source memory, generated output, and agent proposals separate.

---

## Current status

`agent-kernel-safe-link` is a companion binary with regression coverage for argument validation, dry-run parity, duplicate and corrupt markers, target preflight, symlink safety, temporary cleanup, idempotency, backups, and Claude guidance linking through `CLAUDE.md`. The main `agent-kernel link` wrapper routes user-facing link operations through the same safe behavior.

Future work can move the same merge strategy into the monolithic runtime once the behavior is fully aligned with the command surface and smoke suite.
