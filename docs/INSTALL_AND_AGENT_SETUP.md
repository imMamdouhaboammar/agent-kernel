# Install and agent setup

This is the lightweight setup path for using Agent Kernel as a shared local memory layer across coding agents.

## Install

```bash
npm install -g @mamdouh-aboammar/agent-kernel
agent-kernel --version
agent-kernel init --sync
agent-kernel doctor
```

## Native memory home

By default, Agent Kernel writes to:

```text
~/.agent-kernel
```

Override it when needed:

```bash
export AGENT_KERNEL_HOME="$HOME/.agent-kernel-work"
```

## Core workflow

```bash
# User or agent proposes memory
agent-kernel-agent-propose --from codex --reason "User asked to remember this" --text "Use pnpm in this repo."

# User reviews
agent-kernel inbox

# User approves and publishes
agent-kernel approve <proposal-id> --publish
```

## Project setup

Use the safe path first:

```bash
agent-kernel compile
agent-kernel-safe-link . --dry-run
agent-kernel-safe-link .
agent-kernel-safe-git-hook . --dry-run
agent-kernel-safe-git-hook .
```

This preserves existing project instructions and existing pre-commit hook logic.

## Agent-specific notes

### Claude Code

```bash
agent-kernel enforce install
agent-kernel mcp install claude
```

Claude can use:

- `CLAUDE.md`
- SessionStart context injection
- UserPromptSubmit memory capture
- PreToolUse command/path guard
- PostToolUse file scan
- MCP tools

### Codex

```bash
agent-kernel sync
agent-kernel-safe-link .
```

Codex should read `AGENTS.md`. For memory writes, instruct Codex to call:

```bash
agent-kernel-agent-propose --from codex --reason "<reason>" --text "<memory>"
```

### Cursor

```bash
agent-kernel-safe-link .
```

Cursor should read `.cursor/rules/00-agent-kernel.mdc`. For memory writes, instruct Cursor to call:

```bash
agent-kernel-agent-propose --from cursor --reason "<reason>" --text "<memory>"
```

### Antigravity

```bash
agent-kernel-safe-link .
```

Antigravity should read `.agents/agents.md` and `.agents/skills/README.md`.

### OpenCode

```bash
agent-kernel-safe-link .
```

OpenCode should read `AGENTS.md` and can write proposals through:

```bash
agent-kernel-agent-propose --from opencode --reason "<reason>" --text "<memory>"
```

### Gemini CLI

```bash
agent-kernel sync
agent-kernel-safe-link .
```

Gemini should read `GEMINI.md`.

## Skills.sh discovery

The repo includes `SKILL.md` and `skills.sh.json` so agents can discover the project through Skills.sh and use the instructions to install/configure Agent Kernel.

## Claude marketplace

The `.claude-plugin/` folder contains Claude marketplace manifests. Keep those in sync with package metadata when releasing.
