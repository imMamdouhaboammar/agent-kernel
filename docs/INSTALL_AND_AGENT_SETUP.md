# Install and agent setup

This guide covers the safest path for using Agent Kernel as a shared local memory, runtime evidence, and governance layer across coding agents.

## Requirements

- Node.js `>=18.18.0`
- a local user account that can write to the selected Agent Kernel home
- Git when installing project hooks or using repository-aware commands

Agent Kernel has zero runtime npm dependencies.

## Install

```bash
npm install -g @mamdouh-aboammar/agent-kernel
agent-kernel --version
agent-kernel init --sync
agent-kernel doctor
```

The stable package version documented by this repository is `1.9.0`.

You can also inspect the CLI without a global install:

```bash
npx -y @mamdouh-aboammar/agent-kernel --version
```

## Native memory home

By default, Agent Kernel writes to:

```text
~/.agent-kernel
```

Override it before running commands when you need an isolated home:

```bash
export AGENT_KERNEL_HOME="$HOME/.agent-kernel-work"
agent-kernel init --sync
```

Do not point multiple uncoordinated users or machines at the same writable home. Agent Kernel is local-first and expects one local owner to review durable state.

## Understand the write boundary

Agent Kernel separates three actions:

1. read shared guidance
2. capture ephemeral runtime evidence
3. propose durable memory for user review

Agent identities use four trust levels:

| Trust level | Read | Capture sessions | Propose memory | Direct approved memory |
|---|---:|---:|---:|---:|
| `read-only` | yes | no | no | no |
| `capture-only` | yes | yes | no | no |
| `propose-only` | yes | yes | yes | no |
| `trusted-local` | yes | yes | yes | limited governed actions only |

Unknown agents receive a transient `read-only` identity and are not registered by a denied lookup.

Inspect current identities and modes before granting write access:

```bash
agent-kernel-agent-write mode list
agent-kernel-agent-write mode get codex
agent-kernel-agent-write mode set codex propose-only
```

Read:

- `AGENT_WRITE_MODES.md`
- `AGENT_PROPOSALS.md`

## Core proposal workflow

An agent creates a pending proposal:

```bash
agent-kernel-agent-propose \
  --from codex \
  --reason "The user corrected this workflow." \
  --text "Use pnpm in this repository."
```

The user reviews and decides:

```bash
agent-kernel inbox
agent-kernel approve <proposal-id> --publish
# or
agent-kernel reject <proposal-id>
```

The restricted proposal helper never approves or publishes memory. It rejects unsupported trust levels, ambiguous text sources, duplicate or unknown options, unsafe values, and invalid enums before calling the core runtime.

## Safe project setup

Use dry-run before writing into an existing project:

```bash
cd ~/Projects/YourProject

agent-kernel compile
agent-kernel-safe-link . --dry-run
agent-kernel-safe-link .
agent-kernel-safe-git-hook . --dry-run
agent-kernel-safe-git-hook .
agent-kernel doctor
```

This flow preserves existing project instructions and existing `pre-commit` hook logic.

The safe-link installer:

- updates only Agent Kernel managed blocks
- rejects ambiguous or corrupt marker layouts unless repair is requested explicitly
- refuses unsafe symbolic targets
- plans project writes before applying them
- rolls back partial project writes when an update fails

The safe Git hook installer:

- resolves the effective hooks path through Git
- supports normal repositories, linked worktrees, and `core.hooksPath`
- preserves user-owned hook code outside the managed block
- refuses symbolic hook targets and hook directories
- writes atomically and preserves executable permissions

Read `SAFE_LINKING.md` and `SAFE_GIT_HOOKS.md` before using `--force` repair options.

## Typical generated project surfaces

```text
AGENTS.md
CLAUDE.md
.cursor/rules/00-agent-kernel.mdc
.codex/AGENTS.md
.codex/config.toml
.agents/agents.md
.agents/skills/README.md
GEMINI.md
.git/hooks/pre-commit
```

Generated Agent Kernel blocks are reviewable execution surfaces. Keep credentials and private connection details in user-level configuration, not in generated repository files.

## Agent-specific setup

### Claude Code

```bash
agent-kernel enforce install
agent-kernel mcp install claude
```

Claude Code can use:

- `CLAUDE.md`
- SessionStart context injection
- UserPromptSubmit memory capture
- PreToolUse command and path guards
- PostToolUse file scanning
- Failure Lessons hooks
- Architecture Guardian scope hooks
- MCP tools

