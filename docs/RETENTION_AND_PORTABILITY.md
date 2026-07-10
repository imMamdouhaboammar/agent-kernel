# Retention, portability, and local reporting

Agent Kernel keeps approved memory and Failure Lessons separate from raw runtime observations. Retention commands target raw session evidence only unless the user explicitly chooses a replacement import.

## Retention status

```bash
agent-kernel retention status
agent-kernel retention status --older-than 30d --json
```

Default policy:

```json
{
  "runtimeRetentionDays": 30,
  "keepFailureEvidence": true,
  "keepApprovedMemoryForever": true,
  "autoPruneRawObservations": false
}
```

These fields may be added to `~/.agent-kernel/config.json`.

## Prune raw observations

Always preview first:

```bash
agent-kernel retention prune --older-than 30d --dry-run
```

Apply the reviewed plan:

```bash
agent-kernel retention prune --older-than 30d --force
```

Prune behavior:

- Removes eligible `runtime/sessions/*.jsonl` files
- Preserves session metadata and compact summaries
- Preserves approved memory and policies
- Preserves Failure Lessons by default
- Writes an audit record for dry-run and actual prune operations

## Compact a session

```bash
agent-kernel session compact <session-id> --dry-run
agent-kernel session compact <session-id>
```

Compaction is deterministic and local. It records the main task, touched files, commands, failures, and linked evidence in the session JSON. It does not remove the raw log and does not create approved memory.

## Export

```bash
agent-kernel export ./agent-kernel-backup.json
agent-kernel export ./approved-memory.json --scope approved
agent-kernel export ./full-backup.json --redact --include-observations
```

Exports include:

- `schemaVersion`
- Agent Kernel version
- Export timestamp
- Scope and redaction mode
- Memory buckets and policies
- Optional runtime sessions and observations
- Local registries and commit links where applicable

Secrets and sensitive keys are redacted by default. Runtime PID files and temporary cache files are excluded.

## Import inspection

```bash
agent-kernel import ./agent-kernel-backup.json --inspect
```

Inspection validates the format and schema version and reports record counts and conflicts without writing local state.

## Review-first import

```bash
agent-kernel import ./agent-kernel-backup.json
agent-kernel import ./agent-kernel-backup.json --to inbox
```

Default imports create pending proposals in the inbox. They do not write approved memory. Repeated imports report conflicts and skip duplicates.

Review with:

```bash
agent-kernel inbox
agent-kernel approve <proposal-id> --publish
agent-kernel reject <proposal-id>
```

## Explicit replacement

```bash
agent-kernel import ./agent-kernel-backup.json --replace
```

Replacement is intentionally explicit. Agent Kernel creates a local backup under:

```text
~/.agent-kernel/imports/backups/
```

Use replacement only when restoring a trusted export after inspection.

## Terminal view

```bash
agent-kernel view
agent-kernel view sessions
agent-kernel view failures
agent-kernel view inbox
agent-kernel view agents
```

The default view shows approved-memory count, pending proposals, recent failures, recent sessions, runtime state, file hotspots, and suggested next commands.

## Static HTML report

```bash
agent-kernel report ./agent-kernel-report.html
```

The report is a single static HTML file with inline CSS. It contains no external assets, scripts, or network requests. It includes a generated timestamp and Agent Kernel version.

## Audit trail

Prune, compaction, export, import, and report operations append redacted JSONL records to:

```text
~/.agent-kernel/logs/audit.jsonl
```

Audit records include operation, actor or agent where available, target type, target ID, timestamp, and a compact summary.

## Safety rules

- Preview prune operations before using `--force`
- Inspect imports before replacement
- Default import goes to the pending inbox
- Keep approved memory and Failure Lessons outside raw-observation retention
- Treat exports as sensitive local files even after redaction
- Do not commit `.agent-kernel/project.json`, exports, or reports when they contain local project metadata unless reviewed
