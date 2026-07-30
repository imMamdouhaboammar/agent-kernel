# Install and agent setup

This guide covers the supported installation and the safest way to connect coding agents without turning generated guidance, project files, or credentials into a second source of truth.

## Requirements

- Node.js `>=18.18.0`
- npm, Bun, or another package runner capable of installing the npm package
- Git for repository-aware commands, hooks, and commit evidence
- one local owner for the selected Agent Kernel home

Agent Kernel has zero runtime npm dependencies.

## Install

With npm:

```bash
npm install -g @mamdouh-aboammar/agent-kernel
agent-kernel --version
agent-kernel init --sync
agent-kernel doctor
```

With Bun:

```bash
bun install -g @mamdouh-aboammar/agent-kernel
agent-kernel --version
agent-kernel init --sync
agent-kernel doctor
```

The stable package version represented by this repository is `1.18.0`.

One-off inspection:

```bash
npx -y @mamdouh-aboammar/agent-kernel --version
bunx @mamdouh-aboammar/agent-kernel --version
```

Prefer a global install for hooks, MCP clients, and generated project commands that need a stable executable path.

## Local home

The default local home is:

```text
~/.agent-kernel
```

Use an isolated home for tests, migration rehearsals, or separate work profiles:

```bash
export AGENT_KERNEL_HOME="$HOME/.agent-kernel-work"
agent-kernel init --sync
```

Do not share one writable home between unrelated users or machines. Local file ownership is part of the trust boundary.

## Two separate write controls

Agent Kernel has two different controls. Do not confuse them.

### Agent identity trust

| Trust | Read | Capture evidence | Propose memory | Direct durable write |
|---|---:|---:|---:|---:|
| `read-only` | yes | no | no | no |
| `capture-only` | yes | yes | no | no |
| `propose-only` | yes | yes | yes | no |
| `trusted-local` | yes | yes | yes | governed only |

Manage identities with the registry commands:

```bash
agent-kernel agent list --json
agent-kernel agent add codex --trust propose-only --surface cli
agent-kernel agent set codex --trust capture-only
agent-kernel agent show codex --json
```

Unknown agents are not silently granted write access.

### Global memory write mode

```bash
agent-kernel-mode show
agent-kernel-mode set approval
agent-kernel-mode set trusted
agent-kernel-mode set bypass
```

- `approval`: agent writes become pending proposals
- `trusted`: low-risk project-scoped memory may be accepted
- `bypass`: approved memory may be written directly

Use `approval` by default. `trusted` and `bypass` require deliberate user acceptance.

## Proposal workflow

Agent proposal:

```bash
agent-kernel-agent-propose \
  --from codex \
  --reason "The user corrected this workflow." \
  --text "Use pnpm in this repository."
```

User review:

```bash
agent-kernel inbox
agent-kernel approve <proposal-id> --publish
# or
agent-kernel reject <proposal-id>
```

The proposal helper never approves or publishes memory.

## Safe project setup

For an existing repository:

```bash
cd /path/to/project
agent-kernel compile
agent-kernel-safe-link . --dry-run
agent-kernel-safe-link .
agent-kernel-safe-git-hook . --dry-run
agent-kernel-safe-git-hook .
agent-kernel doctor
```

The safe-link installer:

- changes only Agent Kernel managed blocks
- preserves user content outside markers
- refuses ambiguous marker layouts unless `--force` repair is explicit
- refuses unsafe symbolic targets
- plans writes and rolls back partial application

The safe Git hook installer:

- resolves normal repositories, linked worktrees, and `core.hooksPath`
- preserves non-Agent-Kernel hook logic
- refuses symbolic hook targets and hook directories
- writes atomically and preserves executable permissions where meaningful

Read `SAFE_LINKING.md` and `SAFE_GIT_HOOKS.md` before using `--force`.

## Project Context Broker setup

Use Project Context Broker when a repository needs global memory with local project isolation:

```bash
agent-kernel project connect --dry-run
agent-kernel project connect --yes
agent-kernel project status --json
agent-kernel project doctor
```

Connection creates managed project files such as:

```text
.agent-kernel/project.toml
.agent-kernel/policy.toml
```

Global connection state remains under:

```text
~/.agent-kernel/connections/
~/.agent-kernel/logs/project-audit.jsonl
```

Project manifests may contain identifiers, capability flags, environments, provider profile names, and target metadata. They must not contain raw credentials.

