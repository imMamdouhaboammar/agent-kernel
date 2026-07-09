# Search, Retention, and Reporting Backlog

## Goal

Improve retrieval quality, local data hygiene, and inspection without making Agent Kernel heavy.

Agent Kernel should remain useful with plain local files. Search should become better before adding embeddings. Raw observations should not live forever unless the user wants that. Inspection should start in the terminal, not with a dashboard.

## Product constraints

1. No required external search service
2. No required vector database
3. No required embeddings
4. No web dashboard in the first pass
5. Approved memory is not deleted by raw observation retention
6. Import is review-first by default
7. Reports are local and generated on demand
8. All source data remains readable and portable

---

# AK-SEARCH-001: Structured local search index

## User story

As a user, I want faster and better local search across memories, episodes, failures, and sessions.

## Index location

```text
~/.agent-kernel/index/
  memory-index.json
  failure-index.json
  episode-index.json
  session-index.json
```

## Commands

```bash
agent-kernel reindex
agent-kernel search "ERR_MODULE_NOT_FOUND"
agent-kernel search "safe-link duplicate block" --type failure
agent-kernel search "src/cli.mjs" --files
agent-kernel search "npm test" --commands
```

## Indexed fields

1. Title
2. Text
3. Tags
4. Files
5. Commands
6. Error text
7. Root cause
8. Fix
9. Agent ID
10. Project ID
11. Created timestamp
12. Updated timestamp
13. Linked session IDs
14. Linked commit SHAs

## Acceptance criteria

1. Search works without external libraries
2. Index can rebuild from source data
3. Search still works if index is missing
4. Index corruption does not corrupt source data
5. `agent-kernel reindex` rebuilds all indexes
6. Tests cover missing and corrupted index files

---

# AK-SEARCH-002: Relevance scoring

## User story

As an agent, I want the most relevant local context first, so I do not waste context budget.

## Ranking signals

1. Exact file match
2. Exact command match
3. Exact error match
4. Tag match
5. Project match
6. Recent related session
7. Approved memory priority
8. Failure recurrence count
9. Agent match
10. Commit link match

## Command examples

```bash
agent-kernel search "safe-link idempotency" --budget 1200
agent-kernel search "ERR_MODULE_NOT_FOUND" --debug
agent-kernel search "src/cli.mjs" --explain
```

## Debug output should show

```text
score: 92
reasons:
  + exact file match: src/cli.mjs
  + failure recurrence count: 4
  + approved rule priority: critical
  + recent session match: 2026-07-09
```

## Acceptance criteria

1. Ranking is deterministic
2. Ranking can be explained with `--debug` or `--explain`
3. Search supports budget limits
4. Search supports JSON output
5. No embeddings are required
6. Search results separate approved memory from raw observations

---

# AK-SEARCH-003: Optional smart mode

## User story

As an advanced user, I want optional smarter retrieval later, without adding heavy dependencies to the default install.

## Command shape

```bash
agent-kernel search "why did auth tests fail before" --mode smart
```

## Rules

1. Default mode stays local lexical search
2. Smart mode is opt-in
3. Smart mode must gracefully fall back to local search
4. Smart mode cannot become required for file context
5. Smart mode must not send data outside the machine unless the user explicitly configures a provider

## Acceptance criteria

1. Smart mode is disabled by default
2. No provider keys are required for normal use
3. Search output marks which mode was used
4. Docs explain privacy tradeoffs clearly
5. Tests cover fallback behavior

---

# AK-RETENTION-001: Raw observation retention policy

## User story

As a privacy-conscious user, I want raw session logs to expire or be compacted, while approved memory remains durable.

## Config

```json
{
  "runtimeRetentionDays": 30,
  "keepFailureEvidence": true,
  "keepApprovedMemoryForever": true,
  "autoPruneRawObservations": false
}
```

## Commands

```bash
agent-kernel retention status
agent-kernel retention prune --dry-run
agent-kernel retention prune
agent-kernel retention compact --dry-run
```

## Rules

1. Approved memories are never deleted by retention
2. Approved policies are never deleted by retention
3. Failure Lessons are preserved unless explicitly included
4. Raw observations may be pruned according to policy
5. Session summaries may remain after raw logs are pruned
6. Every prune operation writes an audit entry

## Acceptance criteria

1. Prune has dry-run mode
2. Prune asks for confirmation unless forced
3. Approved memories are not deleted
4. Failure Lessons are preserved by default
5. Deleted record counts are reported
6. Audit log records what was pruned

---

# AK-RETENTION-002: Session compaction

## User story

As a user, I want long sessions to be summarized locally, so Agent Kernel remains useful without keeping noisy raw logs forever.

## Commands

