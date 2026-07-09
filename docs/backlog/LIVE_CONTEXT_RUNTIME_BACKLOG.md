# Live Context Runtime Backlog

## Goal

Add an optional local runtime that lets agents submit session observations and ask for relevant context during work.

This must not change the default Agent Kernel model. The CLI, JSON-first storage, compile step, safe linking, and approval inbox must remain useful without any daemon running.

## Product constraints

1. Local runtime is opt-in
2. Runtime binds to `127.0.0.1` by default
3. No cloud account is required
4. No external database is required
5. No vector database is required
6. No runtime npm dependency should be added unless there is a strong reason
7. Hooks can capture evidence, but cannot approve or publish memory
8. Runtime data is local and disposable unless promoted through review
9. Existing generated files remain the stable fallback
10. Remote access is disabled unless explicitly configured

---

# AK-LIVE-001: Optional local daemon

## User story

As a developer using multiple AI coding agents, I want to start a tiny local Agent Kernel runtime only when needed, so agents can share local context without turning Agent Kernel into a heavy platform.

## Commands

```bash
agent-kernel daemon start
agent-kernel daemon stop
agent-kernel daemon status
agent-kernel daemon restart
```

## Behavior

The daemon should:

1. Start only when explicitly requested
2. Bind to `127.0.0.1` by default
3. Write all runtime state under `~/.agent-kernel/runtime`
4. Refuse external bind addresses unless a config flag enables them
5. Require a local secret if non-local access is enabled
6. Never approve, reject, or publish memory
7. Never edit source memory files directly
8. Fail open for context capture unless strict guard mode is explicitly active

## Initial endpoints

```text
GET  /ak/health
GET  /ak/status
POST /ak/observe
POST /ak/context
GET  /ak/sessions
GET  /ak/sessions/:id
```

## Storage shape

```text
~/.agent-kernel/runtime/
  daemon.json
  sessions/
    <session-id>.json
    <session-id>.jsonl
  observations/
  context-cache/
  logs/
```

## Acceptance criteria

1. `agent-kernel daemon start` starts a local server on `127.0.0.1`
2. `agent-kernel daemon status` reports PID, port, uptime, active sessions, and last observation time
3. `POST /ak/observe` writes append-only JSONL records
4. `POST /ak/context` returns relevant approved memory, episodes, Failure Lessons, and guard notes
5. The daemon does not create approved memory
6. The daemon does not run after package install
7. The daemon does not run after `init`, `compile`, `sync`, or `link`
8. Tests prove the CLI remains useful when daemon mode is disabled

## Out of scope

1. Web dashboard
2. Embeddings
3. Knowledge graph
4. Remote sync
5. Auto-consolidation
6. Background autostart

---

# AK-LIVE-002: Runtime health and diagnostics

## User story

As a user, I want to know whether Agent Kernel is correctly connected to my agents, so I can diagnose setup issues without guessing.

## Commands

```bash
agent-kernel status --runtime
agent-kernel doctor --runtime
agent-kernel doctor --agents
agent-kernel doctor --json
```

## Health checks

The runtime health report should include:

1. Kernel home path
2. Runtime enabled or disabled
3. Daemon running or stopped
4. Port and bind address
5. Last observation timestamp
6. Active session count
7. Installed MCP config status
8. Installed hook status
9. Pending proposal count
10. Failure Lesson count
11. Stale compiled output check
12. Unsafe bind warning
13. Missing secret warning for remote mode
14. Runtime retention status

## Acceptance criteria

1. `doctor --runtime` works when the daemon is stopped
2. Output is actionable and specific
3. JSON output is stable enough for CI or agent tooling
4. No secret values are printed
5. Exit codes distinguish healthy, warning, and critical states

---

# AK-LIVE-003: Context endpoint

## User story

As an agent integration, I want to request a compact context block for a session, task, and file list, so I can inject useful local knowledge without loading the entire memory store.

## Endpoint

```text
POST /ak/context
```

## Request payload

