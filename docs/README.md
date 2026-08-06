# Agent Kernel Documentation

This folder is the canonical documentation set for Agent Kernel.

Use it to understand the current runtime, connect agent surfaces, update memory behavior, review trust and hook safety, prevent architecture drift, troubleshoot setup, manage portable local state, inspect the static memory dashboard, and operate the trusted CLI updater.

---

## Start here

| Situation | Read first | Then read |
|---|---|---|
| I want to install and use Agent Kernel | `INSTALL_AND_AGENT_SETUP.md` | `COMMAND_REFERENCE.md`, `ENVIRONMENT_VARIABLES.md`, `OPERATING_MODEL.md` |
| I want to connect any software project to Agent Kernel | `PROJECT_CONNECTION.md` | `INSTALL_AND_AGENT_SETUP.md`, `SAFE_LINKING.md` |
| I want to preserve local project environment files safely | `ENVIRONMENT_VAULT.md` | `COMMAND_REFERENCE.md`, `TROUBLESHOOTING.md`, `ARCHITECTURE_NOW.md` |
| I want to inspect pending, approved, rejected, memory, episode, failure, and runtime state in a browser | `STATIC_MEMORY_DASHBOARD.md` | `RETENTION_AND_PORTABILITY.md`, `MEMORY_PROTOCOL.md` |
| I want trusted agents to check or apply Agent Kernel updates | `UPDATES.md` | `AGENT_WRITE_MODES.md`, `ARCHITECTURE_NOW.md` |
| I want to understand how the system works | `OPERATING_MODEL.md` | `ARCHITECTURE_NOW.md` |
| I need the exact current command surface | `COMMAND_REFERENCE.md` | Relevant protocol and security doc |
| I need runtime environment variables | `ENVIRONMENT_VARIABLES.md` | `SECURE_RUNTIME_AND_RELEASES.md`, `MCP_SERVER.md` |
| I am editing or distributing skill docs | `SKILL_CONTRACT.md` | Root `SKILL.md`, adapter skill, `AGENT_RUNBOOK.md` |
| I need daemon, identifier, CI, or release security | `SECURE_RUNTIME_AND_RELEASES.md` | `SECURITY.md`, current hardening audit |
| I want to understand which agents may capture or propose data | `AGENT_WRITE_MODES.md` | `AGENT_PROPOSALS.md`, `MEMORY_PROTOCOL.md` |
| I want to clean up, back up, restore, or report on local state | `RETENTION_AND_PORTABILITY.md` | `MEMORY_PROTOCOL.md`, `JSON_FIRST_STORAGE.md` |
| I want to prevent architecture drift in AI-generated code | `ARCHITECTURE_GUARDIAN.md` | `architecture-guardian/COMMAND_REFERENCE.md`, `skills/architecture-guardian/references/` |
| I want to debug a setup or runtime problem | `TROUBLESHOOTING.md` | Relevant setup, hook, MCP, architecture, trust, update, dashboard, or protocol doc |
| I am an AI agent working on this repo | `AGENT_RUNBOOK.md` | `AGENTS.md`, `ARCHITECTURE_NOW.md` |
| I want to change runtime behavior | `ARCHITECTURE_NOW.md` | Relevant protocol doc and tests |
| I want to add or change memory behavior | `MEMORY_PROTOCOL.md` | `JSON_FIRST_STORAGE.md`, `AGENT_PROPOSALS.md` |
| I want to change Failure Lessons | `FAILURE_LESSONS_PROTOCOL.md` | `hooks/FAILURE_LESSONS_HOOK.md` |
| I want to change hooks | `hooks/CLAUDE_HOOKS_BEST_PRACTICES.md` | `hooks/FAILURE_LESSONS_HOOK.md`, `SAFE_GIT_HOOKS.md`, `ARCHITECTURE_GUARDIAN.md` |
| I want to change MCP tools | `MCP_SERVER.md` | `MEMORY_PROTOCOL.md`, `ARCHITECTURE_NOW.md` |
| I want to connect Claude Code | `integrations/CLAUDE_CODE_LIVE_CONTEXT.md` | `MCP_SERVER.md`, `SAFE_LINKING.md` |
| I want to connect Codex | `integrations/CODEX_LIVE_CONTEXT.md` | `MCP_SERVER.md`, `SAFE_LINKING.md` |
| I want to connect Cursor | `integrations/CURSOR_LIVE_CONTEXT.md` | `MCP_SERVER.md`, `SAFE_LINKING.md` |
| I want to connect OpenCode | `integrations/OPENCODE_LIVE_CONTEXT.md` | `MCP_SERVER.md`, `SAFE_LINKING.md` |
| I want to connect another agent | `INTEGRATIONS.md` | `SAFE_LINKING.md` |
| I want to plan portable knowledge sharing | `BUNDLE_KB.md` | `MEMORY_PROTOCOL.md`, `OPERATING_MODEL.md` |
| I want to review hardening history | `audits/REPO-HARDENING-AUDIT.md` | `CHANGELOG.md` at repo root |

