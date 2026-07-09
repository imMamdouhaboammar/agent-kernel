# Failure Lessons Hook

`agent-kernel-failure-hook` is a best-effort Claude Code hook adapter for failed tool calls.

It reads the hook JSON payload from stdin, extracts failed command or tool output, captures a local Failure Lesson, and returns structured JSON output that adds a short reminder to Claude's context.

The hook only captures and contextualizes. It does not approve, publish, or mutate approved memory.

## Recommended Claude Code event

Use `PostToolUseFailure`, not broad `PostToolUse`, for automatic failure capture.

Why:

- it fires only when a tool call fails
- it avoids regex-detecting failure from successful tool output
- it reduces process-spawn overhead
- it keeps the capture layer observational rather than blocking

## Recommended settings

Use exec form with `command` + `args` instead of shell form.

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

The `args` array is intentional. In Claude Code exec form, `args` means the command is spawned directly instead of being passed through a shell. That avoids shell tokenization, shell expansion, and quoting bugs.

For maximum cross-platform safety in a project-local install, use `node` plus the script path:

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

## Manual test

```bash
echo '{"hook_event_name":"PostToolUseFailure","tool_name":"Bash","tool_input":{"command":"npm test"},"tool_response":{"exit_code":1,"stderr":"ERR_MODULE_NOT_FOUND"}}' \
  | agent-kernel-failure-hook
```

Expected result:

```json
{
  "suppressOutput": true,
  "hookSpecificOutput": {
    "hookEventName": "PostToolUseFailure",
    "additionalContext": "Agent Kernel captured Failure Lesson failure_lesson_..."
  }
}
```

The captured lesson is stored in:

```text
~/.agent-kernel/source/failures/failure-lessons.json
```

## Best-practice rules

1. Prefer `PostToolUseFailure` for failure capture.
2. Prefer exec form: `command` plus `args`.
3. Keep matchers narrow. Start with `Bash|Write|Edit|MultiEdit` rather than `*`.
4. Keep the hook fast. Set a short timeout because it runs inside the agent loop.
5. Return JSON output instead of raw stdout so Claude receives useful context without transcript noise.
6. Never approve or publish memory from the hook. Create pending proposals only through `agent-kernel failure propose`.
7. Never treat hooks as the only security boundary. Critical enforcement belongs in permissions, guard checks, git hooks, or CI.
8. Keep project-level hooks reviewable, because project settings are shareable and can become an execution surface.

## Review flow

```bash
agent-kernel failure list
agent-kernel failure show <id>
agent-kernel failure propose <id> --as rule
agent-kernel inbox
agent-kernel approve <proposal-id> --publish
```
