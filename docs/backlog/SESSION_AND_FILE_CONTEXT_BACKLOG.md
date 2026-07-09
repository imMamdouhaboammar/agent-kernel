# Session and File Context Backlog

## Goal

Make Agent Kernel useful at the exact moment an AI coding agent touches a file, runs a command, hits a failure, or creates a commit.

The focus is not storing everything forever. The focus is capturing enough local evidence to prevent repeated mistakes and to help agents retrieve the right approved rules, Failure Lessons, and episodes before they repeat old errors.

## Product constraints

1. Session capture is local only
2. Raw observations are not approved memory
3. File context works without daemon mode
4. File context is budget-aware
5. Failure Lessons remain evidence-first
6. Commit linking works offline and does not require GitHub API
7. Retention can prune raw observations without deleting approved memory

---

# AK-SESSION-001: Session model

## User story

As a user, I want Agent Kernel to track each agent session, so I can understand what happened before a bug, edit, failure, or commit.

## Commands

```bash
agent-kernel session start --agent claude-code --project .
agent-kernel session end <session-id>
agent-kernel session list
agent-kernel session show <session-id>
agent-kernel session show <session-id> --json
```

## Session record

```json
{
  "id": "session_...",
  "projectId": "agent-kernel",
  "cwd": "/path/to/repo",
  "agentId": "claude-code",
  "agentRole": "coding-agent",
  "trustLevel": "propose-only",
  "startedAt": "ISO timestamp",
  "endedAt": "ISO timestamp",
  "status": "active",
  "observationCount": 0,
  "linkedCommits": [],
  "linkedFailures": [],
  "linkedEpisodes": [],
  "summary": ""
}
```

## Acceptance criteria

1. Sessions are stored as local JSON
2. Observations are stored as append-only JSONL per session
3. Session commands work without daemon mode
4. Unknown agents are accepted with safe default trust
5. Session state can reference failures, episodes, and commits
6. Corrupted session files produce warnings, not crashes

---

# AK-SESSION-002: Observation capture

## User story

As an AI coding workflow user, I want Agent Kernel to capture useful session events, so repeated mistakes can become searchable evidence later.

## Observation types

```text
user_prompt
assistant_plan
tool_use
tool_result
tool_failure
file_read
file_edit
command_run
command_failure
test_failure
guard_block
permission_prompt
session_summary
manual_note
```

## Observation record

```json
{
  "id": "obs_...",
  "sessionId": "session_...",
  "timestamp": "ISO timestamp",
  "agentId": "claude-code",
  "type": "command_failure",
  "projectId": "agent-kernel",
  "cwd": "/path/to/repo",
  "files": ["src/cli.mjs"],
  "command": "npm test",
  "exitCode": 1,
  "text": "safe-link duplicated marked block",
  "metadata": {}
}
```

## Acceptance criteria

1. Observations are append-only
2. Required fields are validated
3. Unknown fields do not become trusted state
4. Search can filter observations by session, file, command, type, and text
5. Observations never become approved memory automatically
6. Large command output is clipped according to config

---

# AK-SESSION-003: Session timeline

## User story

As a maintainer, I want a compact timeline of what an agent did, so I can diagnose failures without reading raw logs.

## Commands

```bash
agent-kernel session timeline <session-id>
agent-kernel session timeline <session-id> --type command_failure
agent-kernel session timeline <session-id> --files src/cli.mjs
agent-kernel session timeline <session-id> --compact
agent-kernel session timeline <session-id> --json
```

## Example output

```text
10:14:02 user_prompt       Fix failing safe-link smoke test
10:14:18 file_read         src/cli.mjs
10:15:44 file_edit         src/cli.mjs
10:16:10 command_run       npm test
10:16:39 command_failure   safe-link duplicated marked block
10:17:22 failure_capture   failure_123
```

## Acceptance criteria

1. Timeline is chronological
2. Timeline can filter by event type
3. Timeline can filter by file
4. Compact output fits in terminal
5. JSON output is available
6. Empty sessions are handled gracefully

---

# AK-FILE-001: File context command

## User story

As an AI coding agent, I want to ask Agent Kernel what it knows about a file before editing it, so I avoid repeating old mistakes.

## Commands

```bash
agent-kernel file-context src/cli.mjs
agent-kernel file-context src/cli.mjs test/smoke.mjs --budget 1200
agent-kernel file-context src/cli.mjs --json
```

## Context sources

1. Approved memories tagged with the file
2. Failure Lessons mentioning the file
3. Episodes linked to the file
4. Session observations involving the file
5. Guard policies related to the file
6. Pending proposals related to the file, clearly marked as pending

## Output sections

```text
Approved Rules
Failure Lessons
Related Episodes
Recent Session Observations
Guard Warnings
Pending Proposals
```

## Acceptance criteria