---

## First 10 minutes path

For a new reader, follow this order:

1. `README.md` at repo root for the product-level overview and current release.
2. `INSTALL_AND_AGENT_SETUP.md` for the safest setup path.
3. `COMMAND_REFERENCE.md` and `ENVIRONMENT_VARIABLES.md` for the exact current interface.
4. `ENVIRONMENT_VAULT.md` before linking or restoring project environment files.
5. `OPERATING_MODEL.md` for the propose, approve, publish, capture, and promote workflow.
6. `AGENT_WRITE_MODES.md` and `AGENT_PROPOSALS.md` for agent trust boundaries.
7. `ARCHITECTURE_NOW.md` for the actual current runtime shape.
8. `ARCHITECTURE_GUARDIAN.md` when AI agents will make non-trivial code changes.
9. `SAFE_LINKING.md` and `SAFE_GIT_HOOKS.md` before modifying an existing project.
10. The relevant file under `integrations/` for exact client setup and rollback.
11. `STATIC_MEMORY_DASHBOARD.md` when a browser snapshot is useful for reviewing local state.
12. `RETENTION_AND_PORTABILITY.md` before pruning, exporting, importing, or restoring local state.
13. `UPDATES.md` before allowing an AI agent to install a global Agent Kernel version.
14. `TROUBLESHOOTING.md` if setup, linking, hooks, MCP, architecture checks, memory, portability, dashboard, or updates behave unexpectedly.

This order gets a user from installation to safe project adoption before asking them to understand every protocol.

---

## Runtime and protocol docs

- `COMMAND_REFERENCE.md` is the canonical current command and public-binary map.
- `ENVIRONMENT_VAULT.md` documents stable project identity, discovery, revisions, safe restore, migration, watcher behavior, storage permissions, and threat boundaries.
- `ENVIRONMENT_VARIABLES.md` classifies stable user-facing variables and internal test overrides.
- `SKILL_CONTRACT.md` defines the shared behavioral contract across canonical and adapter skills.
- `SECURE_RUNTIME_AND_RELEASES.md` documents daemon, identifier, CI, trusted-publishing, and release boundaries.
- `ARCHITECTURE_NOW.md` documents the real current runtime. It is the source to check before editing code.
- `ARCHITECTURE_GUARDIAN.md` documents dependency boundaries, change contracts, baselines, exceptions, reuse-first search, reports, and architecture hooks.
- `architecture-guardian/COMMAND_REFERENCE.md` lists the complete Architecture Guardian command surface.
- `architecture-guardian/MIGRATION_GUIDE.md` explains staged adoption from review mode to CI enforcement.
- `architecture-guardian/REPORTING.md` explains conformance reports and regression classification.
- `architecture-guardian/SECURITY.md` documents scanner trust and safety boundaries.
- `OPERATING_MODEL.md` explains the day-to-day governance loop and where each type of knowledge belongs.
- `MEMORY_PROTOCOL.md` documents durable memory, proposals, approval, publish, and sync.
- `AGENT_PROPOSALS.md` documents the restricted proposal helper, trust checks, input limits, structured output, and pending-only lifecycle.
- `AGENT_WRITE_MODES.md` separates agent identity trust, global memory write modes, pending proposals, and runtime session capture.
- `FAILURE_LESSONS_PROTOCOL.md` documents the error-to-skill loop.
- `STATIC_MEMORY_DASHBOARD.md` documents the read-only adaptive HTML snapshot, browser boundary, copy-only review commands, redaction, and output safety.
- `RETENTION_AND_PORTABILITY.md` documents raw-observation retention, deterministic session compaction, redacted export, review-first import, explicit restore, terminal views, and static local reports.
- `UPDATES.md` documents configurable release channels, user-confirmed allowlists, cached agent notices, exact-version installation, verification, rollback, and update auditing.
- `BUNDLE_KB.md` documents the planned portable knowledge bundle format and command contract. It is not a shipped v1.9.0 command surface.
- `MCP_SERVER.md` documents the local stdio MCP server, context tools, and trust boundary.
- `STRICT_MODE.md` documents guard and enforcement behavior.
- `JSON_FIRST_STORAGE.md` documents the JSON-first storage model.

