# Cursor live context integration

Cursor can use Agent Kernel through project instruction files, a local stdio MCP server, explicit CLI proposal commands, and the optional local runtime daemon.

The daemon is optional. The safest baseline is the generated Cursor rule plus MCP.

## Trust boundary

Use Cursor as `propose-only`:

- Read approved memory and compact context
- Ask for file-specific context before editing
- Capture failure evidence
- Create pending proposals
- Run guard checks
- Do not approve or publish memory automatically

The planned agent registry will enforce trust profiles later. This document describes the recommended operating boundary for the current release.

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

Do not store API keys, access tokens, service-role keys, or other credentials in `.cursor/mcp.json`, Cursor rules, or tracked project files.

## 2. Static generated-file setup

Run from the repository root:

```bash
agent-kernel compile
agent-kernel-safe-link . --dry-run
agent-kernel-safe-link .
```

Cursor should read the generated rule:

```text
.cursor/rules/00-agent-kernel.mdc
```

Agent Kernel also links `AGENTS.md` for clients and workflows that support it.

The static rule is the fallback when MCP is disabled, unavailable, or still starting.

## 3. Project MCP setup

Create or update:

```text
.cursor/mcp.json
```

Use this local stdio server configuration:

```json
{
  "mcpServers": {
    "agent-kernel-memory": {
      "command": "agent-kernel",
      "args": ["mcp", "serve"]
    }
  }
}
```

Restart Cursor after changing the file. Open Cursor MCP settings and confirm that `agent-kernel-memory` is enabled and connected.

When a separate memory home is required, pass only the local path:

```json
{
  "mcpServers": {
    "agent-kernel-memory": {
      "command": "agent-kernel",
      "args": ["mcp", "serve"],
      "env": {
        "AGENT_KERNEL_HOME": "/absolute/local/path/to/.agent-kernel-work"
      }
    }
  }
}
```

Avoid committing a personal absolute path into a shared repository. Prefer the default home or a team-agreed environment setup.

## 4. Verify Agent Kernel

Run the server smoke checks in a terminal:

```bash
agent-kernel mcp test
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | agent-kernel mcp serve
```

The tool list should include:

```text
agent_kernel_get_context
agent_kernel_get_file_context
```

The context tools support project IDs, file lists, and character budgets. Approved memory is separated from pending evidence. Rejected proposals are not exposed.

## 5. Proposal and failure paths

When Cursor identifies a durable rule, create a pending proposal instead of editing generated Agent Kernel files:

```bash
agent-kernel-agent-propose \
  --from cursor \
  --reason "User requested a durable repository rule" \
  --text "Keep public API changes backward compatible."
```

Review and approval remain user actions:

```bash
agent-kernel inbox
agent-kernel approve <proposal-id> --publish
```

Capture local failure evidence when needed:

```bash
agent-kernel failure capture \
  --from cursor \
  --type tool-failure \
  --signature "edit failed" \
  --text "<redacted error text>" \
  --files "src/cli.mjs"
```

Failure capture does not approve or publish memory.

## 6. Optional live runtime

Start the daemon only when a custom Cursor workflow or local helper needs HTTP context or observation endpoints:

```bash
agent-kernel daemon start
agent-kernel daemon status
```

The daemon is local-only by default and does not replace the stdio MCP server.

Stop it with:

```bash
agent-kernel daemon stop
```

Agent Kernel does not currently ship a native Cursor hook that blocks tool calls or automatically injects daemon context. Do not describe custom Cursor tasks, shell wrappers, or extensions as built-in Agent Kernel hooks.

## Recommended working flow

```text
Cursor reads the generated .mdc rule
  -> Cursor asks MCP for project or file context
  -> Cursor performs a small, reviewable change
  -> Cursor captures evidence or creates a pending proposal
  -> User reviews and approves explicitly
  -> Agent Kernel recompiles and refreshes linked guidance
```

## Known limitations

- Cursor MCP configuration and UI behavior can vary by Cursor release
- Agent Kernel does not install Cursor MCP configuration automatically
- Agent Kernel does not claim native Cursor hook support
- The optional daemon is independent from MCP
- The trust recommendation is not yet enforced by the planned agent registry
- Static Cursor rules can become stale until compile and safe-link run again
- MCP approval remains disabled by default inside Agent Kernel

## Rollback

Disable or remove only the `agent-kernel-memory` entry from `.cursor/mcp.json`.

A disabled local file can be kept for later by renaming it outside Cursor's active configuration path:

```bash
mv .cursor/mcp.json .cursor/mcp.json.disabled
```

Use that command only when the file contains no other MCP servers. When other servers are present, edit the JSON and remove only the Agent Kernel object.

Stop the optional daemon:

```bash
agent-kernel daemon stop
```

Inspect generated-file changes:

```bash
git diff -- AGENTS.md .cursor/rules/00-agent-kernel.mdc
```

For tracked files, restore only when you intend to discard the complete local change:

```bash
git restore -- AGENTS.md .cursor/rules/00-agent-kernel.mdc
```

For hand-written or untracked files, restore from `.agent-kernel-backups/` or remove only the Agent Kernel marked block.

## Troubleshooting

### Cursor cannot start the MCP server

```bash
command -v agent-kernel
agent-kernel mcp test
```

Confirm that Cursor can resolve the same `agent-kernel` executable from its process environment. Restart Cursor after updating shell paths or MCP configuration.

### The generated Cursor rule is missing

```bash
agent-kernel compile
agent-kernel-safe-link . --dry-run
agent-kernel-safe-link .
ls -la .cursor/rules/00-agent-kernel.mdc
```

### Context is empty

```bash
agent-kernel context --query "current task" --budget 1200 --json
agent-kernel file-context src/cli.mjs --budget 1200 --json
```

Empty context can be valid when no local evidence matches the task or file.

### A proposal did not become durable guidance

```bash
agent-kernel inbox
```

The user must approve the proposal before Agent Kernel publishes it.
