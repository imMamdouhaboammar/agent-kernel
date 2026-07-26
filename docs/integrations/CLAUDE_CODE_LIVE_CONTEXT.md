# Claude Code live context integration

Claude Code can use Agent Kernel through four independent layers:

1. Generated instruction files
2. The local stdio MCP server
3. Claude Code hooks
4. The optional local runtime daemon

The first two layers are enough for most users. The daemon is optional. Hooks improve automatic context and failure capture, but they do not approve or publish memory.

## Trust boundary

Use Claude Code as `propose-only` in the current Agent Kernel model:

- Read approved memory and local evidence
- Ask for compact project or file context
- Capture observations and failures
- Create pending memory proposals
- Run guard checks
- Never approve or publish durable memory without an explicit user action

Register the identity explicitly when this agent needs capture or proposal access:

```bash
agent-kernel agent add claude --trust propose-only --surface cli
agent-kernel agent show claude --json
```

Unknown agents remain transient `read-only`; a denied lookup does not silently register them.

## 1. Install Agent Kernel

```bash
npm install -g @mamdouh-aboammar/agent-kernel
agent-kernel --version
agent-kernel init --sync
agent-kernel doctor
```

Agent Kernel stores its local state in:

```text
~/.agent-kernel
```

Use a different local home only when you need separate work and personal stores:

```bash
export AGENT_KERNEL_HOME="$HOME/.agent-kernel-work"
agent-kernel init --sync
```

Do not put API keys, access tokens, or service credentials in repository files.

## 2. Static generated-file setup

Run this from the target repository:

```bash
agent-kernel compile
agent-kernel-safe-link . --dry-run
agent-kernel-safe-link .
```

Claude Code can then read the generated Agent Kernel blocks in:

```text
CLAUDE.md
AGENTS.md
```

The safe linker preserves content outside the Agent Kernel markers:

```text
<!-- agent-kernel:start -->
<!-- agent-kernel:end -->
```

Static files remain the fallback when MCP, hooks, or the daemon are unavailable.

## 3. MCP setup

Add the local stdio server at user scope:

```bash
claude mcp add --transport stdio --scope user agent-kernel-memory -- agent-kernel mcp serve
```

Verify the client configuration:

```bash
claude mcp list
claude mcp get agent-kernel-memory
```

Inside Claude Code, run:

```text
/mcp
```

The default MCP surface includes compact tools such as:

```text
agent_kernel_get_status
agent_kernel_search_memory
agent_kernel_get_context
agent_kernel_get_file_context
agent_kernel_propose_memory
agent_kernel_list_pending
agent_kernel_guard_command
agent_kernel_search_episodes
```

The context tools support project IDs, file lists, and character budgets. Pending evidence is clearly separated from approved memory. Rejected proposals are not returned.

### MCP smoke check

Run this outside Claude Code:

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | agent-kernel mcp serve
```

The response should include both context tools.

## 4. Hook setup

Install the current native Claude hooks:

```bash
agent-kernel enforce install
```

Current supported behavior includes:

- `SessionStart` context injection
- `UserPromptSubmit` memory trigger capture
- `PreToolUse` command and protected-path checks
- `PostToolUse` file scanning

For file-aware pre-tool context and local failure evidence, see:

```text
docs/hooks/CLAUDE_CONTEXT_AND_FAILURE_HOOK.md
```

The companion command is:

```bash
agent-kernel-claude-context-hook PreToolUse
agent-kernel-claude-context-hook PostToolUseFailure
```

Hooks may capture evidence or create pending proposals. Hooks must not approve memory, publish memory, or bypass the review inbox.

## 5. Optional live runtime

The daemon is not required for MCP or generated files.

Start it only when a local workflow needs HTTP observation and context endpoints:

```bash
agent-kernel daemon start
agent-kernel daemon status --json
```

The daemon binds to `127.0.0.1` by default. Its local endpoints include:

```text
GET  /ak/status
GET  /ak/sessions
POST /ak/observe
POST /ak/context
```

Stop it with:

```bash
agent-kernel daemon stop
```

A non-loopback bind is rejected unless `AGENT_KERNEL_DAEMON_ALLOW_REMOTE=1` and `AGENT_KERNEL_DAEMON_TOKEN` contains at least 32 bytes. Remote clients must send `Authorization: Bearer <token>`. Use a private network or authenticated tunnel; do not expose the daemon directly to the public internet.

## Recommended working flow

```text
Claude reads generated guidance or asks MCP for context
  -> Claude performs the task
  -> Claude captures a failure or proposes durable memory when relevant
  -> User reviews agent-kernel inbox
  -> User approves and publishes explicitly
  -> Agent Kernel recompiles and refreshes linked files
```

Review and approval commands:

```bash
agent-kernel inbox
agent-kernel approve <proposal-id> --publish
```

## Known limitations

- Agent Kernel gates MCP approval behind extended mode plus `AGENT_KERNEL_MCP_ALLOW_APPROVE=1`; Claude tool prompts are an additional client-side control
- Stdio MCP processes are started by the client and are separate from the optional daemon
- Agent Kernel does not guarantee that every Claude Code release keeps identical hook payload fields
- Agent identity trust must be configured explicitly; project instructions alone do not grant capture or proposal access
- Hooks do not provide approval authority
- Static files can become stale until `compile`, `sync`, or safe-link is run again

## Rollback

Remove the MCP server:

```bash
claude mcp remove agent-kernel-memory
claude mcp list
```

Stop the optional daemon:

```bash
agent-kernel daemon stop
```

For a git-tracked repository, inspect and restore linked files only when you intend to discard the Agent Kernel changes:

```bash
git diff -- AGENTS.md CLAUDE.md
git restore -- AGENTS.md CLAUDE.md
```

For untracked or hand-written files, restore the relevant copy from:

```text
.agent-kernel-backups/
```

Do not delete the whole file merely to remove Agent Kernel. Remove only the marked block or restore the safe-link backup so existing project instructions remain intact.

## Troubleshooting

### Claude cannot find the server

```bash
command -v agent-kernel
agent-kernel mcp test
claude mcp get agent-kernel-memory
```

Restart Claude Code after changing MCP configuration.

### Context is empty

```bash
agent-kernel context "current task" --budget 1200 --json
agent-kernel file-context src/cli.mjs --budget 1200 --json
```

Empty output can be valid when no approved memory or pending evidence matches the task or files.

### A memory change is missing

```bash
agent-kernel inbox
agent-kernel compile
agent-kernel-safe-link . --dry-run
agent-kernel-safe-link .
```

A pending proposal does not become durable guidance until the user approves it.