```bash
agent-kernel session compact <session-id>
agent-kernel session compact <session-id> --dry-run
agent-kernel session compact --older-than 30d
```

## Output

A compact session summary may include:

1. Main task
2. Files touched
3. Commands run
4. Failures encountered
5. Fixes applied
6. Follow-up proposals
7. Linked Failure Lessons
8. Linked commits

## Acceptance criteria

1. Compaction can run without an LLM
2. Compaction does not create approved memory
3. Compaction can create a pending proposal only with explicit flag
4. Raw logs are kept unless prune is requested
5. Summary links back to source session

---

# AK-EXPORT-001: Local export

## User story

As a user, I want to export my local Agent Kernel data, so I can back it up or move to another machine.

## Command

```bash
agent-kernel export ./agent-kernel-backup.json
agent-kernel export ./agent-kernel-backup.json --redact
agent-kernel export ./agent-kernel-backup.json --scope approved
```

## Export should include

1. Version metadata
2. Approved memories
3. Policies
4. Failure Lessons
5. Episodes
6. Agent registry
7. Project registry
8. Optional sessions
9. Optional observations

## Default exclusions

1. Secrets
2. Local machine tokens
3. Private MCP credentials
4. Runtime daemon PID files
5. Temporary cache files

## Acceptance criteria

1. Export writes valid JSON
2. Export includes schema version
3. Redaction mode removes sensitive fields
4. Export can scope to approved memory only
5. Tests validate export structure

---

# AK-IMPORT-001: Review-first import

## User story

As a user, I want to import Agent Kernel data safely, so another bundle cannot silently overwrite my approved memory.

## Commands

```bash
agent-kernel import ./agent-kernel-backup.json --to inbox
agent-kernel import ./agent-kernel-backup.json --inspect
agent-kernel import ./agent-kernel-backup.json --replace
```

## Default behavior

Import defaults to review-first. Durable memory from an imported file should go to inbox unless the user explicitly requests replace.

## Acceptance criteria

1. Import validates schema before writing
2. Import to inbox is default
3. Replace requires explicit flag
4. Import reports conflicts
5. Import never imports secrets by default
6. Tests cover old version, invalid schema, and conflict cases

---

# AK-VIEW-001: Terminal viewer

## User story

As a user, I want a simple terminal view of recent sessions, proposals, and failures without opening a dashboard.

## Commands

```bash
agent-kernel view
agent-kernel view sessions
agent-kernel view failures
agent-kernel view inbox
agent-kernel view agents
```

## View sections

Default `agent-kernel view` should show:

1. Kernel home
2. Runtime status
3. Pending proposals
4. Recent failures
5. Recent sessions
6. Top file hotspots
7. Stale generated files warning
8. Suggested next commands

## Acceptance criteria

1. Terminal only
2. No web UI required
3. Works offline
4. Uses existing local data
5. Adds no runtime dependency
6. Output is readable in narrow terminals

---

# AK-REPORT-001: Static HTML report

## User story

As a user, I want to generate a static local report for review, without running a dashboard server.

## Command

```bash
agent-kernel report ./agent-kernel-report.html
agent-kernel report ./agent-kernel-report.html --scope last-30-days
```

## Report sections

1. Memory summary
2. Pending proposals
3. Recent failures
4. Recent sessions
5. File hotspots
6. Agent activity
7. Guard blocks
8. Commit links
9. Recommended cleanup

## Acceptance criteria

1. Static HTML only
2. No client-side package dependency
3. No external assets
4. No secrets
5. Generated on demand
6. Report includes generation timestamp and kernel version

---

# AK-AUDIT-001: Audit trail standard

## User story

As a user, I want state-changing operations to be auditable, so I know when memory, proposals, sessions, and retention operations changed local state.

## Audit record

```json
{
  "id": "audit_...",
  "timestamp": "ISO timestamp",
  "actor": "user|agent|hook|runtime",
  "agentId": "claude-code",
  "operation": "proposal.create",
  "targetType": "proposal",
  "targetId": "proposal_...",
  "summary": "Created pending memory proposal",
  "metadata": {}
}
```

## Operations to audit

1. Memory create/update/delete
2. Proposal create/approve/reject
3. Failure capture/promote
4. Episode create/update
5. Session compact/prune
6. Import/export
7. Agent registry changes
8. Runtime remote mode changes

## Acceptance criteria

1. Audit log is append-only
2. Audit entries do not store secrets
3. Audit log can be searched
4. Audit log can be exported
5. Retention operations are audited

---

# Implementation note

Improve plain local search and structured indexing before considering embeddings. Agent Kernel should first become excellent at retrieving its own local JSON, Failure Lessons, episodes, sessions, files, commands, and commit links.