---

## Setup and integration docs

- `INSTALL_AND_AGENT_SETUP.md` gives the safest install and agent setup flow.
- `ENVIRONMENT_VAULT.md` gives the local environment-file continuity and recovery flow.
- `SAFE_LINKING.md` explains `agent-kernel-safe-link`, managed blocks, backups, atomic project writes, and idempotent linking.
- `SAFE_GIT_HOOKS.md` explains worktree-aware hook discovery, dry-run and force repair behavior, symlink refusal, permissions, backups, and atomic replacement.
- `TROUBLESHOOTING.md` gives symptom-based diagnosis for install, memory home, Environment Vault, safe-link, hooks, MCP, Failure Lessons, Architecture Guardian, docs drift, and releases.
- `INTEGRATIONS.md` covers the general integration surface across agents.
- `integrations/CLAUDE_CODE_LIVE_CONTEXT.md` covers Claude Code files, MCP, hooks, optional runtime, and rollback.
- `integrations/CODEX_LIVE_CONTEXT.md` covers Codex `AGENTS.md`, MCP CLI and TOML setup, optional runtime, and rollback.
- `integrations/CURSOR_LIVE_CONTEXT.md` covers Cursor rules, `.cursor/mcp.json`, optional runtime, and rollback.
- `integrations/OPENCODE_LIVE_CONTEXT.md` covers `AGENTS.md`, `opencode.jsonc`, optional runtime, and rollback.
- `hooks/FAILURE_LESSONS_HOOK.md` covers automatic failure capture from Claude Code.
- `hooks/CLAUDE_HOOKS_BEST_PRACTICES.md` covers hook event selection, exec-form commands, matcher discipline, output discipline, and security boundaries.
- `skills/architecture-guardian/templates/claude-hooks.json` provides a narrow `PreToolUse` scope enforcement example.

---

## Brand and marketing assets

- `brand/agent-kernel-logo.svg` is the minimal repository logo.
- `brand/agent-kernel-hero.svg` is the README hero visual.
- `brand/agent-strip.svg` is the brand-safe supported-agent surface strip.
- `brand/README.md` explains usage and the third-party logo boundary.

---

## Agent contributor docs

- `AGENT_RUNBOOK.md` gives AI coding agents a safe workflow for inspecting, editing, validating, and summarizing work on this repository.
- `AGENTS.md` at repo root gives repository-level instructions for AGENTS.md-compatible agents.
- `skills/architecture-guardian/SKILL.md` is the canonical Architecture Guardian orchestrator skill.
- `.claude/skills/architecture-guardian/SKILL.md` and `.agents/skills/architecture-guardian/SKILL.md` expose concise repository-local entry points.

Agents should read the runbook before making non-trivial changes. It explains runtime boundaries, generated-file boundaries, memory proposal rules, Failure Lessons behavior, architecture conformance, hook boundaries, MCP boundaries, and PR summary expectations.

---

## Schema and state locations

- `schemas/failure-lesson.schema.json` defines the stored Failure Lesson shape.
- `skills/architecture-guardian/schemas/` defines policy, architecture map, change contract, baseline, exception, and conformance report formats.

Memory and proposal schemas live under the initialized runtime home:

```text
~/.agent-kernel/source/schemas/
```

Updater configuration, cache, and audit state live under:

```text
~/.agent-kernel/config.json
~/.agent-kernel/runtime/update-status.json
~/.agent-kernel/logs/updates.jsonl
```

