# Claude Hooks Best Practices

This document captures the hook conventions Agent Kernel follows for Claude Code integration.

## Operating principles

1. Hooks are lifecycle adapters, not hidden agents.
2. Hooks should capture evidence, add context, or block only when the event explicitly supports that decision.
3. Hooks should not silently approve or publish memory.
4. Hooks should be narrow, fast, deterministic, and auditable.
5. Project-level hooks are shareable config and must be treated as an execution surface.

## Event selection

Use the most specific lifecycle event available.

| Goal | Preferred event | Reason |
|---|---|---|
| Capture failed shell/tool output | `PostToolUseFailure` | Fires only after a failed tool call |
| Block destructive shell input | `PreToolUse` | Can deny before execution |
| Add fresh project context | `SessionStart` | Runs at startup/resume |
| Audit loaded instructions | `InstructionsLoaded` | Observability only, no blocking |
| Watch config drift | `ConfigChange` | Detects settings changes during a session |

Avoid putting failure capture on broad `PostToolUse` unless the agent lacks a failure-specific event. Broad successful-output hooks create noise and unnecessary spawn overhead.

## Command execution form

Prefer exec form:

```json
{
  "type": "command",
  "command": "node",
  "args": ["${CLAUDE_PROJECT_DIR}/scripts/hook.js"],
  "timeout": 5
}
```

Avoid shell form unless shell behavior is the point:

```json
{
  "type": "command",
  "command": "node \"${CLAUDE_PROJECT_DIR}\"/scripts/hook.js"
}
```

Exec form avoids shell tokenization, shell variable expansion, pipes, redirects, and quoting mistakes.

## Matcher discipline

Use narrow matchers first:

```json
"matcher": "Bash|Write|Edit|MultiEdit"
```

Avoid:

```json
"matcher": "*"
```

For MCP tools, match the full server/tool namespace pattern:

```json
"matcher": "mcp__memory__.*"
```

## Output discipline

Prefer JSON output over raw stdout.

Good:

```json
{
  "suppressOutput": true,
  "hookSpecificOutput": {
    "hookEventName": "PostToolUseFailure",
    "additionalContext": "Agent Kernel captured Failure Lesson failure_lesson_..."
  }
}
```

Avoid raw logs as stdout because they can become noisy context. Send operational diagnostics to stderr only when the hook fails.

## Security boundaries

Do not rely on hooks alone for hard security. Use the right control layer:

| Concern | Better control |
|---|---|
| Dangerous command prevention | Claude permissions + `agent-kernel guard` + git hooks |
| Secret leaks | guard checks + CI scanners |
| Repo-level untrusted config | review settings changes + managed settings where available |
| Repeated failure learning | Failure Lessons capture + pending proposal approval |

## Agent Kernel Failure Lessons hook

Recommended project settings:

```json
{
  "hooks": {
    "PostToolUseFailure": [
      {
        "matcher": "Bash|Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "agent-kernel-failure-hook",
            "args": [],
            "timeout": 5,
            "statusMessage": "Capturing Agent Kernel failure lesson"
          }
        ]
      }
    ]
  }
}
```

For project-local npm installs and stronger cross-platform behavior:

```json
{
  "type": "command",
  "command": "node",
  "args": [
    "${CLAUDE_PROJECT_DIR}/node_modules/@mamdouh-aboammar/agent-kernel/bin/agent-kernel-failure-hook.mjs"
  ],
  "timeout": 5,
  "statusMessage": "Capturing Agent Kernel failure lesson"
}
```

## Review checklist

Before adding or changing a hook:

- Is the event the narrowest correct lifecycle event?
- Is the matcher narrow enough?
- Does the hook use exec form with `args`?
- Is timeout explicit and short?
- Does stdout return JSON rather than raw logs?
- Does the hook avoid secret logging?
- Does it avoid auto-approval or hidden publishing?
- Is there a test that exercises the hook payload shape?
