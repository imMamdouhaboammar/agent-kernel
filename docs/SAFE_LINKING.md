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
| Target file contains duplicate marked blocks | Collapse duplicate Agent Kernel blocks into one canonical block |
| `--dry-run` | Print planned actions without writing |
| `--no-backup` | Write without creating `.agent-kernel-backups/` |

The safe-link path is intended to be idempotent. Running it repeatedly should update the Agent Kernel block, not duplicate it.

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

Use `--no-backup` only when the repository is disposable, already clean in git, or being modified by a controlled automation step.

---

## Safe-link vs direct link

| Need | Command |
|---|---|
| Existing repo with hand-written instructions | `agent-kernel-safe-link .` |
| Existing repo with custom pre-commit hook | `agent-kernel-safe-git-hook .` |
| New repo where generated guidance may own the files | `agent-kernel link . --hooks` |
| Preview before writing | `agent-kernel-safe-link . --dry-run` |

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

`agent-kernel-safe-link` is a companion binary with regression coverage for duplicate marked blocks and Claude guidance linking through `CLAUDE.md`. It exists to keep project linking safe while the main `agent-kernel link` wrapper routes user-facing link operations through the same safe behavior.

Future work can move the same merge strategy into the monolithic runtime once the behavior is fully aligned with the command surface and smoke suite.
