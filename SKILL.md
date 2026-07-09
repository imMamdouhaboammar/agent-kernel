---
name: agent-kernel
description: |
  Local-first governance, memory, and safety layer for AI coding agents. Use Agent Kernel
  when the user wants Claude Code, Codex, Cursor, OpenCode, Antigravity, Gemini CLI, or
  AGENTS.md-compatible agents to share persistent project rules, preferences, workflows,
  Failure Lessons, episodic memory, approval inbox proposals, generated guidance files,
  MCP tools, hooks, and deterministic guardrails. Best triggers include: remember this rule,
  save this workflow, propose memory, search past episodes, capture this failure, learn from
  this error, turn this bug into a reusable lesson, install agent guidance, safe-link this repo,
  set up Claude or Codex instructions, audit agent rules, configure MCP, add a guard policy,
  or make multiple coding agents follow the same standards without repeating context.
---

# Agent Kernel

Agent Kernel is a local-first governance kernel for AI coding agents.

It gives agents one shared source of truth for durable rules, project preferences, workflows, notes, debugging lessons, generated instruction files, hooks, MCP tools, and safety checks.

Use this skill when the user wants to make AI coding agents more consistent, safer, and less stateless across projects and sessions.

---

## What this skill provides

Agent Kernel provides:

1. Shared JSON-first memory at `~/.agent-kernel/source/memories/*.json`.
2. Approval inbox where agents can propose memory but the user decides what gets published.
3. Failure Lessons for turning repeated build, test, edit, and command failures into searchable lessons.
4. Episodic memory for session history, debugging context, decisions, and investigations.
5. Generated guidance for Claude Code, Codex, Cursor, OpenCode, Antigravity, Gemini CLI, and AGENTS.md-compatible agents.
6. Safe project linking that preserves existing project instructions outside Agent Kernel marked blocks.
7. Claude hooks, git hooks, MCP tools, and deterministic command guards.
8. Repo-local ECC scaffolding for Claude Code and Codex.

---

## When to activate this skill

Activate when the user says or implies:

- remember this rule
- save this as a workflow
- make all agents follow this standard
- stop the agent from repeating this mistake
- capture this error as a lesson
- search previous debugging history
- set up shared memory for agents
- connect Claude, Codex, Cursor, Gemini, OpenCode, or Antigravity
- install AGENTS.md, CLAUDE.md, Cursor rules, or Gemini guidance
- add hooks, guardrails, or MCP support
- audit or repair Agent Kernel docs, memory, hooks, or generated guidance
- propose a rule but do not approve it automatically

Do not activate it for generic coding tasks unless the user needs persistent memory, governance, rules, hooks, MCP, Failure Lessons, or cross-agent guidance.

---

## Mental model

```text
user rule, workflow, or failure
  -> agent captures evidence or proposes memory
  -> user reviews inbox or lesson
  -> Agent Kernel publishes approved source memory
  -> generated guidance is compiled and linked into projects
  -> future agents inherit the same rules and lessons
```

Important boundary: agents may propose and capture. Agents should not silently approve or publish durable memory.

---

## Fast setup

Use the safe path first, especially in repositories that already have hand-written guidance files.

```bash
npm install -g @mamdouh-aboammar/agent-kernel
agent-kernel --version
agent-kernel doctor

cd ~/Projects/YourProject
agent-kernel init --sync --enforce
agent-kernel compile
agent-kernel-safe-link . --dry-run
agent-kernel-safe-link .
agent-kernel-safe-git-hook . --dry-run
agent-kernel-safe-git-hook .
agent-kernel doctor
```

Typical generated project outputs:

```text
AGENTS.md
CLAUDE.md
.cursor/rules/00-agent-kernel.mdc
.agents/agents.md
.agents/skills/README.md
GEMINI.md
.git/hooks/pre-commit
```

Use direct linking only when the user intentionally wants main CLI linker behavior in a clean or controlled project:

```bash
agent-kernel link . --hooks
```

---

## Core workflows

### Save a user-approved durable rule

```bash
agent-kernel remember "Never add local SQLite fallback to production Supabase apps." \
  --type policy \
  --level critical \
  --tags supabase,database \
  --publish
```

### Propose memory as an agent

```bash
agent-kernel propose \
  --from claude \
  --text "Use pnpm in this repository." \
  --reason "User corrected the package manager during setup."

agent-kernel inbox
agent-kernel approve <proposal-id> --publish
```

Agents should stop at proposal creation unless the user explicitly asks for approval and publishing.

### Capture a Failure Lesson

```bash
agent-kernel failure capture \
  --from claude \
  --type test-failure \
  --command "npm test" \
  --exit-code 1 \
  --text "ERR_MODULE_NOT_FOUND ..." \
  --root-cause "Node ESM import path missed its explicit extension." \
  --fix "Add the explicit .js extension to the relative import."
```

Search before retrying:

```bash
agent-kernel failure search "ERR_MODULE_NOT_FOUND"
```

Promote only reusable lessons:

```bash
agent-kernel failure propose <failure-lesson-id> --as rule
agent-kernel inbox
agent-kernel approve <proposal-id> --publish
```

### Capture an episode

```bash
agent-kernel episode add \
  --title "Stripe webhook bug fix" \
  --tags stripe,webhook,bug \
  --text "Root cause: missing signature verification. Fix: verify signature with stripe.webhooks.constructEvent()."

agent-kernel episode search "stripe webhook"
```

