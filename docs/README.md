# Agent Kernel Documentation

This folder is the canonical documentation set for Agent Kernel.

Start here when you need to understand the project, change the runtime, update an integration, or review agent behavior.

## Reading order

| Need | Read |
|---|---|
| Understand the repo as it exists today | `ARCHITECTURE_NOW.md` |
| Understand the planned architecture | `ARCHITECTURE.md` |
| Change memory behavior | `MEMORY_PROTOCOL.md` |
| Change Failure Lessons behavior | `FAILURE_LESSONS_PROTOCOL.md` |
| Change Claude failure hooks | `hooks/FAILURE_LESSONS_HOOK.md` and `hooks/CLAUDE_HOOKS_BEST_PRACTICES.md` |
| Change MCP tools or client setup | `MCP_SERVER.md` |
| Change agent integrations | `INTEGRATIONS.md` |
| Change strict/guard behavior | `STRICT_MODE.md` |
| Change JSON storage model | `JSON_FIRST_STORAGE.md` |
| Review repo hardening history | `audits/REPO-HARDENING-AUDIT.md` |

## Runtime docs

- `ARCHITECTURE_NOW.md` documents the real current runtime.
- `MEMORY_PROTOCOL.md` documents durable memory, proposals, approval, publish, and sync.
- `FAILURE_LESSONS_PROTOCOL.md` documents the error-to-skill loop.
- `MCP_SERVER.md` documents the local stdio MCP server.
- `STRICT_MODE.md` documents guard and enforcement behavior.
- `JSON_FIRST_STORAGE.md` documents the JSON-first storage model.

## Integration docs

- `INTEGRATIONS.md` covers Claude Code, Codex, Cursor, OpenCode, Antigravity, Gemini CLI, Skills.sh, marketplace metadata, and the ECC bundle.
- `hooks/FAILURE_LESSONS_HOOK.md` covers the automatic failure-capture hook.
- `hooks/CLAUDE_HOOKS_BEST_PRACTICES.md` covers hook event selection, exec-form commands, matcher discipline, output discipline, and security boundaries.

## Schema docs

- `schemas/failure-lesson.schema.json` defines the stored Failure Lesson shape.

Memory and proposal schemas live under the runtime memory home when initialized:

```text
~/.agent-kernel/source/schemas/
```

## Development docs

Roadmap and planning live outside this folder:

```text
development/BACKLOG.md
development/EPICS.md
development/MILESTONES.md
development/SPRINT-PLAN.md
```

Repo-local ECC scaffolds live under:

```text
.claude/
.codex/
.agents/skills/
```

## Documentation rules

When changing behavior, update docs in the same PR.

Use this rule of thumb:

| Change | Docs to update |
|---|---|
| New core command | `README.md`, `ARCHITECTURE_NOW.md`, relevant protocol doc, smoke test docs if needed |
| New memory type | `MEMORY_PROTOCOL.md`, `README.md`, `SKILL.md` |
| New Failure Lessons behavior | `FAILURE_LESSONS_PROTOCOL.md`, `hooks/FAILURE_LESSONS_HOOK.md`, tests |
| New hook | `hooks/CLAUDE_HOOKS_BEST_PRACTICES.md`, `INTEGRATIONS.md`, example settings |
| New MCP tool | `MCP_SERVER.md`, tests, README if user-facing |
| New integration | `INTEGRATIONS.md`, `README.md`, `SKILL.md` |
| Release-visible change | `CHANGELOG.md` |

## Do not document aspirations as shipped behavior

`src/{adapters,commands,core,hooks}/` are placeholders today. If a feature is not wired into the runtime, document it as planned work, not as current behavior.

## Review checklist

Before merging a docs update:

- Does `ARCHITECTURE_NOW.md` still match the code?
- Does `README.md` give a new user the shortest correct path?
- Does `SKILL.md` describe current capabilities accurately?
- Are generated files identified as generated/disposable?
- Are approval boundaries explicit?
- Are hooks documented as narrow, auditable adapters rather than hidden agents?
- Are private credentials excluded from repo-local config examples?