## Generated project surfaces

Typical outputs include:

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

Generated files are delivery surfaces. Fix source memory or compiler behavior, then regenerate.

## Claude Code

```bash
agent-kernel enforce install
agent-kernel mcp install claude
agent-kernel mcp test
```

Claude can use:

- `CLAUDE.md` and `AGENTS.md`
- local stdio MCP
- narrow `PreToolUse` guards
- `PostToolUseFailure` Failure Lessons capture
- Architecture Guardian scope hooks

Read `integrations/CLAUDE_CODE_LIVE_CONTEXT.md` and `hooks/CLAUDE_HOOKS_BEST_PRACTICES.md` before changing hooks.

## Codex

```bash
agent-kernel sync
agent-kernel-safe-link .
codex mcp add agent-kernel-memory -- agent-kernel mcp serve
codex mcp list
```

Codex should read `AGENTS.md`, `.codex/AGENTS.md`, and the AGENTS-compatible skill. Agent Kernel does not claim native Codex blocking hooks.

## Cursor

```bash
agent-kernel-safe-link .
```

Cursor reads `.cursor/rules/00-agent-kernel.mdc` and can start the local MCP server through `.cursor/mcp.json`. Agent Kernel does not currently ship a native Cursor hook adapter.

## OpenCode

OpenCode reads `AGENTS.md` and can configure `agent-kernel mcp serve` as a local MCP process. Agent Kernel does not currently ship a native OpenCode hook adapter.

## Gemini CLI

```bash
agent-kernel sync
agent-kernel-safe-link .
```

Gemini reads `GEMINI.md`. Use the client-specific MCP configuration described in `INTEGRATIONS.md`.

## Antigravity and file-based agents

Antigravity reads `.agents/agents.md` and `.agents/skills/`. Other AGENTS-compatible tools use `AGENTS.md` and `.agents/skills/agent-kernel/SKILL.md`.

## MCP setup and trust

Inspect the default core surface:

```bash
agent-kernel mcp test
```

Core mode exposes ten bounded tools. Extended mode is explicit:

```bash
AGENT_KERNEL_MCP_TOOLS=extended agent-kernel mcp test
```

Do not enable MCP approval as part of normal installation. It requires extended mode plus `AGENT_KERNEL_MCP_ALLOW_APPROVE=1`. MCP publish and delete tools are never exposed.

## Optional daemon

The daemon is not required for generated guidance or MCP.

```bash
agent-kernel daemon start
agent-kernel daemon status --json
agent-kernel daemon stop
```

Remote binding is rejected unless both controls are present:

```bash
export AGENT_KERNEL_DAEMON_ALLOW_REMOTE=1
export AGENT_KERNEL_DAEMON_TOKEN="$(openssl rand -hex 32)"
```

Use private transport. Do not expose the daemon directly to the public internet.

## Verify installation

```bash
agent-kernel --version
agent-kernel doctor
agent-kernel validate
agent-kernel status
agent-kernel mcp test
```

For linked projects:

```bash
agent-kernel-safe-link . --dry-run
agent-kernel-safe-git-hook . --dry-run
agent-kernel project status --json
agent-kernel project doctor
```

For architecture-managed projects:

```bash
agent-kernel architecture doctor . --json
agent-kernel architecture policy validate . --json
agent-kernel architecture check . --json
```

## Back up and inspect state

```bash
agent-kernel retention status --json
agent-kernel export ./agent-kernel-backup.json --redact --include-observations
agent-kernel import ./agent-kernel-backup.json --inspect --json
```

Normal import should remain review-first. Replacement import is explicit and creates a backup before applying managed state.

## Discovery surfaces

```text
SKILL.md
skills.sh.json
skills/architecture-guardian/SKILL.md
.claude/skills/agent-kernel/SKILL.md
.claude/skills/architecture-guardian/SKILL.md
.agents/skills/agent-kernel/SKILL.md
.agents/skills/architecture-guardian/SKILL.md
.claude-plugin/marketplace.json
.claude-plugin/plugin.json
```

## Next references

- `COMMAND_REFERENCE.md`
- `ENVIRONMENT_VARIABLES.md`
- `OPERATING_MODEL.md`
- `PROJECT_CONNECTION.md`
- `MCP_SERVER.md`
- `ARCHITECTURE_GUARDIAN.md`
- `SECURE_RUNTIME_AND_RELEASES.md`
- `TROUBLESHOOTING.md`
