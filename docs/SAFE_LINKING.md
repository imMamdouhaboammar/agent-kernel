# Safe project linking

`agent-kernel-safe-link` is a safer companion path for linking generated Agent Kernel files into a project without overwriting existing project instructions.

## Why this exists

The original `agent-kernel link` command writes generated files into a project. That is useful, but it can be risky when a project already has local `AGENTS.md`, `GEMINI.md`, Cursor rules, or `.agents` guidance.

The safe-link path treats existing project files as user-owned files. Agent Kernel content is injected only inside a marked block:

```md
<!-- agent-kernel:start -->
...
<!-- agent-kernel:end -->
```

On the next run, only that marked block is replaced. Content outside the block stays intact.

## Usage

```bash
agent-kernel init --sync
agent-kernel-safe-link . --dry-run
agent-kernel-safe-link .
```

## Behavior

| Case | Behavior |
| --- | --- |
| Target file does not exist | Create file with a marked Agent Kernel block |
| Target file exists without markers | Back up the file, then append a marked Agent Kernel block |
| Target file exists with markers | Back up the file, then replace only the marked block |
| `--dry-run` | Print planned actions without writing |
| `--no-backup` | Write without creating `.agent-kernel-backups/` |

## Files linked

```text
AGENTS.md
GEMINI.md
.cursor/rules/00-agent-kernel.mdc
.agents/agents.md
.agents/skills/README.md
```

The source files are read from:

```text
$AGENT_KERNEL_HOME/dist/
```

Run `agent-kernel compile` or `agent-kernel init --sync` before safe-linking.

## Current status

This is intentionally a companion binary first. It lets us harden behavior and tests before changing the existing `agent-kernel link` command inside the monolithic CLI.

The next step is to move this merge strategy into the main `link` command after the smoke tests prove the behavior is stable.
