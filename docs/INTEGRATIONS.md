# Integrations

Agent Kernel distributes the same local memory and governance model across multiple coding-agent surfaces.

The source of truth remains local:

```text
~/.agent-kernel/source/
```

Integrations compile or expose that state to each agent. Generated files are delivery surfaces, not canonical memory.

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

---

## Claude Code

Recommended setup:

```bash
agent-kernel init --sync --enforce
agent-kernel mcp install claude
agent-kernel-safe-link . --dry-run
agent-kernel-safe-link .
agent-kernel-safe-git-hook . --dry-run
agent-kernel-safe-git-hook .
```

Typical global files:

```text
~/.claude/CLAUDE.md
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
| MCP server | Search/read/propose memory through local Agent Kernel tools |
| `PreToolUse` hooks | Guard commands before execution |
| `PostToolUseFailure` hooks | Capture Failure Lessons after failed tool calls |

Failure capture should use `PostToolUseFailure` rather than broad `PostToolUse`.

See:

- `docs/hooks/FAILURE_LESSONS_HOOK.md`
- `docs/hooks/CLAUDE_HOOKS_BEST_PRACTICES.md`

---

## Codex

Recommended setup:

```bash
agent-kernel sync
agent-kernel-safe-link . --dry-run
agent-kernel-safe-link .
```

Typical files:

```text
~/.codex/AGENTS.md
AGENTS.md
.codex/AGENTS.md
.codex/config.toml
.codex/agents/*.toml
.agents/skills/agent-kernel/SKILL.md
.agents/skills/agent-kernel/agents/openai.yaml
```

Codex should read `AGENTS.md` and repo-local Codex guidance where available. If Codex identifies a durable new rule, it should create a pending proposal rather than editing generated files.

The repo-local ECC bundle adds a Codex baseline with role configs for exploration, review, and docs research. Keep private credentials and private MCP server details in user-level Codex config, not in this repository.

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
AGENTS.md
```

Cursor should read compiled rules and project notes. If the agent identifies a durable new rule, it should create a pending proposal rather than editing generated files.

Suggested agent instruction:

```bash
agent-kernel-agent-propose --from cursor --reason "<reason>" --text "<memory>"
```

---

## OpenCode and AGENTS.md-compatible agents

Project setup:

```bash
agent-kernel-safe-link . --dry-run
agent-kernel-safe-link .
```

Typical file:

```text
AGENTS.md
```

Any agent that reads `AGENTS.md` can consume the compiled Agent Kernel guidance.

Suggested agent instruction:

```bash
agent-kernel-agent-propose --from opencode --reason "<reason>" --text "<memory>"
```

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

1. Generated guidance is disposable. Edit source memory, not generated files.
2. Agents may propose memory. Users approve memory.
3. Failure Lessons capture local evidence first, then create pending proposals when useful.
4. Hooks should be narrow and event-specific.
5. MCP approval remains disabled unless the user explicitly enables it.
6. Repo-local configs are reviewable execution surfaces. Keep them minimal and auditable.
7. Existing project instructions are user-owned. Use safe-link first unless replacement is intentional.
