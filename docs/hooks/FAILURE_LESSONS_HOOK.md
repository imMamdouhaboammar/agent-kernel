# Failure Lessons Hook

`agent-kernel-failure-hook` is a best-effort hook adapter for agent tool failures.

It reads a JSON payload from stdin, looks for failed command or tool output, and stores a local Failure Lesson when the payload contains an exit code, error field, or common failure signature.

## Manual test

```bash
echo '{"tool_input":{"command":"npm test"},"tool_response":{"exit_code":1,"stderr":"ERR_MODULE_NOT_FOUND"}}' \
  | agent-kernel-failure-hook
```

Expected result:

```text
Captured failure lesson: failure_lesson_...
Signature: ERR_MODULE_NOT_FOUND
```

## Claude Code settings example

Add this command to a Claude hook event that receives tool output payloads:

```json
{
  "type": "command",
  "command": "agent-kernel-failure-hook"
}
```

This hook only captures. It does not approve or publish memory.

## Review flow

```bash
agent-kernel failure list
agent-kernel failure show <id>
agent-kernel failure propose <id> --as rule
agent-kernel inbox
agent-kernel approve <proposal-id> --publish
```
