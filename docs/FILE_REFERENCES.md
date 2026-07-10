# File references

Agent Kernel records can include an optional top-level `files` array.

```json
{
  "files": [
    "src/cli.mjs",
    "test/smoke.mjs"
  ]
}
```

The field is optional. Existing memories, Failure Lessons, episodes, session observations, and future commit records remain valid without it.

## Commands

```bash
agent-kernel remember "Use focused patches" --files src/cli.mjs
agent-kernel propose --text "Keep tests beside changes" --reason "Project rule" --files test/smoke.mjs
agent-kernel failure capture --from codex --text "Failure output" --files src/cli.mjs
agent-kernel episode add --title "CLI decision" --text "..." --files src/cli.mjs
agent-kernel session observe <session-id> --type file_edit --text "..." --files src/cli.mjs
```

Both `--file` and `--files` are accepted. Comma-separated values are supported.

## Normalization

Paths inside the current Git project are stored relative to the project root with forward slashes. Absolute and relative references to the same file are deduplicated.

```bash
agent-kernel remember "..." \
  --files /workspace/project/src/cli.mjs,./src/cli.mjs
```

Stored result:

```json
{
  "files": ["src/cli.mjs"]
}
```

Paths outside the project remain absolute because converting them to project-relative values would be misleading.

## File filters

File-only filters work without a text query:

```bash
agent-kernel memory search --files src/cli.mjs --json
agent-kernel failure search --files src/cli.mjs --json
agent-kernel episode search --files src/cli.mjs --json
agent-kernel session observations <session-id> --files src/cli.mjs --json
```

Filters use first-class file references. Legacy records without `files` remain readable and valid but do not match a file-only filter.

## Failure promotion

When a Failure Lesson with file references is promoted to a pending memory proposal, its `files` array is copied to the proposal. Approval remains user-controlled.

## Compile output

```bash
agent-kernel compile --files src/cli.mjs --budget 1200
```

The normal compilation still runs. File-specific notes are written separately to:

```text
~/.agent-kernel/dist/file-context.md
```

This avoids inserting temporary file context into the shared constitution.

## Schemas

The local schema directory describes `files` as an optional array for:

- memory records
- proposals
- episodes
- Failure Lessons
- session observations
- commit records

No schema requires `files`, preserving compatibility with older local data.

## Security

Episode capture with file references follows the same archive redaction rules as normal episode capture. File metadata does not bypass secret filtering.