Read `integrations/CLAUDE_CODE_LIVE_CONTEXT.md` and `hooks/CLAUDE_HOOKS_BEST_PRACTICES.md` before changing hook configuration.

### Codex

```bash
agent-kernel sync
agent-kernel-safe-link .
```

Codex should read `AGENTS.md` and `.codex/AGENTS.md` when present.

Grant proposal access explicitly before asking Codex to save durable guidance:

```bash
agent-kernel-agent-write mode set codex propose-only
agent-kernel-agent-propose --from codex --reason "<reason>" --text "<memory>"
```

To wire the local MCP server into Codex, add the documented `[mcp_servers.agent-kernel-memory]` block to `~/.codex/config.toml`. The repository bootstrap script is idempotent:

```bash
./examples/scripts/install-agent-mcp.sh
```

Read `integrations/CODEX_LIVE_CONTEXT.md` for exact configuration and rollback.

### Cursor

```bash
agent-kernel-safe-link .
```

Cursor should read `.cursor/rules/00-agent-kernel.mdc`.

Grant proposal or runtime capture access explicitly:

```bash
agent-kernel-agent-write mode set cursor propose-only
agent-kernel-agent-propose --from cursor --reason "<reason>" --text "<memory>"
```

Read `integrations/CURSOR_LIVE_CONTEXT.md` for MCP and rollback details.

### OpenCode

```bash
agent-kernel-safe-link .
```

OpenCode should read `AGENTS.md` and can create pending proposals after its identity is granted `propose-only` or `trusted-local` access:

```bash
agent-kernel-agent-write mode set opencode propose-only
agent-kernel-agent-propose --from opencode --reason "<reason>" --text "<memory>"
```

Read `integrations/OPENCODE_LIVE_CONTEXT.md`.

### Gemini CLI

```bash
agent-kernel sync
agent-kernel-safe-link .
```

Gemini CLI should read `GEMINI.md`.

To wire the local MCP server into Gemini CLI, add the documented `mcpServers.agent-kernel-memory` block to `~/.gemini/settings.json`, or run:

```bash
./examples/scripts/install-agent-mcp.sh
```

### Antigravity and other file-based agents

```bash
agent-kernel-safe-link .
```

Antigravity should read `.agents/agents.md` and `.agents/skills/README.md`. Other AGENTS-compatible tools should read `AGENTS.md`.

The pointer installer can place a short managed reference in supported agent homes:

```bash
./examples/scripts/install-agent-pointers.sh
```

The pointer block is idempotent and marked with:

```text
<!-- agent-kernel:start -->
<!-- agent-kernel:end -->
```

## Verify the installation

Run the checks that match the installed surfaces:

```bash
agent-kernel --version
agent-kernel doctor
agent-kernel validate
agent-kernel status
```

For an existing project, preview the installers again. A settled setup should report no unexpected duplicate blocks or unsafe targets:

```bash
agent-kernel-safe-link . --dry-run
agent-kernel-safe-git-hook . --dry-run
```

For architecture-managed projects:

```bash
agent-kernel architecture doctor .
agent-kernel architecture policy validate .
agent-kernel architecture check . --json
```

## Back up and inspect local state

Before destructive cleanup or moving to another machine:

```bash
agent-kernel retention status --json
agent-kernel export ./agent-kernel-backup.json --redact --include-observations
agent-kernel import ./agent-kernel-backup.json --inspect --json
```

Normal imports create pending proposals. Replacement import is explicit and creates a local backup before changing managed state:

```bash
agent-kernel import ./agent-kernel-backup.json --replace
```

Read `RETENTION_AND_PORTABILITY.md` before pruning, importing, restoring, sharing, or committing exported data.

## Skills.sh discovery

The repository includes `SKILL.md` and `skills.sh.json` so compatible agents can discover Agent Kernel and its Architecture Guardian skill through Skills.sh.

## Claude marketplace

The `.claude-plugin/` folder contains Claude marketplace manifests. Package version, marketplace version, plugin version, and other version surfaces must remain aligned during releases.

## Next references

- `OPERATING_MODEL.md` for the governance loop
- `AGENT_WRITE_MODES.md` for runtime capture permissions
- `AGENT_PROPOSALS.md` for proposal validation and trust rules
- `SAFE_LINKING.md` for project instruction updates
- `SAFE_GIT_HOOKS.md` for worktree-safe pre-commit installation
- `RETENTION_AND_PORTABILITY.md` for cleanup, backup, restore, and reports
- `INTEGRATIONS.md` for the support matrix
- `TROUBLESHOOTING.md` for symptom-based diagnosis
