# Agent identity trust and memory write modes

Agent Kernel separates three controls that older documentation sometimes combined:

1. agent identity trust
2. global memory write mode
3. runtime session capture

They solve different problems and use different commands.

## Agent identity trust

Agent identities determine whether a named agent may read, capture evidence, or create pending proposals.

| Trust level | Read | Capture evidence | Propose memory | Direct approved memory |
|---|---:|---:|---:|---:|
| `read-only` | yes | no | no | no |
| `capture-only` | yes | yes | no | no |
| `propose-only` | yes | yes | yes | no |
| `trusted-local` | yes | yes | yes | governed only |

Unknown identities are treated as transient `read-only`. A denied lookup does not silently register the agent.

Manage identities through the routed registry commands:

```bash
agent-kernel agent list --json
agent-kernel agent add cursor --trust capture-only --surface cli
agent-kernel agent set cursor --trust propose-only
agent-kernel agent show cursor --json
agent-kernel agent remove cursor
```

## Global memory write mode

The global mode controls what `agent-kernel-agent-write` does with a memory request.

```bash
agent-kernel-mode show
agent-kernel-mode set approval
agent-kernel-mode set trusted
agent-kernel-mode set bypass
```

| Mode | `agent-kernel-agent-write` behavior |
|---|---|
| `approval` | Create a pending proposal. |
| `trusted` | Directly publish only low-risk or project-scoped memory; keep critical/global requests pending. |
| `bypass` | Write approved memory directly. Use only after explicit user selection. |

Default to `approval`. Agent identity trust does not automatically change the global write mode.

Mode-aware memory request:

```bash
agent-kernel-agent-write \
  --from cursor \
  --reason "The user corrected this workflow." \
  --text "Use pnpm in this repository." \
  --scope project
```

Supported fields include `--from`, `--reason`, `--text`, `--type`, `--scope`, `--level`, `--targets`, and `--tags`. Text may also come from one positional value or stdin.

## Pending proposal helper

When an agent should always stop at pending state, use the restricted helper instead:

```bash
agent-kernel-agent-propose \
  --from cursor \
  --reason "Captured from an explicit user correction." \
  --text "Use pnpm in this repository."
```

`agent-kernel-agent-propose` never approves or publishes. It validates identity trust, input shape, proposal ID safety, and the resulting pending record.

## Runtime sessions and observations

Runtime evidence does not use `agent-kernel-agent-write`.

Use the session commands:

```bash
agent-kernel session start --agent cursor --project . --json
agent-kernel session observe <session-id> \
  --type test-failure \
  --command "npm test" \
  --exit-code 1 \
  --text "The smoke suite failed during command routing." \
  --file test/smoke.mjs
agent-kernel session end <session-id>
```

Session IDs are validated before file access. Runtime evidence remains separate from approved memory.

## Decision matrix

| Intent | Command |
|---|---|
| Register or change an agent's trust | `agent-kernel agent` with `add`, `set`, `show`, or `remove` |
| Select the global memory write policy | `agent-kernel-mode` with `show` or `set` |
| Always create a pending proposal | `agent-kernel-agent-propose` |
| Apply the selected global memory mode | `agent-kernel-agent-write` |
| Capture a session or observation | `agent-kernel session ...` |
| Capture a reusable failure | `agent-kernel failure capture` |
| Review and approve durable memory | `agent-kernel inbox`, `approve`, `reject` |

## Governance rules

- Keep global mode at `approval` unless the user deliberately selects broader behavior.
- Do not treat `trusted-local` identity as blanket approval for provider, architecture, daemon, MCP, import, or release operations.
- Do not let hooks or MCP silently enable bypass mode.
- Do not store secrets in memory requests or runtime evidence.
- Keep runtime capture, Failure Lessons, pending proposals, and approved memory distinguishable.
- Use `--json` on routed registry and session commands when automation needs structured output.

## Related docs

- `AGENT_PROPOSALS.md`
- `MEMORY_PROTOCOL.md`
- `OPERATING_MODEL.md`
- `COMMAND_REFERENCE.md`
- `ENVIRONMENT_VARIABLES.md`
