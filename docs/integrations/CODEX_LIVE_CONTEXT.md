# Codex live context integration

Codex can use Agent Kernel through generated `AGENTS.md` guidance, a local stdio MCP server, explicit CLI proposal commands, and the optional local runtime daemon.

The daemon is optional. The recommended baseline is generated files plus MCP.

## Trust boundary

Use Codex as `propose-only`:

- Read approved memory and compact task context
- Ask for file-specific context before edits
- Capture failure evidence
- Create pending memory proposals
- Run guard checks
- Never approve or publish durable memory without an explicit user action

The agent registry and enforced trust profiles are planned separately. This recommendation does not grant additional runtime permissions today.

## 1. Install and initialize

```bash
npm install -g @mamdouh-aboammar/agent-kernel
agent-kernel --version
agent-kernel init --sync
agent-kernel doctor
```

Default local state:

```text
~/.agent-kernel
```

Do not put API keys, bearer tokens, or service credentials in `.codex/config.toml`, `AGENTS.md`, or other tracked repository files.

## 2. Static generated-file setup

From the repository root:

```bash
agent-kernel compile
agent-kernel-safe-link . --dry-run
agent-kernel-safe-link .
```

Codex should read:

```text
AGENTS.md
```

The generated file is the fallback when MCP is unavailable. Existing hand-written instructions remain outside the Agent Kernel marked block.

## 3. MCP setup with the Codex CLI

Add Agent Kernel as a local stdio server:

```bash
codex mcp add agent-kernel-memory -- agent-kernel mcp serve
```

Verify it:

```bash
codex mcp list
codex mcp --help
```

Inside the Codex terminal UI, use:

```text
/mcp
```

To remove it later, use the removal command shown by:

```bash
codex mcp --help
```

## 4. MCP setup with config.toml

For user-wide configuration, edit:

```text
~/.codex/config.toml
```

For a trusted project-only configuration, edit:

```text
.codex/config.toml
```

Add:

```toml
[mcp_servers.agent-kernel-memory]
command = "agent-kernel"
args = ["mcp", "serve"]
enabled = true
required = false
startup_timeout_sec = 10
tool_timeout_sec = 60
default_tools_approval_mode = "prompt"
```

When a separate local memory home is required, prefer forwarding an existing environment variable:

```toml
[mcp_servers.agent-kernel-memory]
command = "agent-kernel"
args = ["mcp", "serve"]
env_vars = ["AGENT_KERNEL_HOME"]
enabled = true
required = false
default_tools_approval_mode = "prompt"
```

Set the variable in the local shell profile:

```bash
export AGENT_KERNEL_HOME="$HOME/.agent-kernel-work"
```

This avoids committing a machine-specific absolute path. `AGENT_KERNEL_HOME` is a local path rather than a credential, but personal paths still do not belong in shared configuration unless the team has agreed on them.

## 5. Verify Agent Kernel directly

```bash
agent-kernel mcp test
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | agent-kernel mcp serve
```

The public MCP route should expose:

```text
agent_kernel_get_context
agent_kernel_get_file_context
```

The tools accept project IDs, file lists, session IDs where applicable, and character budgets. Pending evidence is separated from approved memory. Rejected proposals are not returned.

## 6. Proposal and failure paths

When Codex identifies a durable rule, create a pending proposal:

```bash
agent-kernel-agent-propose \
  --from codex \
  --reason "User requested a durable repository rule" \
  --text "Run the smoke suite before merging."
```

Or use the public CLI:

```bash
agent-kernel propose \
  --from codex \
  --reason "User requested a durable repository rule" \
  --text "Run the smoke suite before merging."
```

Review and approval remain explicit user actions:

```bash
agent-kernel inbox
agent-kernel approve <proposal-id> --publish
```

Capture failure evidence without promoting it automatically:

```bash
agent-kernel failure capture \
  --from codex \
  --type command-failure \
  --signature "npm test failed" \
  --text "<redacted error text>" \
  --command "npm test" \
  --files "src/cli.mjs,test/smoke.mjs"
```

## 7. Optional live runtime

Start the daemon only when a wrapper or local automation needs HTTP observations or context:

```bash
agent-kernel daemon start
agent-kernel daemon status
```

The daemon is local-only by default and is independent from the stdio MCP process started by Codex.

Stop it with:

```bash
agent-kernel daemon stop
```

Agent Kernel does not currently claim native Codex blocking hooks. Any wrapper that observes commands or files is an external integration and must not be documented as a built-in Codex hook.

## Recommended working flow

```text
Codex reads AGENTS.md
  -> Codex requests task or file context through MCP
  -> Codex performs a small, reviewable patch
  -> Codex captures failures or creates a pending proposal
  -> User reviews and approves explicitly
  -> Agent Kernel republishes generated guidance
```

## Known limitations

- Codex hook enforcement depends on the host environment or wrapper and is not a native Agent Kernel guarantee
- The optional daemon does not replace the MCP server
- Project-scoped `.codex/config.toml` is appropriate only for trusted projects
- The agent trust recommendation is not yet enforced by the planned registry
- Static `AGENTS.md` guidance can become stale until compile and safe-link run again
- MCP approval remains disabled by default inside Agent Kernel

## Rollback

Disable the server without deleting its configuration:

```toml
[mcp_servers.agent-kernel-memory]
command = "agent-kernel"
args = ["mcp", "serve"]
enabled = false
```

Then verify:

```bash
codex mcp list
```

To remove a CLI-managed server, check the installed Codex command syntax:

```bash
codex mcp --help
```

Stop the optional daemon:

```bash
agent-kernel daemon stop
```

For tracked generated files:

```bash
git diff -- AGENTS.md
git restore -- AGENTS.md
```

For untracked or hand-written files, restore from `.agent-kernel-backups/` or remove only the marked Agent Kernel block.

## Troubleshooting

### Codex does not show the server

```bash
command -v agent-kernel
agent-kernel mcp test
codex mcp list
```

Restart Codex after changing MCP configuration.

### MCP starts but returns no context

```bash
agent-kernel context --query "current task" --budget 1200 --json
agent-kernel file-context src/cli.mjs --budget 1200 --json
```

No matching context is valid when the local store has no relevant approved memory or pending evidence.

### A proposal is missing from generated guidance

```bash
agent-kernel inbox
agent-kernel compile
agent-kernel-safe-link . --dry-run
agent-kernel-safe-link .
```

A pending proposal must be approved before it appears as durable generated guidance.
