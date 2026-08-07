# ContextFS and Hierarchical Retrieval Design

## Status

Approved for implementation on `feat/contextfs-hierarchical-retrieval`.

## Goal

Add a local-first virtual context namespace and hierarchical retrieval path to Agent Kernel so coding agents can discover the smallest relevant context before acting, while preserving existing review-first memory governance, zero required runtime dependencies, and MIT licensing.

## Design constraints

- Clean-room implementation inspired by public architectural ideas only. Do not copy OpenViking source code, tests, constants, schemas, or implementation details.
- Preserve Agent Kernel's MIT license and existing local-first product boundary.
- No required vector database, embeddings service, cloud service, daemon, or LLM for the base feature.
- Existing approved memory, Failure Lessons, episodes, sessions, policies, skills, architecture records, commits, and project identity remain authoritative.
- Existing storage formats remain authoritative in phase 1. ContextFS is a projection, not a migration.
- Pending proposals may be visible only when explicitly requested and must always be marked unapproved.
- Rejected proposals must never appear in retrieval results.
- Durable memory mutation remains review-first. Session commit may create proposals, never auto-approve them.
- Every retrieval result must be explainable with scores, scope, level, and trajectory when `--trace` or `--explain` is requested.
- URI parsing must reject traversal, encoded traversal, ambiguous empty segments, backslashes, NUL bytes, and unsupported authorities.
- Context reads are read-only in phase 1.
- Node.js `>=18.18.0` compatibility is mandatory.

## Product boundary

ContextFS is not a new physical filesystem. It is a stable virtual namespace over Agent Kernel's existing stores.

The initial namespace is:

```text
ak://
  projects/
    <project-id>/
      memory/
      failures/
      episodes/
      sessions/
      files/
      architecture/
      commits/
  agents/
  skills/
  policies/
  global/
```

Only nodes backed by existing validated Agent Kernel records are materialized.

## URI contract

Canonical form:

```text
ak://projects/<project-id>/<collection>/<record-id>
```

Rules:

1. Scheme must be exactly `ak:`.
2. Authority is not used. `ak://projects/...` is parsed as a scheme plus hierarchical path, not a remote host.
3. Canonical separators are `/` on every platform.
4. Backslashes are rejected rather than normalized.
5. Percent-decoding occurs before segment validation.
6. `.` and `..` segments are rejected, including encoded variants.
7. Empty interior segments are rejected.
8. NUL bytes and control characters are rejected.
9. Canonical output never includes a trailing slash except the root `ak://`.
10. URI parsing never resolves a host filesystem path directly.

The implementation should use WHATWG `URL` only where its semantics are helpful, but the public contract is enforced by Agent Kernel's own parser. `path.posix` is used for deterministic slash semantics. Filesystem access is performed only after a context node has resolved through known Agent Kernel stores.

## Context node model

Each projected record exposes:

```json
{
  "uri": "ak://projects/example/failures/failure_123",
  "type": "failure",
  "projectId": "example",
  "source": "source/failures/failure-lessons.json",
  "status": "approved",
  "level": "L0",
  "abstract": "Short deterministic relevance description",
  "overview": {
    "title": "...",
    "summary": "...",
    "files": [],
    "commands": [],
    "tags": [],
    "updatedAt": null
  },
  "relations": [],
  "provenance": {}
}
```

### L0

A compact deterministic relevance card, normally one sentence and key identifiers. It must be generated without an LLM.

### L1

A structured deterministic overview containing the record's most useful planning fields, provenance, linked files, commands, commits, tags, status, timestamps, and relation summaries.

### L2

The authoritative original record. L2 is read only when explicitly requested or when a retrieval budget allows promotion of a final candidate.

No L0 or L1 representation becomes a new source of truth.

## Projection sources

Phase 1 projects the following existing stores:

- approved memory
- Failure Lessons
- episodes
- session metadata and compact summaries
- commit links
- architecture policies, contracts, and reports that already have stable local identifiers
- skills metadata
- policy metadata

Raw session observations are excluded from default retrieval. They may be included only with an explicit flag in a later phase.

## Hierarchical retrieval

The retrieval pipeline is deterministic and local:

```text
query
  -> resolve project and optional file scope
  -> select candidate collections
  -> score collection summaries
  -> descend into top collections
  -> score L0 records
  -> promote strongest candidates to L1
  -> relation expansion with bounded fan-out
  -> apply token/character budget
  -> optionally load L2 for final candidates
```

### Scope signals

Strong signals:

- exact project match
- exact or partial file reference
- exact command reference
- exact error signature
- exact record ID or URI

Secondary signals:

- title/body token match
- tags
- agent identity
- commit reference
- recency for sessions and episodes
- approved status
- repeated failure occurrence

Existing search scoring should be reused where practical rather than creating a second incompatible scoring vocabulary.

### Directory scoring

Directory scores are aggregate signals derived from children and direct scope matches. No embedding is required.

The initial algorithm:

1. Generate a query token set using the current structured-search tokenization behavior.
2. Score direct collection matches from query intent and scope.
3. For each collection, compute the maximum child score plus a small density bonus for multiple matching children.
4. Descend into the highest scoring collections until the candidate or budget limit is reached.
5. Preserve every decision in the trace.

No copied OpenViking constants or heuristics are used.

## Retrieval trace

With `--trace` or `--explain`, return:

```json
{
  "query": "restore conflict",
  "scope": {
    "projectId": "agent-kernel",
    "files": ["src/env-vault/storage.mjs"]
  },
  "trajectory": [
    {
      "uri": "ak://projects/agent-kernel/failures",
      "decision": "descend",
      "score": 21,
      "signals": ["file-scope", "query-match"]
    }
  ],
  "results": [],
  "budget": {
    "requested": 1800,
    "used": 0
  }
}
```

Trace output must not expose secret values or raw environment-file content.

## Relations and provenance

Relations are typed links between known records. Phase 1 derives relations rather than introducing a graph database.

Supported initial relation types:

- `references-file`
- `observed-in-session`
- `resolved-by-commit`
- `linked-failure`
- `linked-episode`
- `governed-by-policy`
- `owned-by-project`

Relation expansion is bounded and cannot cross project scope unless the target is explicitly global.

Provenance should include only stable local identifiers and known metadata. Sensitive values remain redacted by existing sanitizers.

## CLI

Phase 1 adds:

```bash
agent-kernel context tree [ak://...] [--depth N] [--json]
agent-kernel context read <ak://...> [--level L0|L1|L2] [--json]
agent-kernel context find <query> [--project <path>] [--project-id <id>] [--file <path>] [--budget N] [--limit N] [--trace] [--json]
```

Existing broker commands under `agent-kernel context enter|current|verify|doctor|switch` remain unchanged. The public router dispatches the new `tree|read|find` subcommands to a focused ContextFS executable.

## Session usage tracking

Add:

```bash
agent-kernel session used <session-id> --context <ak://...> [--reason <text>] [--result helpful|neutral|unhelpful]
```

Usage records are append-only session observations with a dedicated `context_used` type. They contain URI, level if known, reason, result, timestamp, session ID, agent ID, and project ID.

Usage tracking does not mutate ranking in phase 1. The data is collected first so later ranking changes can be evidence-based.

## Session commit

Add a review-first command:

```bash
agent-kernel session commit <session-id> [--dry-run] [--json]
```

Phase 1 behavior:

1. Read the completed or active session and observations.
2. Produce a deterministic compact summary using existing compaction logic where practical.
3. Generate candidate durable-memory proposals from explicit durable signals only, such as manual notes marked for retention, repeated verified failures, and existing proposal-worthy records.
4. Deduplicate candidates against approved memory using deterministic normalized-text and stable-reference checks.
5. Write a session archive under the Agent Kernel home with a proposal diff describing candidate adds and skipped duplicates.
6. On non-dry-run, create pending inbox proposals only.
7. Never update or delete approved memory automatically.

Phase 1 intentionally does not use an LLM for memory extraction.

## Security model

Security requirements:

- URI input is untrusted.
- No URI segment may be converted directly into an arbitrary filesystem path.
- ContextFS only reads allowlisted Agent Kernel stores.
- Symlinks in project-local architecture files remain subject to existing project safety rules.
- `--project` must resolve through the existing project identity model.
- Secret redaction applies to L0, L1, L2 CLI output, traces, archives, and proposal diffs.
- Unknown record types fail closed.
- Unknown URI schemes fail closed.
- Malformed or corrupted source records are isolated rather than causing silent data replacement.
- New MCP tools, if added later, default to read-only context operations.

## Backward compatibility

- Existing `search`, `file-context`, `context` broker subcommands, MCP tools, hooks, and storage files keep their current behavior.
- ContextFS is additive.
- No existing JSON schema is rewritten in phase 1.
- No install-time service is added.

## Testing

Required focused tests:

1. URI canonicalization and traversal rejection, including percent-encoded traversal.
2. Context tree projection from isolated Agent Kernel homes.
3. L0/L1/L2 read behavior and source-of-truth preservation.
4. Hierarchical retrieval ordering, scope handling, budget enforcement, and trace shape.
5. Rejected proposal exclusion and pending proposal labeling where applicable.
6. Secret redaction in every output level and trace.
7. Router compatibility with existing broker `context` subcommands.
8. Session `used` observation capture.
9. Session commit dry-run and pending-only mutation behavior.
10. Cross-platform path behavior under Node.js 18, 20, 22, and 24 CI.

## Initial delivery scope

The first merged increment includes:

- `ak://` parser and formatter
- virtual projection for memory, failures, episodes, sessions, commits, skills, policies, and project architecture metadata where stable IDs exist
- `context tree`
- `context read`
- deterministic hierarchical `context find`
- retrieval trace
- `session used`
- deterministic review-first `session commit`
- focused tests and docs

MCP context tools, hook auto-injection, ranking based on usage history, semantic embeddings, and LLM extraction remain follow-up work unless implementation proves they are required for correctness.