---

## Command surface

```text
agent-kernel init [--sync] [--enforce]
agent-kernel doctor
agent-kernel compile
agent-kernel sync
agent-kernel link [project] [--hooks]
agent-kernel remember "rule text" [--type rule] [--level critical] [--publish]
agent-kernel propose --from claude --text "rule text" --reason "..."
agent-kernel inbox
agent-kernel approve <id> [--publish]
agent-kernel reject <id>
agent-kernel publish
agent-kernel validate
agent-kernel migrate json [--publish]
agent-kernel memory list|search|show
agent-kernel episode add|sync|search|show|stats|reindex
agent-kernel failure capture|learn|list|search|show|propose|promote|validate
agent-kernel enforce install
agent-kernel guard [--staged|--file path]
agent-kernel git-hook install [project]
agent-kernel mcp serve|config|install
agent-kernel start <claude|codex|cursor|antigravity|gemini> [project]
agent-kernel status
```

Helper binaries:

```text
agent-kernel-safe-link
agent-kernel-safe-git-hook
agent-kernel-agent-propose
agent-kernel-failure
agent-kernel-failure-hook
agent-kernel-mode
agent-kernel-agent-write
ak
```

---

## Failure Lessons behavior

Failure capture deduplicates by `project + command + errorSignature` by default. Repeated captures increment `occurrences` and update `lastSeenAt` instead of creating duplicate records.

Promotion is review-first:

```bash
agent-kernel failure propose <failure-lesson-id> --as rule
agent-kernel inbox
agent-kernel approve <proposal-id> --publish
```

Valid promotion targets include:

```text
rule
policy
workflow
skill
note
```

Agents may capture and propose. They must not silently approve or publish.

---

## Hook behavior

Claude failure capture should use:

- `PostToolUseFailure`
- narrow matchers such as `Bash|Write|Edit|MultiEdit`
- exec-form command hooks with `command` and `args`
- short timeouts
- structured JSON output with `hookSpecificOutput.additionalContext`

Hooks are lifecycle adapters, not hidden agents. They should not approve memory, publish memory, run broad autonomous workflows, or leak credentials.

---

## MCP behavior

MCP should help agents inspect and propose, not silently govern.

Safe MCP uses:

- inspect status
- search memory
- propose memory
- list pending proposals
- run guard checks
- work with episodes where supported

Approval through MCP is disabled by default unless the user explicitly asks for a trusted local workflow.

---

## Memory layout

```text
~/.agent-kernel/
  source/
    memories/
    failures/
    policies/
    schemas/
  episodes/
  inbox/
  dist/
  logs/
```

Generated files in `dist/` are disposable outputs. Source JSON, proposals, episodes, policies, and Failure Lessons are canonical.

---

## Agent compatibility

| Agent | Memory source | Main output or integration |
|---|---|---|
| Claude Code | yes | `CLAUDE.md`, hooks, MCP config, marketplace metadata |
| Codex | yes | `AGENTS.md`, `.codex/AGENTS.md`, `.codex/config.toml` |
| Cursor | yes | `.cursor/rules/00-agent-kernel.mdc` |
| OpenCode | yes | `AGENTS.md` |
| Antigravity | yes | `.agents/agents.md`, `.agents/skills/*` |
| Gemini CLI | yes | `GEMINI.md` |
| AGENTS.md-compatible tools | yes | `AGENTS.md` |
| Skills.sh surfaces | yes | `SKILL.md`, `skills.sh.json` |

---

## Safety rules for agents

- Do not approve or publish memory unless the user explicitly asks.
- Do not edit generated guidance as the durable source of truth.
- Do not store secrets, `.env` values, MCP credentials, or local auth files in repo-local config.
- Search Failure Lessons before repeating the same failing command.
- Use safe-link before modifying existing project guidance files.
- Treat hooks as narrow, auditable lifecycle adapters.
- When behavior changes, update README, relevant docs, tests, and discovery metadata together.

---

## Documentation

Start with:

- [docs/README.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/README.md)
- [docs/OPERATING_MODEL.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/OPERATING_MODEL.md)
- [docs/ARCHITECTURE_NOW.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/ARCHITECTURE_NOW.md)
- [docs/TROUBLESHOOTING.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/TROUBLESHOOTING.md)
- [docs/AGENT_RUNBOOK.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/AGENT_RUNBOOK.md)
- [docs/MEMORY_PROTOCOL.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/MEMORY_PROTOCOL.md)
- [docs/FAILURE_LESSONS_PROTOCOL.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/FAILURE_LESSONS_PROTOCOL.md)
- [docs/MCP_SERVER.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/MCP_SERVER.md)
- [docs/SAFE_LINKING.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/SAFE_LINKING.md)
- [docs/INTEGRATIONS.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/INTEGRATIONS.md)

---

## Discovery and install surfaces

```bash
npx skills add imMamdouhaboammar/agent-kernel -a claude-code -g -y
npm install -g @mamdouh-aboammar/agent-kernel
```

Discovery files:

```text
SKILL.md
skills.sh.json
.claude-plugin/marketplace.json
.claude-plugin/plugin.json
.claude/skills/agent-kernel/SKILL.md
.agents/skills/agent-kernel/SKILL.md
```

---

## Repository

https://github.com/imMamdouhaboammar/agent-kernel

## License

MIT © Mamdouh Aboammar
