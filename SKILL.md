---
name: agent-kernel
description: |
  Local-first governance, memory, architecture conformance, and safety layer for AI coding agents.
  Use Agent Kernel when the user wants Claude Code, Codex, Cursor, OpenCode, Antigravity,
  Gemini CLI, or AGENTS.md-compatible agents to share persistent rules, preferences, workflows,
  Failure Lessons, episodic memory, approval inbox proposals, generated guidance files, MCP tools,
  hooks, deterministic command guards, or reviewed architecture boundaries. Best triggers include:
  remember this rule, save this workflow, propose memory, search past episodes, capture this failure,
  learn from this error, prevent architecture drift, search before creating a service, create a change
  contract, baseline existing debt, install agent guidance, safe-link this repo, configure MCP, add a
  guard policy, or make multiple coding agents follow the same standards without repeating context.
---

# Agent Kernel

Agent Kernel is a local-first governance kernel for AI coding agents.

It gives agents one shared source of truth for durable rules, project preferences, workflows, debugging lessons, architecture policies, generated instruction files, hooks, MCP tools, and safety checks.

Use this skill when the user wants coding agents to remain consistent across projects and sessions, or when working code must also respect reviewed architectural boundaries.

---

## What this skill provides

1. Shared JSON-first memory at `~/.agent-kernel/source/memories/*.json`.
2. Approval inbox where agents propose memory and the user decides what gets published.
3. Failure Lessons for turning repeated build, test, edit, and command failures into searchable evidence.
4. Episodic memory for session history, debugging context, decisions, and investigations.
5. Architecture Guardian for project maps, dependency rules, reuse search, change contracts, baselines, exceptions, reports, and scope hooks.
6. Generated guidance for Claude Code, Codex, Cursor, OpenCode, Antigravity, Gemini CLI, and AGENTS.md-compatible agents.
7. Safe project linking that preserves existing instructions outside Agent Kernel marked blocks.
8. Claude hooks, git hooks, MCP tools, deterministic command guards, and repo-local ECC scaffolding.

---

## When to activate this skill

Activate when the user says or implies:

- remember this rule
- save this as a workflow
- make all agents follow this standard
- stop the agent from repeating this mistake
- capture this error as a lesson
- search previous debugging history
- prevent AI-generated architecture drift
- check whether a service, validator, repository, or utility already exists
- stop writes outside an approved task scope
- baseline existing architecture debt
- enforce dependency boundaries or prevent cycles
- set up shared memory for agents
- connect Claude, Codex, Cursor, Gemini, OpenCode, or Antigravity
- install AGENTS.md, CLAUDE.md, Cursor rules, or Gemini guidance
- add hooks, guardrails, Architecture Guardian, or MCP support
- audit or repair Agent Kernel docs, memory, hooks, architecture state, or generated guidance
- propose a durable rule without approving it automatically

Do not activate it for generic coding tasks unless the user needs persistent governance, architecture conformance, memory, hooks, MCP, Failure Lessons, or cross-agent guidance.

---

## Mental model

```text
user rule, workflow, failure, or architecture boundary
  -> agent captures evidence, maps the project, or proposes memory
  -> user reviews inbox, policy, contract, baseline, or exception
  -> Agent Kernel publishes approved guidance or enforces reviewed constraints
  -> future agents inherit the same rules, lessons, and project boundaries
```

Important boundaries:

- Agents may capture and propose. They should not silently approve durable memory.
- Agents may inspect architecture state. They should not silently broaden policy, baseline, contract, or exception scope.
- Review mode reports candidate blockers. Strict mode enforces reviewed blockers.

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
.codex/AGENTS.md
.codex/config.toml
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

### Prevent architecture drift

Start in review mode:

```bash
agent-kernel architecture init .
agent-kernel architecture policy validate .
agent-kernel architecture discover . --json
agent-kernel architecture baseline . --json
```

Before creating a new capability:

```bash
agent-kernel architecture reuse "validate customer email" . --json
```

For a non-trivial task:

```bash
agent-kernel architecture contract init . \
  --task "Add subscription cancellation" \
  --owner billing \
  --allow "src/billing/**,test/billing/**" \
  --expect "src/billing/cancel-subscription.ts,test/billing/cancel-subscription.test.ts" \
  --tests "cancel active subscription,idempotent cancellation"
```

Before commit:

```bash
agent-kernel architecture check . --json
agent-kernel architecture check . --strict --json
```

