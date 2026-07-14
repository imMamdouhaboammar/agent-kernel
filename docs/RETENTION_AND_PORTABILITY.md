# Retention, portability, and local reporting

Agent Kernel keeps approved memory, policies, Failure Lessons, episodes, session metadata, and raw runtime observations in separate local stores. The commands in this guide make cleanup and transfer explicit, reviewable, and local-first.

## Retention status

```bash
agent-kernel retention status
agent-kernel retention status --older-than 30d --json
```

The command reports:

- configured retention period
- raw session log count
- eligible log count and byte total
- malformed JSONL line count
- whether approved memory and Failure Lessons are protected

Default policy:

```json
{
  "runtimeRetentionDays": 30,
  "keepFailureEvidence": true,
  "keepApprovedMemoryForever": true,
  "autoPruneRawObservations": false
}
```

These fields may be added to `~/.agent-kernel/config.json`. Missing or invalid retention values fall back to 30 days.

## Prune raw observations

Preview the plan first:

```bash
agent-kernel retention prune --older-than 30d --dry-run
```

Apply the reviewed plan explicitly:

```bash
agent-kernel retention prune --older-than 30d --force
```

Prune behavior:

- removes eligible `runtime/sessions/*.jsonl` files only
- preserves session JSON metadata and compact summaries
- records pruned observation and malformed-line counts on session metadata
- preserves approved memory, policies, and Failure Lessons
- writes redacted audit records for preview and execution

## Compact a session

```bash
agent-kernel session compact <session-id> --dry-run --json
agent-kernel session compact <session-id> --json
```

Compaction is deterministic for the same stored session and observations. It summarizes the main task, outcome, files, commands, failures, malformed lines, and linked evidence. It does not remove the raw log and does not create or approve durable memory.

Session IDs are validated before file access.

## Export

```bash
agent-kernel export ./agent-kernel-backup.json
agent-kernel export ./approved-memory.json --scope approved
agent-kernel export ./full-backup.json --redact --include-observations
```

Exports contain a versioned schema, Agent Kernel version, timestamp, scope, redaction mode, and selected local data.

A normal full-scope export includes:

- memory buckets and policies
- Failure Lessons and episodes
- agent and project registries
- session metadata
- commit links

Raw observations are included only with `--include-observations`. Approved-scope exports omit runtime sessions, observations, Failure Lessons, episodes, and commit history.

Secrets and sensitive keys are redacted by default. Runtime PID files and temporary cache files are excluded. Treat the export as a sensitive local artifact even after redaction.

## Import inspection

```bash
agent-kernel import ./agent-kernel-backup.json --inspect --json
```

Inspection validates the format and schema version, checks every file-backed bucket and session identifier, and reports record counts and conflicts without writing local state.

Invalid bucket names such as path components or traversal sequences are rejected before a replacement backup or write begins.

## Review-first import

```bash
agent-kernel import ./agent-kernel-backup.json
agent-kernel import ./agent-kernel-backup.json --to inbox
```

Default imports create pending inbox proposals. They do not write approved memory. Existing approved records and pending proposals are checked for ID or text conflicts. Repeated imports skip conflicts instead of overwriting local state.

Review with:

```bash
agent-kernel inbox
agent-kernel approve <proposal-id> --publish
agent-kernel reject <proposal-id>
```

Imported policy packs also become pending critical proposals. They are never silently activated.

## Explicit replacement

```bash
agent-kernel import ./agent-kernel-backup.json --replace
```

Replacement is intended for a trusted export that has already passed inspection. Before replacing managed state, Agent Kernel creates a timestamped local backup under:

```text
~/.agent-kernel/imports/backups/
```

The backup includes existing memory buckets, policies, Failure Lessons, registries, episodes, session files, raw observation logs, and commit links when present.

Replacement restores the corresponding content present in the export:

- memory buckets
- policies and Failure Lessons
- agent and project registries
- episodes
- session metadata
- exported raw observations
- commit links

Managed memory, episode, and session files are replaced as a set so stale records do not survive a restore. Data omitted from the export cannot be recreated. Include observations during export when a full runtime restore is required.

`--replace` cannot be combined with `--inspect` or `--to`.

## Terminal view

```bash
agent-kernel view
agent-kernel view sessions
agent-kernel view failures
agent-kernel view inbox
agent-kernel view agents
agent-kernel view --json
```

The default view reports approved-memory count, pending proposals, recent Failure Lessons, recent sessions, runtime state, file hotspots, and suggested next commands. Unknown sections fail with a non-zero exit code instead of silently showing the summary.

## Static HTML report

```bash
agent-kernel report ./agent-kernel-report.html
```

The report is one static HTML file with inline CSS. It contains no scripts, external assets, or network requests. Stored content is redacted and HTML-escaped before rendering.

## Audit trail

Compaction, prune previews, prune execution, export, import, replacement, and report generation append redacted JSONL records to:

```text
~/.agent-kernel/logs/audit.jsonl
```

Audit records include operation, actor or agent where available, target type, target ID, timestamp, and compact metadata.

## Safety rules

- preview prune operations before using `--force`
- inspect imports before replacement
- use review-first inbox imports for untrusted or shared exports
- keep approved memory and Failure Lessons outside raw-observation retention
- include observations explicitly when a complete runtime restore is needed
- do not commit exports or reports containing local project metadata without review
