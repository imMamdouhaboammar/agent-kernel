# Structured local search

Agent Kernel provides a dependency-free search layer across local memories, Failure Lessons, episodes, and session records.

The source JSON and JSONL files remain the source of truth. Index files are disposable and can be rebuilt at any time.

## Rebuild indexes

```bash
agent-kernel reindex
```

Indexes are written to:

```text
~/.agent-kernel/index/
  memory-index.json
  failure-index.json
  episode-index.json
  session-index.json
```

Each file contains normalized search records, a build timestamp, a record count, and an index format version.

## Search

```bash
agent-kernel search "ERR_MODULE_NOT_FOUND"
agent-kernel search "safe-link duplicate block" --type failure
agent-kernel search "src/cli.mjs" --files
agent-kernel search "npm test" --commands
agent-kernel search "memory workflow" --json
```

Supported type filters:

- `memory`
- `failure`
- `episode`
- `session`

`--files` restricts matching to first-class file references. `--commands` restricts matching to recorded commands.

## Ranking

Results are ranked with a small deterministic text scorer:

- explicit file matches receive the highest weight
- command matches receive a higher weight than general body text
- general title, text, tags, project, and agent fields remain searchable
- updated time breaks equal-score ties

No embeddings, vector database, daemon, or external search service is required.

## Missing and corrupted indexes

Search reads a valid index when available. If an index is missing or cannot be parsed, Agent Kernel reads the corresponding source records directly for that search.

A damaged index does not modify, replace, or repair source data automatically. Run `agent-kernel reindex` when you want fresh index files.

JSON output reports the source used for every record group:

```json
{
  "indexSources": {
    "memory": "index",
    "failure": "source-fallback-corrupt-index",
    "episode": "index",
    "session": "source-fallback-missing-index"
  }
}
```

This makes degraded search behavior visible instead of silently hiding index problems.