Read `skills/architecture-guardian/SKILL.md` for the complete workflow. Baselines, policies, contracts, and exceptions require review. An exception needs scope, reason, owner, and expiry.

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
agent-kernel doctor [--runtime]
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
agent-kernel architecture init|discover|baseline|diff|check|reuse|contract|exception|policy|doctor
agent-kernel context [--query text] [--file path] [--budget 1200]
agent-kernel daemon start|stop|restart|status
agent-kernel session start|end|list|show|observe|observations
agent-kernel enforce install
agent-kernel guard [--staged|--file path]
agent-kernel git-hook install [project]
agent-kernel mcp serve|config|install
agent-kernel start <claude|codex|cursor|antigravity|gemini> [project]
agent-kernel status [--runtime]
```

Helper binaries:

```text
agent-kernel-safe-link
agent-kernel-safe-git-hook
agent-kernel-agent-propose
agent-kernel-failure
agent-kernel-failure-hook
agent-kernel-architecture
agent-kernel-architecture-hook
agent-kernel-daemon
agent-kernel-runtime-doctor
agent-kernel-session
agent-kernel-context
agent-kernel-mode
agent-kernel-agent-write
ak
```

---

## Failure Lessons behavior

Failure capture deduplicates by `project + command + errorSignature` by default. Repeated captures increment `occurrences` and update `lastSeenAt` instead of creating duplicate records.

Promotion is review-first. Valid promotion targets are `rule`, `policy`, `workflow`, `skill`, and `note`.

Agents may capture and propose. They must not silently approve or publish.

---

## Architecture Guardian behavior

Architecture Guardian stores project-local state under:

```text
<project>/.agent-kernel/architecture/
  policy.json
  current-map.json
  baseline.json
  change-contract.json
  exceptions.json
  reports/latest.json
```

It scans bounded source files without executing repository code. Deterministic checks include dependency direction, forbidden pairs, cycles, package policy, contract scope, new dependency approval, and file-count limits. Review findings include incomplete expected files and test evidence.

Known baseline findings remain visible but do not fail an unrelated change. External package findings include importer evidence. `--strict` can enforce a check without permanently changing the policy mode.

---

## Hook behavior

Claude failure capture should use:

- `PostToolUseFailure`
- narrow matchers such as `Bash|Write|Edit|MultiEdit`
- exec-form command hooks with `command` and `args`
- short timeouts
- structured JSON output with `hookSpecificOutput.additionalContext`

Architecture scope enforcement uses `PreToolUse` with `Write|Edit|MultiEdit`. It checks file scope only. Content-dependent dependency checks run after the file exists.

Hooks are lifecycle adapters, not hidden agents. They should not approve memory, publish memory, change architecture policy, create broad exceptions, run autonomous workflows, or leak credentials.

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

Approval through MCP is disabled by default unless the user explicitly asks for a trusted local workflow. Architecture Guardian currently uses CLI and hook surfaces rather than hidden MCP policy mutation tools.

---

## Memory and architecture layout

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

<project>/.agent-kernel/
  architecture/
```

Generated files in `~/.agent-kernel/dist/` are disposable outputs. Source JSON, proposals, episodes, policies, Failure Lessons, and reviewed project architecture state are canonical.

---

## Agent compatibility

| Agent | Shared memory | Main output or integration |
|---|---|---|
| Claude Code | yes | `CLAUDE.md`, hooks, MCP config, marketplace metadata, Architecture Guardian skill |
| Codex | yes | `AGENTS.md`, `.codex/AGENTS.md`, `.codex/config.toml`, repo-local skills |
| Cursor | yes | `.cursor/rules/00-agent-kernel.mdc` |
| OpenCode | yes | `AGENTS.md` |
| Antigravity | yes | `.agents/agents.md`, `.agents/skills/*` |
| Gemini CLI | yes | `GEMINI.md` |
| AGENTS.md-compatible tools | yes | `AGENTS.md` |
| Skills.sh surfaces | yes | `SKILL.md`, `skills.sh.json`, `skills/architecture-guardian/SKILL.md` |

---

## Safety rules for agents

- Do not approve or publish memory unless the user explicitly asks.
- Do not edit generated guidance as the durable source of truth.
- Do not silently broaden architecture policy, baseline, contract, or exception state.
- Do not store secrets, `.env` values, MCP credentials, or local auth files in repo-local config.
- Search Failure Lessons before repeating the same failing command.
- Search architecture reuse candidates before creating a parallel capability.
- Use safe-link before modifying existing project guidance files.
- Treat hooks as narrow, auditable lifecycle adapters.
- When behavior changes, update README, relevant docs, tests, schemas, templates, and discovery metadata together.

---

## Documentation

Start with:

- [docs/README.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/README.md)
- [docs/OPERATING_MODEL.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/OPERATING_MODEL.md)
- [docs/ARCHITECTURE_NOW.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/ARCHITECTURE_NOW.md)
- [docs/ARCHITECTURE_GUARDIAN.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/ARCHITECTURE_GUARDIAN.md)
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
skills/architecture-guardian/SKILL.md
skills.sh.json
.claude-plugin/marketplace.json
.claude-plugin/plugin.json
.claude/skills/agent-kernel/SKILL.md
.claude/skills/architecture-guardian/SKILL.md
.agents/skills/agent-kernel/SKILL.md
.agents/skills/architecture-guardian/SKILL.md
```

---

## Repository

https://github.com/imMamdouhaboammar/agent-kernel

## License

MIT © Mamdouh Aboammar
