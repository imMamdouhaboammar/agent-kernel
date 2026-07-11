---
name: agent-kernel
description: |
  Local-first governance, memory, architecture conformance, and safety layer for AI coding agents.
  Use this skill to install Agent Kernel, capture durable rules and Failure Lessons,
  share memory across Claude Code, Codex, Cursor, OpenCode, Antigravity, and Gemini CLI,
  enforce architecture conformance, search episodes, run change contracts, install hooks,
  configure MCP, or make multiple coding agents follow the same standards.
  Triggers: remember this rule, save this workflow, capture this failure, search past
  episodes, learn from this error, prevent architecture drift, search before creating a
  service, create a change contract, baseline existing debt, install agent guidance,
  safe-link this repo, configure MCP, add a guard policy.
---

# Agent Kernel — Agent Skill

This skill gives any AGENTS.md-compatible agent the Agent Kernel workflow for
local-first governance, shared memory, and architecture conformance.

Canonical install:

```bash
npm install -g @mamdouh-aboammar/agent-kernel
agent-kernel --version
```

The full surface and command map live in the canonical skill at
[`SKILL.md`](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/SKILL.md).
Read that file for trigger phrases, command surface, mental model, and safety rules.

For architecture conformance work, also load the dedicated
[`architecture-guardian`](../architecture-guardian/SKILL.md) skill before any
non-trivial code change.

Common entry points:

```bash
# Approve a rule the user just asked you to remember
agent-kernel remember "Never store raw tokens in JSON memory." \
  --type policy --level critical --publish

# Search past debugging before retrying a failing command
agent-kernel failure search "ERR_MODULE_NOT_FOUND"

# Capture this failure as a lesson
agent-kernel failure capture \
  --from codex --type test-failure \
  --command "npm test" --exit-code 1 \
  --text "<error output>" \
  --root-cause "<why>" --fix "<known fix>"

# Architecture: discover, reuse, check before commit
agent-kernel architecture doctor .
agent-kernel architecture discover . --json
agent-kernel architecture reuse "<capability>" . --json
agent-kernel architecture check . --json
```

Safety rules:

- Do not approve or publish memory unless the user explicitly asks.
- Do not silently broaden architecture policy, baseline, contract, or exception scope.
- Do not store secrets, `.env` values, MCP credentials, or local auth files in repo-local config.
- Do not bypass an existing public interface to reach infrastructure directly.
- Search Failure Lessons and architecture reuse candidates before repeating work.
- Use safe-link before modifying existing project guidance files.
- Treat hooks as narrow, auditable lifecycle adapters.

Full documentation:

- [docs/README.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/README.md)
- [docs/ARCHITECTURE_GUARDIAN.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/ARCHITECTURE_GUARDIAN.md)
- [docs/AGENT_RUNBOOK.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/AGENT_RUNBOOK.md)
- [docs/FAILURE_LESSONS_PROTOCOL.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/FAILURE_LESSONS_PROTOCOL.md)
- [docs/MCP_SERVER.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/MCP_SERVER.md)

License: MIT
