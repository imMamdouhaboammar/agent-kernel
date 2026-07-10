# Claude context and failure hook

Agent Kernel provides a Claude Code hook adapter for compact file context before risky tools and local failure evidence after failed tools.

The adapter never approves or publishes memory. Failure capture creates or updates a local Failure Lesson only.

## Hook events

- `PreToolUse` for `Edit`, `MultiEdit`, `Write`, and `Bash`
- `PostToolUseFailure` for failed edits or commands

## Claude settings

Add the adapter to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|MultiEdit|Write|Bash",
        "hooks": [
          {
            "type": "command",
            "command": "agent-kernel-claude-context-hook PreToolUse"
          }
        ]
      }
    ],
    "PostToolUseFailure": [
      {
        "matcher": "Edit|MultiEdit|Write|Bash",
        "hooks": [
          {
            "type": "command",
            "command": "agent-kernel-claude-context-hook PostToolUseFailure"
          }
        ]
      }
    ]
  }
}
```

## Pre-tool context

The adapter reads touched files from common Claude payload fields such as `file_path`, `path`, `files`, and `paths`.

It calls the local file-context command with a compact character budget and returns the result through `hookSpecificOutput.additionalContext`.

Example output shape:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "additionalContext": "Agent Kernel local context before Edit:\n..."
  }
}
```

Tools without a file, path, or command return an empty object.

## Failure capture

For `PostToolUseFailure`, the adapter extracts:

- tool name
- touched files
- shell command when present
- stderr, stdout, error, message, or response content

The evidence is redacted before being passed to:

```bash
agent-kernel failure capture
```

The hook does not call `propose`, `approve`, `publish`, or any equivalent memory mutation.

## Timeout and failure mode

The default subprocess timeout is 1200 ms. Override it with:

```bash
export AGENT_KERNEL_HOOK_TIMEOUT_MS=800
```

Allowed range: 100 to 5000 ms.

The hook fails open when strict mode is disabled. In strict mode, a pre-tool context timeout or internal error returns a deny decision rather than silently continuing.

Strict mode is enabled when either condition is true:

```bash
export AGENT_KERNEL_HOOK_STRICT=1
```

or `~/.agent-kernel/config.json` contains:

```json
{
  "strictMode": true
}
```

## Security

Known API key, token, and service-role patterns are replaced with:

```text
[REDACTED_SECRET]
```

Context output is capped at 1800 characters. Failure evidence is capped at 3000 characters. Raw tool payloads are not copied wholesale.

## Troubleshooting

### No context appears

Check that the file has related approved memory, Failure Lessons, episodes, session observations, guard policies, or pending proposals:

```bash
agent-kernel file-context src/cli.mjs --json
```

### Hook times out

Run the file-context command directly and inspect local index or source health. Increase `AGENT_KERNEL_HOOK_TIMEOUT_MS` only after identifying slow local storage or an unusually large Agent Kernel home.

### Failure evidence is missing

Run:

```bash
agent-kernel failure list --json
```

Confirm that the Claude matcher includes `PostToolUseFailure` and that the adapter binary is available on `PATH`.

### Strict mode blocks a tool

The deny reason is intentionally compact. Run the referenced Agent Kernel command directly for full diagnostics, or disable strict mode only when fail-open behavior is explicitly required.
