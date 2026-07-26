# OpenCode live context integration

OpenCode can use Agent Kernel through generated instruction files, a local stdio MCP server, explicit CLI proposal commands, and the optional local runtime daemon.

The daemon is optional. The safest baseline is generated `AGENTS.md` plus MCP.

## Trust boundary

Use OpenCode as `propose-only`:

- Read approved memory and compact context
- Capture observations and failures
- Create pending proposals
- Run guard checks
- Do not approve or publish memory automatically

Register the identity explicitly when this agent needs capture or proposal access:

```bash
agent-kernel agent add opencode --trust propose-only --surface cli
agent-kernel agent show opencode --json
```

Unknown agents remain transient `read-only`; a denied lookup does not silently register them.

## 1. Install and initialize

```bash
npm install -g @mamdouh-aboammar/agent-kernel
agent-kernel init --sync
agent-kernel doctor
```

Default local storage:

```text
~/.agent-kernel
```

Do not store secrets in `opencode.json`, `opencode.jsonc`, `AGENTS.md`, or other repository files.

## 2. Static generated-file setup

From the project root:

```bash
agent-kernel compile
agent-kernel-safe-link . --dry-run
agent-kernel-safe-link .
```

OpenCode should read:

```text
AGENTS.md
```

The generated block remains useful even when MCP is disabled or unavailable.

## 3. MCP setup

Add this project-level configuration to `opencode.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "agent-kernel-memory": {
      "type": "local",
      "command": ["agent-kernel", "mcp", "serve"],
      "enabled": true
    }
  }
}
```

When using a separate local memory home, pass it through the process environment instead of hardcoding credentials or machine-specific secrets:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "agent-kernel-memory": {
      "type": "local",
      "command": ["agent-kernel", "mcp", "serve"],
      "enabled": true,
      "environment": {
        "AGENT_KERNEL_HOME": "/absolute/local/path/to/.agent-kernel-work"
      }
    }
  }
}
```

`AGENT_KERNEL_HOME` is a local path, not a secret. Avoid committing a personal absolute path when the configuration is shared by a team.

Verify the server:

```bash
opencode mcp list
```

Also verify Agent Kernel directly:

```bash
agent-kernel mcp test
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | agent-kernel mcp serve
```

The tool list should include:

```text
agent_kernel_get_context
agent_kernel_get_file_context
```

## 4. Proposal and failure paths

OpenCode should create pending memory proposals through the CLI when direct MCP tool use is unavailable:

```bash
agent-kernel-agent-propose \
  --from opencode \
  --reason "User asked to keep this rule" \
  --text "Use pnpm for this repository."
```

Review and approval remain user actions:

```bash
agent-kernel inbox
agent-kernel approve <proposal-id> --publish
```

Failure evidence can be captured locally:

```bash
agent-kernel failure capture \
  --from opencode \
  --type command-failure \
  --signature "test command failed" \
  --text "<redacted error text>" \
  --command "npm test" \
  --files "src/cli.mjs,test/smoke.mjs"
```

Captured evidence is not automatically approved memory.

## 5. Optional live runtime

Start the local daemon only when an OpenCode wrapper or custom automation needs HTTP observation or context calls:

```bash
agent-kernel daemon start
agent-kernel daemon status --json
```

The daemon is local-only by default and is separate from the stdio MCP server. A non-loopback bind additionally requires `AGENT_KERNEL_DAEMON_ALLOW_REMOTE=1`, a bearer token of at least 32 bytes in `AGENT_KERNEL_DAEMON_TOKEN`, and private or authenticated transport.

Stop it with:

```bash
agent-kernel daemon stop
```

A custom OpenCode workflow may call:

```text
POST http://127.0.0.1:3999/ak/observe
POST http://127.0.0.1:3999/ak/context
```

Agent Kernel does not ship a native OpenCode hook adapter yet. Do not describe custom wrappers as built-in hook support.

## Recommended working flow

```text
OpenCode reads AGENTS.md
  -> OpenCode asks MCP for project or file context
  -> OpenCode performs the task
  -> OpenCode captures evidence or creates a pending proposal
  -> User reviews and approves explicitly
  -> Agent Kernel republishes generated guidance
```

## Known limitations

- Agent Kernel does not currently install OpenCode configuration automatically
- OpenCode hook behavior is not provided by Agent Kernel as a native integration
- Project-scoped configuration may contain machine-specific paths if `AGENT_KERNEL_HOME` is hardcoded
- The optional daemon does not replace MCP
- Agent identity trust must be configured explicitly; generated guidance alone does not grant capture or proposal access
- Static guidance can become stale until Agent Kernel recompiles and safe-links it again

## Rollback

Disable the MCP entry without deleting it:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "agent-kernel-memory": {
      "type": "local",
      "command": ["agent-kernel", "mcp", "serve"],
      "enabled": false
    }
  }
}
```

Or remove only the `agent-kernel-memory` object from `opencode.json` or `opencode.jsonc`.

Verify:

```bash
opencode mcp list
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

For hand-written or untracked files, restore from `.agent-kernel-backups/` or remove only the Agent Kernel marked block.

## Troubleshooting

### Server does not appear

```bash
command -v agent-kernel
agent-kernel mcp test
opencode mcp list
```

Confirm the JSON or JSONC file parses and the command array is exactly:

```json
["agent-kernel", "mcp", "serve"]
```

### Context is missing

```bash
agent-kernel context "current task" --budget 1200 --json
agent-kernel file-context src/cli.mjs --budget 1200 --json
```

### Proposal did not become a rule

```bash
agent-kernel inbox
```

Pending evidence remains pending until the user approves it.
