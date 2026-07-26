---
name: agent-kernel
description: |
  Use Agent Kernel when an AGENTS.md-compatible coding agent needs shared durable rules,
  reviewed memory proposals, Failure Lessons, bounded context, local sessions, safe project
  connection, provider isolation, Architecture Guardian, hooks, MCP, or release verification.
  Trigger on: remember this rule, capture this failure, search past debugging evidence,
  connect this repo safely, prevent architecture drift, configure local MCP, secure the daemon,
  or make multiple coding agents follow the same reviewed workflow.
---

# Agent Kernel for AGENTS-compatible agents

Use the canonical skill at [`SKILL.md`](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/SKILL.md) for the complete operating model. This adapter gives Codex, Antigravity, and other AGENTS-compatible agents the minimum non-negotiable contract.

## Start

```bash
agent-kernel --version
agent-kernel doctor
agent-kernel status
```

Before modifying an existing project:

```bash
agent-kernel compile
agent-kernel-safe-link . --dry-run
agent-kernel-safe-link .
```

Read `AGENTS.md`, `.codex/AGENTS.md`, or `.agents/agents.md` as applicable. Do not replace user-owned instructions outside Agent Kernel managed blocks.

## Core contract

- Approved source memory is canonical. Generated guidance is disposable.
- Agents may capture evidence and propose memory. Users approve and publish.
- Failure Lessons are evidence first; promotion creates a pending proposal.
- File-backed IDs are identifiers, not paths.
- MCP defaults to the bounded core tool surface. Approval is disabled by default.
- The daemon is local-only by default. Remote mode requires `AGENT_KERNEL_DAEMON_ALLOW_REMOTE=1` and a strong `AGENT_KERNEL_DAEMON_TOKEN`.
- Provider targets come from reviewed project manifests, not caller overrides.
- Use Architecture Guardian before non-trivial code changes.

## Normal work loop

```bash
agent-kernel search "<task or error>" --explain
agent-kernel context "<task>" --files src/example.mjs --budget 1200
agent-kernel failure search "<error signature>"
```

Create a pending durable-memory proposal:

```bash
agent-kernel propose \
  --from codex \
  --text "<durable rule>" \
  --reason "<why it should persist>"
```

Capture a verified failure lesson:

```bash
agent-kernel failure capture \
  --from codex \
  --type test-failure \
  --command "npm test" \
  --exit-code 1 \
  --text "<redacted error>" \
  --root-cause "<supported cause>" \
  --fix "<verified fix>"
```

## Architecture workflow

Load [`architecture-guardian`](../architecture-guardian/SKILL.md) before a feature, refactor, new dependency, schema change, public API change, or cross-module fix.

```bash
agent-kernel architecture doctor .
agent-kernel architecture discover . --json
agent-kernel architecture reuse "<capability>" . --json
agent-kernel architecture check . --json
```

Do not silently broaden policy, baseline, contract, or exception scope.

## Project and runtime boundaries

```bash
agent-kernel project status --json
agent-kernel context current --json
agent-kernel session start --agent codex --project . --json
agent-kernel mcp test
agent-kernel daemon status --json
```

Do not expose the daemon publicly. Do not enable MCP approval, bypass mode, strict architecture hooks, replacement imports, or production provider approvals without explicit user intent.

## Validation

For repository changes, run the targeted test first, then the required full gate. For Agent Kernel itself:

```bash
npm run docs:check
npm run lint
npm run typecheck
npm test
```

Use [docs/COMMAND_REFERENCE.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/COMMAND_REFERENCE.md), [docs/AGENT_RUNBOOK.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/AGENT_RUNBOOK.md), and [docs/SECURE_RUNTIME_AND_RELEASES.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/SECURE_RUNTIME_AND_RELEASES.md).