1. File context works without daemon mode
2. Results are budget-aware
3. Approved memory and pending proposals are clearly separated
4. Rejected proposals are never shown
5. Results are sorted by relevance and recency
6. Paths are normalized relative to the project root where possible

---

# AK-FILE-002: Add file references to core records

## User story

As a user, I want memories, failures, and episodes to point to relevant files, so agents can retrieve them when editing those files.

## Record update

Memory, Failure Lesson, Episode, Session Observation, and Commit records should support:

```json
{
  "files": [
    "src/cli.mjs",
    "test/smoke.mjs"
  ]
}
```

## Commands to update

```bash
agent-kernel remember "..." --files src/cli.mjs
agent-kernel propose --text "..." --files src/cli.mjs
agent-kernel failure capture ... --files src/cli.mjs
agent-kernel episode add ... --files src/cli.mjs
```

## Acceptance criteria

1. Existing records without `files` remain valid
2. File paths are normalized consistently
3. File filters work in memory, failure, and episode search
4. Compile output can optionally include file-specific notes
5. Tests cover path normalization and old schema compatibility

---

# AK-FILE-003: File context hook adapter

## User story

As a Claude Code user, I want Agent Kernel to provide file-specific context before risky file edits, so the agent has relevant local memory before writing.

## Hook points

```text
PreToolUse for Edit, MultiEdit, Write, Bash
PostToolUseFailure for failed edits or commands
```

## Behavior

1. Detect touched files from hook payload
2. Call `agent-kernel file-context` or runtime `/ak/context`
3. Return compact context as structured hook output
4. Capture failures as evidence after failed tools
5. Never approve or publish memory from hook

## Acceptance criteria

1. Hook has a short timeout
2. Hook fails open unless strict guard mode is active
3. Hook output is compact
4. Hook does not print raw secrets
5. Hook docs include examples and troubleshooting

---

# AK-COMMIT-001: Commit link command

## User story

As a maintainer, I want to link an agent session to a git commit, so I can trace the context behind a change later.

## Commands

```bash
agent-kernel commit link --sha <sha> --session <session-id>
agent-kernel commit list
agent-kernel commit show <sha>
agent-kernel commit context <sha>
```

## Commit record

```json
{
  "sha": "...",
  "shortSha": "...",
  "repo": "...",
  "branch": "master",
  "message": "...",
  "author": "...",
  "authoredAt": "ISO timestamp",
  "files": [],
  "sessionIds": [],
  "failureIds": [],
  "episodeIds": [],
  "linkedAt": "ISO timestamp"
}
```

## Acceptance criteria

1. Commit links are idempotent
2. Multiple sessions can link to one commit
3. `commit context` returns related sessions, failures, and episodes
4. Command works offline
5. Command does not require GitHub API
6. Missing git metadata creates a clear warning

---

# AK-COMMIT-002: Optional post-commit helper

## User story

As a user, I want Agent Kernel to optionally link the latest session to a commit after commit creation, so memory stays connected to code history.

## Command

```bash
agent-kernel git-hook install --commit-link
```

## Behavior

1. Installs a safe post-commit hook
2. Links HEAD commit to the latest active or recently completed session
3. Does not block commit if Agent Kernel is unavailable
4. Writes local evidence only
5. Uses marked blocks and preserves existing hooks

## Acceptance criteria

1. Hook is opt-in
2. Hook install is idempotent
3. Existing hooks are preserved
4. Repeated installs do not duplicate marked blocks
5. Tests cover install, dry-run, and repeated install

---

# AK-PATTERN-001: Recurring failure detection

## User story

As a user, I want Agent Kernel to identify repeated failures, so I can promote real patterns into durable rules or workflows.

## Command

```bash
agent-kernel failure patterns
agent-kernel failure patterns --min-count 3
agent-kernel failure patterns --project .
```

## Pattern signals

1. Same error text
2. Same command
3. Same file
4. Same root cause
5. Same fix
6. Same agent repeating the same mistake

## Acceptance criteria

1. Pattern detection is local
2. No LLM is required
3. Each pattern includes evidence references
4. User can promote pattern to proposal
5. False positives are easy to reject

---

# AK-PATTERN-002: Pattern to proposal

## User story

As a user, I want recurring failures to become reviewable proposals, so useful lessons can become durable memory without manual rewriting.

## Commands

```bash
agent-kernel failure propose-pattern <pattern-id> --as rule
agent-kernel failure propose-pattern <pattern-id> --as workflow
agent-kernel failure propose-pattern <pattern-id> --as skill
```

## Allowed proposal targets

```text
rule
policy
workflow
skill
note
```

## Acceptance criteria

1. Proposal is created in pending inbox
2. Proposal includes evidence references
3. Proposal does not auto-publish
4. Proposal text is concise and editable
5. User can approve or reject through the normal flow
