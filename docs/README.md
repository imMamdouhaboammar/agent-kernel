# Agent Kernel Documentation

This folder is the canonical documentation set for Agent Kernel.

Use it to understand the current runtime, connect agent surfaces, update memory behavior, review hook safety, troubleshoot setup, and decide which doc must change when behavior changes.

---

## Start here

| Situation | Read first | Then read |
|---|---|---|
| I want to install and use Agent Kernel | `INSTALL_AND_AGENT_SETUP.md` | `OPERATING_MODEL.md`, `SAFE_LINKING.md` |
| I want to understand how the system works | `OPERATING_MODEL.md` | `ARCHITECTURE_NOW.md` |
| I want to debug a setup or runtime problem | `TROUBLESHOOTING.md` | Relevant setup, hook, MCP, or protocol doc |
| I am an AI agent working on this repo | `AGENT_RUNBOOK.md` | `AGENTS.md`, `ARCHITECTURE_NOW.md` |
| I want to change runtime behavior | `ARCHITECTURE_NOW.md` | Relevant protocol doc and tests |
| I want to add or change memory behavior | `MEMORY_PROTOCOL.md` | `JSON_FIRST_STORAGE.md` |
| I want to change Failure Lessons | `FAILURE_LESSONS_PROTOCOL.md` | `hooks/FAILURE_LESSONS_HOOK.md` |
| I want to change hooks | `hooks/CLAUDE_HOOKS_BEST_PRACTICES.md` | `hooks/FAILURE_LESSONS_HOOK.md` |
| I want to change MCP tools | `MCP_SERVER.md` | `MEMORY_PROTOCOL.md`, `ARCHITECTURE_NOW.md` |
| I want to connect another agent | `INTEGRATIONS.md` | `SAFE_LINKING.md` |
| I want to review hardening history | `audits/REPO-HARDENING-AUDIT.md` | `CHANGELOG.md` at repo root |

---

## First 10 minutes path

For a new reader, follow this order:

1. `README.md` at repo root for the product-level overview.
2. `INSTALL_AND_AGENT_SETUP.md` for the safest setup path.
3. `OPERATING_MODEL.md` for the propose, approve, publish, capture, promote workflow.
4. `ARCHITECTURE_NOW.md` for the actual current runtime shape.
5. `SAFE_LINKING.md` before linking Agent Kernel into an existing project.
6. `TROUBLESHOOTING.md` if setup, linking, hooks, MCP, or memory behave unexpectedly.

This order is deliberately practical. It gets a user from install to safe project adoption before asking them to understand every protocol.

---

## Runtime docs

- `ARCHITECTURE_NOW.md` documents the real current runtime. It is the source to check before editing code.
- `OPERATING_MODEL.md` explains the day-to-day governance loop and where each type of knowledge belongs.
- `MEMORY_PROTOCOL.md` documents durable memory, proposals, approval, publish, and sync.
- `FAILURE_LESSONS_PROTOCOL.md` documents the error-to-skill loop.
- `MCP_SERVER.md` documents the local stdio MCP server and the trust boundary.
- `STRICT_MODE.md` documents guard and enforcement behavior.
- `JSON_FIRST_STORAGE.md` documents the JSON-first storage model.

---

## Setup and integration docs

- `INSTALL_AND_AGENT_SETUP.md` gives the safest install and agent setup flow.
- `SAFE_LINKING.md` explains `agent-kernel-safe-link`, marked blocks, backups, and idempotent project linking.
- `TROUBLESHOOTING.md` gives symptom-based diagnosis for install, memory home, safe-link, hooks, MCP, Failure Lessons, docs drift, and releases.
- `INTEGRATIONS.md` covers Claude Code, Codex, Cursor, OpenCode, Antigravity, Gemini CLI, Skills.sh, marketplace metadata, and the ECC bundle.
- `hooks/FAILURE_LESSONS_HOOK.md` covers automatic failure capture from Claude Code.
- `hooks/CLAUDE_HOOKS_BEST_PRACTICES.md` covers hook event selection, exec-form commands, matcher discipline, output discipline, and security boundaries.

---

## Agent docs

- `AGENT_RUNBOOK.md` gives AI coding agents a safe workflow for inspecting, editing, validating, and summarizing work on this repository.
- `AGENTS.md` at repo root gives repo-level instructions for AGENTS.md-compatible agents.

Agents should read the runbook before making non-trivial changes. It explains runtime boundaries, generated-file boundaries, memory proposal rules, Failure Lessons behavior, hook boundaries, MCP boundaries, and PR summary expectations.

---

## Schema docs

- `schemas/failure-lesson.schema.json` defines the stored Failure Lesson shape.

Memory and proposal schemas live under the runtime memory home when initialized:

```text
~/.agent-kernel/source/schemas/
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

Repo-local ECC scaffolds live under:

```text
.claude/
.codex/
.agents/skills/
```

---

## Documentation ownership rules

When changing behavior, update docs in the same PR.

| Change | Docs to update |
|---|---|
| New core command | `README.md`, `ARCHITECTURE_NOW.md`, relevant protocol doc, smoke test docs if needed |
| New helper binary | `README.md`, `ARCHITECTURE_NOW.md`, relevant setup or protocol doc |
| New memory type | `MEMORY_PROTOCOL.md`, `OPERATING_MODEL.md`, `README.md`, `SKILL.md` |
| New Failure Lessons behavior | `FAILURE_LESSONS_PROTOCOL.md`, `OPERATING_MODEL.md`, `hooks/FAILURE_LESSONS_HOOK.md`, tests |
| New hook | `hooks/CLAUDE_HOOKS_BEST_PRACTICES.md`, `INTEGRATIONS.md`, example settings |
| New MCP tool | `MCP_SERVER.md`, tests, README if user-facing |
| New integration | `INTEGRATIONS.md`, `README.md`, `SKILL.md` |
| New safe-link behavior | `SAFE_LINKING.md`, `INSTALL_AND_AGENT_SETUP.md`, README if user-facing |
| New troubleshooting guidance | `TROUBLESHOOTING.md`, setup or protocol doc if behavior is clarified |
| New agent behavior rule | `AGENT_RUNBOOK.md`, `AGENTS.md`, relevant protocol doc |
| Release-visible change | `CHANGELOG.md` |

---

## Do not document aspirations as shipped behavior

`src/{adapters,commands,core,hooks}/` are placeholders today. If a feature is not wired into the runtime, document it as planned work, not as current behavior.

Use `ARCHITECTURE_NOW.md` as the tie-breaker when roadmap docs and implementation disagree.

---

## Review checklist

Before merging a docs update:

- Does `ARCHITECTURE_NOW.md` still match the code?
- Does `README.md` give a new user the shortest correct path?
- Does `INSTALL_AND_AGENT_SETUP.md` still use the safest setup path?
- Does `OPERATING_MODEL.md` still describe the real approval and promotion flow?
- Does `TROUBLESHOOTING.md` point to real commands and real files?
- Does `AGENT_RUNBOOK.md` preserve runtime, generated-file, memory, hook, and MCP boundaries?
- Does `SKILL.md` describe current capabilities accurately?
- Are generated files identified as generated/disposable?
- Are approval boundaries explicit?
- Are hooks documented as narrow, auditable adapters rather than hidden agents?
- Are private credentials excluded from repo-local config examples?
- Are references to `development/` canonical, with `develpment/` treated only as legacy compatibility?
