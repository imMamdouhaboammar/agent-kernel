# Integrations

Agent Kernel distributes the same local memory and governance model across multiple coding-agent surfaces.

The source of truth remains local:

```text
~/.agent-kernel/source/
```

Integrations compile or expose that state to each agent. Generated files are delivery surfaces, not canonical memory.

## Detailed live context guides

Use these guides for exact generated-file, MCP, optional daemon, trust, limitation, and rollback instructions:

```text
docs/integrations/CLAUDE_CODE_LIVE_CONTEXT.md
docs/integrations/CODEX_LIVE_CONTEXT.md
docs/integrations/CURSOR_LIVE_CONTEXT.md
docs/integrations/OPENCODE_LIVE_CONTEXT.md
```

---

## Recommended adoption order

For an existing project, use this sequence before configuring individual agents:

```bash
agent-kernel init --sync --enforce
agent-kernel compile
agent-kernel-safe-link . --dry-run
agent-kernel-safe-link .
agent-kernel-safe-git-hook . --dry-run
agent-kernel-safe-git-hook .
agent-kernel doctor
```

This path protects existing `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, Cursor rules, and `.agents` guidance by writing Agent Kernel content inside marked blocks.

Use `agent-kernel link . --hooks` only when you intentionally want the main CLI linker behavior.

The optional runtime daemon is not required for generated files or MCP:

```bash
agent-kernel daemon start
agent-kernel daemon status
agent-kernel daemon stop
```

---

## Claude Code

Recommended setup:

```bash
agent-kernel init --sync --enforce
agent-kernel-safe-link . --dry-run
agent-kernel-safe-link .
claude mcp add --transport stdio --scope user agent-kernel-memory -- agent-kernel mcp serve
claude mcp list
```

Typical global files:

```text
~/.claude/CLAUDE.md
~/.claude.json
~/.claude/settings.json
```

Typical project-local files:

```text
CLAUDE.md
AGENTS.md
```

Claude integration may include:

| Surface | Purpose |
|---|---|
| `CLAUDE.md` | Compiled durable guidance |
| `AGENTS.md` | Cross-agent fallback guidance |
| MCP server | Search memory, request context, and create pending proposals |
| `PreToolUse` hooks | Guard commands and protected paths before execution |
| `PostToolUseFailure` hooks | Capture Failure Lessons after failed tool calls |

Failure capture should use `PostToolUseFailure` rather than broad `PostToolUse` when failure-specific evidence is required.

See:

- `docs/integrations/CLAUDE_CODE_LIVE_CONTEXT.md`
- `docs/hooks/CLAUDE_CONTEXT_AND_FAILURE_HOOK.md`
- `docs/hooks/FAILURE_LESSONS_HOOK.md`
- `docs/hooks/CLAUDE_HOOKS_BEST_PRACTICES.md`

---

## Codex

Recommended setup:

```bash
agent-kernel sync
agent-kernel-safe-link . --dry-run
agent-kernel-safe-link .
codex mcp add agent-kernel-memory -- agent-kernel mcp serve
codex mcp list
```

Typical files:

```text
~/.codex/AGENTS.md
~/.codex/config.toml
AGENTS.md
.codex/AGENTS.md
.codex/config.toml
.codex/agents/*.toml
.agents/skills/agent-kernel/SKILL.md
.agents/skills/agent-kernel/agents/openai.yaml
```

Codex should read `AGENTS.md` and request compact MCP context where useful. If Codex identifies a durable new rule, it should create a pending proposal rather than editing generated files.

Agent Kernel does not claim native Codex blocking hooks. Hook enforcement depends on the host environment or an external wrapper.

See:

- `docs/integrations/CODEX_LIVE_CONTEXT.md`
- `docs/adapters/CODEX.md`

---

## Cursor

Project setup:

```bash
agent-kernel-safe-link . --dry-run
agent-kernel-safe-link .
```

Typical files:

```text
.cursor/rules/00-agent-kernel.mdc
.cursor/mcp.json
AGENTS.md
```

Example MCP configuration:

```json
{
  "mcpServers": {
    "agent-kernel-memory": {
      "command": "agent-kernel",
      "args": ["mcp", "serve"]
    }
  }
}
```

Cursor should read compiled rules and ask MCP for project or file context. If it identifies a durable new rule, it should create a pending proposal rather than editing generated files.

Agent Kernel does not currently ship a native Cursor hook adapter.

Suggested proposal command:

```bash
agent-kernel-agent-propose --from cursor --reason "<reason>" --text "<memory>"
```

See:

- `docs/integrations/CURSOR_LIVE_CONTEXT.md`

---

## OpenCode and AGENTS.md-compatible agents

Project setup:

```bash
agent-kernel-safe-link . --dry-run
agent-kernel-safe-link .
```

Typical files:

```text
AGENTS.md
opencode.jsonc
```

Example OpenCode MCP configuration:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "agent-kernel-memory": {
      "type": "local",
      "command": ["agent-kernel", "mcp", "serve"],
      "enabled": true
    }
  }
}
```

Any agent that reads `AGENTS.md` can consume the compiled Agent Kernel guidance. OpenCode can also request compact context through MCP.

Agent Kernel does not currently ship a native OpenCode hook adapter.

Suggested proposal command:

```bash
agent-kernel-agent-propose --from opencode --reason "<reason>" --text "<memory>"
```

See:

- `docs/integrations/OPENCODE_LIVE_CONTEXT.md`

---

## Antigravity

Project setup:

```bash
agent-kernel-safe-link . --dry-run
agent-kernel-safe-link .
```

Typical files:

```text
.agents/agents.md
.agents/skills/README.md
```

The generated guidance points Antigravity-style agents back to the same memory and approval workflow.

---

## Gemini CLI

Global setup:

```bash
agent-kernel sync
```

Project setup:

```bash
agent-kernel-safe-link . --dry-run
agent-kernel-safe-link .
```

Typical file:

```text
GEMINI.md
```

Gemini should read `GEMINI.md`. If Gemini identifies a durable new rule, route it through a proposal instead of direct file edits.

---

## Skills.sh and marketplace discovery

Root discovery files:

```text
SKILL.md
skills.sh.json
.claude-plugin/marketplace.json
.claude-plugin/plugin.json
```

These files should stay aligned with package version and current capabilities. When adding a major command surface, update all relevant discovery docs.

---

## ECC repo-local bundle

The ECC bundle adds generated repository-local scaffolding:

```text
.claude/ecc-tools.json
.claude/identity.json
.claude/skills/agent-kernel/SKILL.md
.claude/commands/*.md
.claude/homunculus/instincts/inherited/agent-kernel-instincts.yaml
.codex/AGENTS.md
.codex/config.toml
.codex/agents/*.toml
.agents/skills/agent-kernel/SKILL.md
.agents/skills/agent-kernel/agents/openai.yaml
```

Treat these as workflow acceleration assets. Do not store secrets in them.

---

## Integration rules

1. Generated guidance is disposable. Edit source memory through the governed workflow, not generated files.
2. Agents may capture evidence and propose memory. Users approve memory.
3. Failure Lessons capture local evidence first, then create pending proposals when useful.
4. Hooks should be narrow and event-specific.
5. MCP approval remains disabled unless the user explicitly enables it.
6. Repo-local configs are reviewable execution surfaces. Keep them minimal and auditable.
7. Existing project instructions are user-owned. Use safe-link first unless replacement is intentional.
8. The daemon is optional and local-only by default.
9. Do not claim native hooks for a client unless Agent Kernel ships and tests that adapter.
10. Keep secrets out of repository-local integration configuration.
