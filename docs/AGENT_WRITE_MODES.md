# Agent write modes and runtime capture

`agent-kernel-agent-write` is the restricted entry point for agent-authored runtime sessions and observations.

It controls ephemeral runtime capture only. It does not approve or publish durable memory.

## Trust modes

Agent identities use four write modes:

| Trust level | Read | Capture sessions | Propose memory | Direct approved memory |
|---|---:|---:|---:|---:|
| `read-only` | yes | no | no | no |
| `capture-only` | yes | yes | no | no |
| `propose-only` | yes | yes | yes | no |
| `trusted-local` | yes | yes | yes | limited governed actions only |

Unknown agents receive a transient `read-only` identity. A denied unknown agent is not added to the persistent registry.

## Inspect and change modes

```bash
agent-kernel-agent-write mode list
agent-kernel-agent-write mode get cursor
agent-kernel-agent-write mode set cursor capture-only
```

Mode changes are explicit administrative actions. Looking up an unknown agent does not register it.

Structured mode output is available with `--json`:

```bash
agent-kernel-agent-write mode list --json
agent-kernel-agent-write mode get cursor --json
agent-kernel-agent-write mode set cursor propose-only --json
```

## Start a session

```bash
agent-kernel-agent-write session-start \
  --agent cursor \
  --project agent-kernel
```

A capture-capable identity is required. The optional project ID is limited to 200 characters and cannot contain control characters.

## Capture an observation

```bash
agent-kernel-agent-write observe \
  --agent cursor \
  --session <session-id> \
  --type command \
  --files src/cli.mjs,test/smoke.mjs \
  --command "npm test" \
  --exit-code 1 \
  --text "The smoke suite failed during command routing."
```

Observation text may come from exactly one source:

- `--text`
- one positional text value
- stdin

Example with stdin:

```bash
printf '%s\n' "The smoke suite failed during command routing." | \
  agent-kernel-agent-write observe \
    --agent cursor \
    --session <session-id> \
    --type test_failure
```

## End a session

```bash
agent-kernel-agent-write session-end \
  --agent cursor \
  --session <session-id>
```

The helper validates the session ID before invoking the runtime command.

## Input validation

The helper rejects:

- unknown options
- duplicate options
- missing or empty option values
- options used with the wrong subcommand
- extra positional arguments
- unsafe session IDs
- invalid observation types
- malformed file CSV values
- non-integer or out-of-range exit codes
- control characters in project IDs or file references
- observation text longer than 10000 characters
- command text longer than 4000 characters

Session IDs must match:

```text
[A-Za-z0-9][A-Za-z0-9._-]{0,199}
```

Observation types must match:

```text
[A-Za-z][A-Za-z0-9._-]{0,63}
```

File references are trimmed and deduplicated before they reach the runtime command.

## Structured output

Add `--json` to mode, session, and observation commands.

Successful runtime capture returns an envelope such as:

```json
{
  "ok": true,
  "command": "observe",
  "agentId": "cursor",
  "trustLevel": "capture-only",
  "output": "Observation captured: obs_123",
  "sessionId": "session_123",
  "type": "command"
}
```

Denied or invalid calls write a JSON error envelope to stderr and exit non-zero:

```json
{
  "ok": false,
  "error": "Agent unknown-agent has trust level read-only and cannot start sessions."
}
```

Without `--json`, successful commands preserve the underlying human-readable runtime output.

## Subprocess controls

The helper invokes `agent-kernel-identity-command` with:

- a default timeout of 30 seconds
- a one-megabyte output limit
- captured stdout and stderr
- redacted and bounded diagnostics

The timeout can be adjusted in a controlled environment:

```bash
AGENT_KERNEL_HELPER_TIMEOUT_MS=60000 \
  agent-kernel-agent-write session-start --agent cursor
```

Values are clamped between 100 milliseconds and 300000 milliseconds.

## Governance boundary

Runtime capture and durable memory remain separate:

```text
agent action
  -> runtime session observation
  -> later review or Failure Lesson processing
  -> optional pending memory proposal
  -> user approval
  -> publish to approved memory
```

`agent-kernel-agent-write` cannot approve or publish memory. Use `agent-kernel-agent-propose` for a reviewed pending proposal, then use the normal inbox approval workflow.