The default generated dashboard lives at `~/.agent-kernel/reports/dashboard.html`. Runtime sessions, observations, local reports, and import backups remain under the local Agent Kernel home. See `STATIC_MEMORY_DASHBOARD.md` and `RETENTION_AND_PORTABILITY.md` before changing or sharing them.

Architecture Guardian project state lives under:

```text
<project>/.agent-kernel/architecture/
```

---

## Development docs

Roadmap and planning live outside this folder:

```text
development/BACKLOG.md
development/EPICS.md
development/MILESTONES.md
development/SPRINT-PLAN.md
```

The historical typo path `develpment/` exists as a compatibility pointer. New planning docs should go under `development/`.

Repository-local agent scaffolds live under:

```text
.claude/
.codex/
.agents/skills/
```

---

## Documentation ownership rules

When behavior changes, update docs in the same PR.

| Change | Docs to update |
|---|---|
| New core command | `README.md`, `COMMAND_REFERENCE.md`, `ARCHITECTURE_NOW.md`, relevant protocol doc, focused tests |
| New helper binary | `README.md`, `COMMAND_REFERENCE.md`, `ARCHITECTURE_NOW.md`, relevant setup or protocol doc, docs contract |
| Static dashboard command, stores, browser behavior, privacy, or output safety | `STATIC_MEMORY_DASHBOARD.md`, `README.md`, `ARCHITECTURE_NOW.md`, routed-command docs, focused tests |
| Updater command, trust, channel, cache, notification, install, or rollback behavior | `UPDATES.md`, `README.md`, `ARCHITECTURE_NOW.md`, routed-command docs, focused tests |
| Proposal helper, identity, or trust behavior | `AGENT_PROPOSALS.md`, `AGENT_WRITE_MODES.md`, `MEMORY_PROTOCOL.md`, focused tests |
| Runtime capture or observation behavior | `AGENT_WRITE_MODES.md`, `ARCHITECTURE_NOW.md`, focused tests |
| Retention, export, import, restore, view, or report behavior | `RETENTION_AND_PORTABILITY.md`, `ARCHITECTURE_NOW.md`, focused tests |
| Safe project linking | `SAFE_LINKING.md`, `INSTALL_AND_AGENT_SETUP.md`, focused tests |
| Git hook discovery, repair, or write behavior | `SAFE_GIT_HOOKS.md`, `INSTALL_AND_AGENT_SETUP.md`, focused tests |
| New architecture rule, detector, contract, baseline, exception, or report behavior | `ARCHITECTURE_GUARDIAN.md`, focused reference, schema or template, tests, `ARCHITECTURE_NOW.md` |
| New memory type | `MEMORY_PROTOCOL.md`, `OPERATING_MODEL.md`, `README.md`, `SKILL.md` |
| New Failure Lessons behavior | `FAILURE_LESSONS_PROTOCOL.md`, `OPERATING_MODEL.md`, `hooks/FAILURE_LESSONS_HOOK.md`, tests |
| New bundle behavior | `BUNDLE_KB.md`, `MEMORY_PROTOCOL.md`, `OPERATING_MODEL.md`, `README.md`, tests |
| New hook | `hooks/CLAUDE_HOOKS_BEST_PRACTICES.md`, `INTEGRATIONS.md`, example settings |
| New MCP tool | `MCP_SERVER.md`, `COMMAND_REFERENCE.md`, tests, README if user-facing |
| New client integration | Matching file under `integrations/`, `docs/README.md`, and `INTEGRATIONS.md` when the support matrix changes |
| Skill trigger, workflow, or trust-boundary change | `SKILL.md`, both adapter skills, `SKILL_CONTRACT.md`, relevant protocol doc, docs contract |
| Public environment variable | `ENVIRONMENT_VARIABLES.md`, relevant setup/security doc, docs contract |
| Focused smoke registration, execution order, ignored files, or delegated coverage | `CONTRIBUTING.md`, `docs/README.md`, `test/smoke-registration.mjs`, `test/smoke.mjs` |
| Workflow or release behavior | `SECURE_RUNTIME_AND_RELEASES.md`, `TROUBLESHOOTING.md`, `CHANGELOG.md`, CI hardening test |