```json
{
  "sessionId": "session_...",
  "projectId": "agent-kernel",
  "agentId": "claude-code",
  "query": "fix safe-link idempotency",
  "files": ["src/cli.mjs", "test/safe-link.mjs"],
  "budget": 1200
}
```

## Response payload

```json
{
  "context": "...",
  "sections": {
    "approvedRules": [],
    "failureLessons": [],
    "episodes": [],
    "guardWarnings": [],
    "pendingProposals": []
  },
  "budgetUsed": 1032
}
```

## Context rules

1. Approved memory comes first
2. Failure Lessons with matching file, command, or error come next
3. Recent episodes come after lessons
4. Guard warnings are explicit and short
5. Pending proposals are marked as unapproved
6. Rejected proposals are never returned
7. Raw observations are summarized or clipped before display
8. Budget is respected strictly

## Acceptance criteria

1. Context respects token or character budget
2. Context separates approved memory from pending evidence
3. Context can be generated from CLI without daemon mode
4. Context is deterministic for the same inputs where possible
5. Context does not expose rejected proposals
6. Context does not expose secrets

---

# AK-LIVE-004: Observation endpoint

## User story

As an agent integration, I want to submit structured observations, so useful session evidence can be searched later without becoming durable memory automatically.

## Endpoint

```text
POST /ak/observe
```

## Observation types

```text
user_prompt
assistant_plan
tool_use
tool_result
tool_failure
file_read
file_edit
command_run
command_failure
test_failure
guard_block
permission_prompt
session_summary
manual_note
```

## Required fields

```json
{
  "sessionId": "session_...",
  "timestamp": "ISO timestamp",
  "agentId": "claude-code",
  "type": "tool_failure",
  "projectId": "agent-kernel",
  "cwd": "/path/to/repo",
  "text": "..."
}
```

## Optional fields

```json
{
  "files": ["src/cli.mjs"],
  "command": "npm test",
  "exitCode": 1,
  "metadata": {}
}
```

## Acceptance criteria

1. Invalid payloads are rejected
2. Unknown top-level fields are dropped or moved into safe metadata
3. Observations are append-only
4. Observations do not become approved memory
5. Observations can be searched by session, file, command, type, and text
6. Observation writes are fast and non-blocking for hooks where possible

---

# AK-LIVE-005: Runtime config

## User story

As a user, I want runtime behavior to be explicit and inspectable, so I can keep Agent Kernel small and predictable.

## Config file

```text
~/.agent-kernel/runtime/config.json
```

## Proposed config

```json
{
  "enabled": false,
  "host": "127.0.0.1",
  "port": 3999,
  "requireSecretForRemote": true,
  "contextBudgetDefault": 1200,
  "captureRawPrompts": false,
  "captureToolResults": true,
  "captureCommandOutputMaxChars": 6000,
  "autoStart": false
}
```

## Acceptance criteria

1. Runtime is disabled until explicitly started
2. Config defaults are conservative
3. Config validation rejects unsafe combinations
4. `doctor --runtime` reports the active config without secrets
5. Config changes do not affect generated static guidance unless compile is run

---

# AK-LIVE-006: Security rules for runtime endpoints

## User story

As a user, I want runtime endpoints to be safe by default, so local agents cannot silently mutate durable memory or publish rules.

## Rules

1. Endpoints whitelist accepted fields
2. Endpoints do not pass raw request bodies into internal handlers
3. Endpoints validate required strings, arrays, and numeric bounds
4. Endpoints record audit entries for state-changing operations
5. Endpoints never approve or publish memory
6. Remote access requires explicit config and a secret
7. Runtime bind address defaults to local loopback
8. Guard endpoints may block commands only in explicit guard mode

## Acceptance criteria

1. Tests cover invalid payloads
2. Tests cover unknown field handling
3. Tests cover missing secret in remote mode
4. Tests cover denied approve/publish attempts through runtime
5. Docs explain the boundary clearly

---

# Implementation note

Keep this implementation boring. A simple local Node HTTP server and JSONL storage are enough for the first version. Do not add a database, queue, worker engine, embeddings, browser UI, or sync protocol in this milestone.
