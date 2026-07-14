# Agent-authored memory proposals

`agent-kernel-agent-propose` is the restricted entry point for coding agents that identify a durable rule, preference, workflow, policy, project note, or skill trigger.

It creates a pending proposal only. It never approves, publishes, or writes directly to approved memory.

## Basic use

```bash
agent-kernel-agent-propose \
  --from codex \
  --reason "The user corrected this workflow twice." \
  --text "Always run the documented verification command before claiming completion."
```

Text may also come from stdin:

```bash
echo "Always preserve the repository package manager." | \
  agent-kernel-agent-propose \
    --from cursor \
    --reason "Captured from an explicit user correction."
```

Exactly one text source is accepted:

- `--text`
- positional text
- stdin

Providing more than one source fails before the core proposal command runs.

## Trust boundary

The helper resolves the requested agent against the Agent Kernel registry.

| Trust level | Proposal result |
|---|---|
| `read-only` | rejected |
| `capture-only` | rejected |
| `propose-only` | pending proposal allowed |
| `trusted-local` | pending proposal allowed |

Unknown agents receive a transient `read-only` identity for this request. A rejected unknown agent is not added to the persistent registry.

Successful agent proposals are enriched with:

```json
{
  "status": "pending",
  "createdBy": "codex",
  "agentId": "codex",
  "trustLevel": "propose-only",
  "source": {
    "proposedBy": "codex",
    "createdBy": "codex",
    "agentId": "codex",
    "trustLevel": "propose-only"
  }
}
```

The helper refuses to modify a proposal record whose status is not `pending`.

## Supported fields

```text
--from <agent>
--agent <agent>        alias of --from
--reason <text>
--text <text>
--type <type>
--scope <scope>
--level <level>
--targets <csv>
--tags <csv>
--json
```

`--from` and `--agent` cannot be used together.

Valid proposal types:

```text
rule
policy
preference
workflow
project-note
skill-trigger
```

Valid scopes:

```text
global
project
```

Valid levels:

```text
critical
standard
note
```

Targets and tags are comma-separated, trimmed, and deduplicated. Empty CSV items are rejected.

## Validation limits

The helper validates input before invoking the core CLI:

- proposal text: 8 to 4000 characters
- reason: 4 to 1000 characters
- agent identity: 1 to 200 characters
- targets: at most 50 items, each at most 100 characters
- tags: at most 30 items, each at most 100 characters
- unknown and duplicate options: rejected
- missing or empty option values: rejected

## Structured output

Use `--json` for an agent-readable response.

Success is written to stdout:

```json
{
  "ok": true,
  "proposalId": "mem_123",
  "status": "pending",
  "agentId": "cursor",
  "trustLevel": "propose-only"
}
```

Failure is written to stderr with a non-zero exit code:

```json
{
  "ok": false,
  "error": "Agent unknown-agent has trust level read-only and cannot create proposals."
}
```

Without `--json`, the helper preserves the human-readable core CLI success message and writes concise errors to stderr.

## Subprocess safety

The helper invokes the configured core CLI with:

- a default timeout of 30 seconds
- a one-megabyte output buffer
- captured stdout and stderr
- redacted and bounded failure diagnostics

The timeout may be adjusted for controlled environments:

```bash
AGENT_KERNEL_HELPER_TIMEOUT_MS=60000 agent-kernel-agent-propose ...
```

Accepted values are clamped between 100 milliseconds and 300000 milliseconds.

## Pending record verification

After the core command reports a proposal ID, the helper validates that:

- the ID is safe for a local filename
- the resolved file remains inside `inbox/pending`
- the JSON record is readable and object-shaped
- the record ID matches the reported ID
- the record status is `pending`

Identity enrichment is written atomically through a temporary sibling file. Temporary and rollback files are removed after success or failure.

## Review workflow

Agents stop after proposal creation.

```text
agent proposes
  -> pending inbox record
  -> user reviews
  -> user approves or rejects
  -> approved proposal may be published
```

Review with:

```bash
agent-kernel inbox
agent-kernel approve <proposal-id>
agent-kernel approve <proposal-id> --publish
agent-kernel reject <proposal-id>
```

Hooks, MCP tools, and agent helpers must not silently approve or publish a proposal.
