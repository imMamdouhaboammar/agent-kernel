---
name: agent-kernel
description: |
  Use Agent Kernel in Claude Code when work needs shared durable rules, reviewed memory proposals,
  Failure Lessons, bounded local context, sessions, safe project linking, Architecture Guardian,
  Claude hooks, local MCP, project provider isolation, daemon security, or release verification.
  Trigger on: remember this rule, capture this failure, search past debugging evidence,
  connect this repo safely, prevent architecture drift, configure MCP, install narrow hooks,
  secure the daemon, or make coding agents follow one reviewed workflow.
---

# Agent Kernel for Claude Code

Use the canonical [`SKILL.md`](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/SKILL.md) for the complete workflow. This adapter adds Claude-specific MCP and hook guidance without weakening the shared trust model.

## Start

```bash
agent-kernel --version
agent-kernel doctor
agent-kernel status
agent-kernel mcp test
```

For an existing project:

```bash
agent-kernel compile
agent-kernel-safe-link . --dry-run
agent-kernel-safe-link .
```

Claude should read `CLAUDE.md` and `AGENTS.md`. Existing content outside Agent Kernel managed blocks remains user-owned.

## Core contract

- Approved source memory is canonical; generated guidance is delivery output.
- Claude may capture evidence and create pending proposals. Approval and publication remain user-owned.
- Failure Lessons are evidence first.
- File-backed IDs are identifiers, not paths.
- MCP core mode is the default. Approval is disabled unless explicitly enabled; publish and delete are not exposed.
- The daemon is local-only by default. Remote mode requires explicit opt-in and `AGENT_KERNEL_DAEMON_TOKEN`.
- Provider targets come from project manifests, not prompt or CLI overrides.
- Architecture policy, baseline, contract, and exception state require review.

## Claude memory and failure flow

```bash
agent-kernel propose \
  --from claude \
  --text "<durable rule>" \
  --reason "<why it should persist>"

agent-kernel failure capture \
  --from claude \
  --type tool-failure \
  --command "<command>" \
  --exit-code 1 \
  --text "<redacted failure>" \
  --root-cause "<supported cause>" \
  --fix "<verified fix>"
```

Do not approve a proposal merely because Claude created it.

## Claude MCP

```bash
claude mcp add --transport stdio --scope user \
  agent-kernel-memory -- agent-kernel mcp serve
claude mcp list
```

Keep core mode for normal work. Extended mode and MCP approval are separate explicit decisions.

## Claude hooks

Use narrow lifecycle events:

- `PreToolUse` for command or Architecture Guardian scope checks
- `PostToolUseFailure` for failure evidence
- short timeouts
- exec-form command hooks where supported
- structured, bounded output

Architecture scope hook:

```bash
agent-kernel architecture init .
# Configure Write|Edit|MultiEdit to call agent-kernel-architecture-hook.
```

Default Architecture Guardian hook mode is review. Set `AGENT_KERNEL_ARCHITECTURE_MODE=strict` only after policy and baseline review.

Hooks must not approve memory, publish memory, broaden architecture policy, create broad exceptions, or leak credentials.

## Required architecture loop

Load [`architecture-guardian`](../architecture-guardian/SKILL.md) before non-trivial code changes:

```bash
agent-kernel architecture doctor .
agent-kernel architecture discover . --json
agent-kernel architecture reuse "<capability>" . --json
agent-kernel architecture check . --json
```

## Validation

For Agent Kernel repository changes:

```bash
npm run docs:check
npm run lint
npm run typecheck
npm test
```

Read [docs/MCP_SERVER.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/MCP_SERVER.md), [docs/hooks/CLAUDE_HOOKS_BEST_PRACTICES.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/hooks/CLAUDE_HOOKS_BEST_PRACTICES.md), [docs/COMMAND_REFERENCE.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/COMMAND_REFERENCE.md), and [docs/SECURE_RUNTIME_AND_RELEASES.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/SECURE_RUNTIME_AND_RELEASES.md).
