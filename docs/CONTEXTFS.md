# ContextFS

ContextFS is Agent Kernel's local virtual context namespace for coding agents.

It projects existing Agent Kernel records behind stable `ak://` URIs so an agent can browse compact context, retrieve relevant records hierarchically, record which context it used, and propose durable lessons after a session without changing the underlying governance model.

ContextFS does not replace the existing JSON and JSONL stores. Those stores remain authoritative.

## Design goals

- Keep context retrieval local and deterministic
- Preserve Agent Kernel's review-first memory workflow
- Reduce unnecessary context volume with progressive reads
- Make retrieval decisions inspectable
- Keep project and file locality explicit
- Add no required vector database, embeddings, LLM, daemon, cloud service, or runtime dependency
- Preserve the MIT licensing boundary through an independent clean-room implementation

## Virtual namespace

The public namespace starts at:

```text
ak://
```

Current root collections are:

```text
ak://projects/
ak://global/
ak://agents/
ak://skills/
ak://policies/
```

Global collections currently project:

```text
ak://global/memory/
ak://global/failures/
ak://global/episodes/
ak://global/sessions/
ak://global/commits/
```

Known projects are also materialized as scoped trees:

```text
ak://projects/<project-id>/
  memory/
  failures/
  episodes/
  sessions/
  files/
  architecture/
  commits/
```

Project collections only expose records whose existing project metadata matches the selected project. `files/` is a derived virtual collection built from validated file references already present on project records. It does not read arbitrary repository files.

The `architecture/` directory is reserved in the project tree but phase 1 does not project arbitrary architecture files into ContextFS. This avoids turning a virtual URI into an uncontrolled filesystem read surface.

A record URI is a virtual identifier. It is never converted directly into a filesystem path.

Examples:

```text
ak://global/memory/no-secrets-in-code
ak://global/failures/contextfs-file-locality
ak://projects/my-project/failures/failure-123
ak://projects/my-project/files/file_0123456789abcdef
```

## Commands

### Browse the virtual tree

```bash
agent-kernel context tree ak:// --json
agent-kernel context tree ak://global/ --depth 2 --json
agent-kernel context tree ak://global/memory/ --json
agent-kernel context tree ak://projects/ --json
agent-kernel context tree ak://projects/my-project/ --json
agent-kernel context tree ak://projects/my-project/failures/ --json
```

### Progressive record reads

```bash
agent-kernel context read ak://global/memory/no-secrets-in-code --level 0 --json
agent-kernel context read ak://global/memory/no-secrets-in-code --level 1 --json
agent-kernel context read ak://global/memory/no-secrets-in-code --level 2 --json
agent-kernel context read ak://projects/my-project/failures/failure-123 --level 1 --json
```

The levels are:

- L0: compact abstract for orientation and initial candidate selection
- L1: structured overview with metadata useful for planning and reranking
- L2: authoritative underlying record, sanitized before output

L2 is opt-in. Hierarchical retrieval does not load L2 by default.

Project record projections also expose bounded typed relations such as:

- `owned-by-project`
- `references-file`
- `referenced-by` for derived file records

Relations use other `ak://` URIs. They do not contain raw physical filesystem targets.

### Hierarchical retrieval

Global retrieval can retain global URIs while using project and file metadata as ranking signals:

```bash
agent-kernel context find "restore conflict" \
  --under ak://global/ \
  --project-id my-project \
  --file src/env-vault/engine.mjs \
  --budget 1200 \
  --limit 8 \
  --trace \
  --json
```

Project-scoped retrieval stays inside one project hierarchy:

```bash
agent-kernel context find "restore conflict" \
  --under ak://projects/my-project/ \
  --file src/env-vault/engine.mjs \
  --budget 1200 \
  --limit 8 \
  --trace \
  --json
```

A registered project path can also resolve the existing project identity without creating a new identity:

```bash
agent-kernel context find "restore conflict" \
  --project /path/to/registered/project \
  --budget 1200 \
  --json
```

If `--under`, `--project-id`, and `--project` resolve to contradictory project identities, retrieval fails with a project-scope mismatch instead of silently choosing one.

The phase 1 retriever is deterministic and local.

It uses existing record signals such as:

- query phrase and term matches
- exact project scope
- explicit file locality
- repeated failure occurrences
- collection boundaries
- bounded same-file relation expansion inside a project

Lexical relevance, project identity, and file locality are scored as separate signals. Project metadata is not treated as query text.

The retriever scores collections before descending into matching records. The strongest selected record may be promoted to L1. Other selected records begin at L0. Budget accounting can downgrade or skip a candidate instead of exceeding the requested budget.

For project retrieval, the strongest direct result may expand to a small number of same-project records that reference the same file. Relation expansion is bounded and appears explicitly as `stage: "relation"` in the retrieval trace.

`--trace` exposes collection, candidate, relation, score, level, inclusion, and budget decisions. It is intended for debugging and evaluation rather than hidden model state.

## Used-context evidence

An agent can record that a specific ContextFS record was used during a session:

```bash
agent-kernel context used <session-id> \
  ak://global/failures/contextfs-file-locality \
  --reason "pre-edit context check" \
  --result helpful \
  --json
```

Project record URIs can be recorded the same way.

This appends a `context_used` observation to the existing session JSONL and updates the session observation count.

Used-context evidence is not durable memory. It does not create, approve, publish, or modify an approved rule.

## Review-first session commit

A completed or active session can be inspected for stable candidate lessons:

```bash
agent-kernel context commit <session-id> --dry-run --json
```

Dry-run returns a deterministic diff shape:

```json
{
  "adds": [],
  "updates": [],
  "deletes": []
}
```

Phase 1 can emit pending adds only. It does not perform automatic updates or deletes.

To materialize novel candidates into the existing approval inbox:

```bash
agent-kernel context commit <session-id> --json
```

The command:

1. Reads the session record and JSONL observations
2. Extracts bounded candidate text from session summaries and failure observations
3. Redacts known credential patterns before candidate projection, dry-run output, metadata, or proposal creation
4. Carries used-context URIs as provenance
5. Normalizes and hashes candidate text
6. Deduplicates against approved memory and existing pending proposals
7. Calls the existing core proposal workflow for novel candidates
8. Writes session commit metadata to:

```text
${AGENT_KERNEL_HOME:-~/.agent-kernel}/runtime/sessions/<session-id>.context-commit.json
```

A repeated commit for the same session is idempotent and does not duplicate pending proposals.

The command never approves or publishes memory.

Review remains explicit:

```bash
agent-kernel inbox
agent-kernel approve <proposal-id> --publish
# or
agent-kernel reject <proposal-id>
```

## Authoritative stores

ContextFS projects existing stores rather than migrating them.

Examples:

```text
~/.agent-kernel/source/memories/*.json
~/.agent-kernel/source/failures/failure-lessons.json
~/.agent-kernel/source/projects/projects.json
~/.agent-kernel/episodes/archive/*.json
~/.agent-kernel/runtime/sessions/*.json
~/.agent-kernel/runtime/sessions/*.jsonl
~/.agent-kernel/runtime/commits/index.json
~/.agent-kernel/inbox/pending/*.json
```

The virtual URI tree can be removed or replaced without rewriting these source records.

## Security boundaries

ContextFS treats URIs and session IDs as identifiers, not paths.

URI parsing rejects:

- foreign schemes such as `file://` and `https://`
- `..` and encoded dot-segments
- backslashes
- encoded path separators
- NUL bytes and control characters
- query strings and fragments
- credential-like URI syntax
- empty path segments

Session IDs are validated before session file lookup.

Output projections sanitize known secret patterns and secret-shaped keys before exposing L2 details.

Session commit also redacts known secret patterns before creating candidate text. This applies to dry-run output, persisted context-commit metadata, and pending proposals.

Project-path resolution uses the existing project registry. `--project` only resolves an existing identity and does not create or mutate a project record.

Derived file nodes come only from file references already stored on project records. ContextFS does not open the referenced path merely because an `ak://projects/.../files/...` URI exists.

Retrieval limits result counts, relation fan-out, and context budgets. Phase 1 does not execute commands, resolve arbitrary filesystem paths from URIs, call a network service, or invoke an LLM.

Session commit writes only session commit metadata and pending proposals. Approved memory remains outside that write path.

## Clean-room and licensing boundary

ContextFS was designed after studying public context-engineering concepts, including virtual context namespaces, progressive context loading, retrieval traces, relations, and session memory diffs.

OpenViking's core repository is licensed under AGPL-3.0. Agent Kernel is MIT licensed.

Agent Kernel therefore uses an independent clean-room implementation. No OpenViking source code, internal schemas, tests, constants, or implementation-specific algorithms are copied into ContextFS.

The shared ideas are architectural patterns, not source compatibility.

## Optional future work

The current implementation intentionally does not require semantic infrastructure.

Possible future adapters include:

- optional embeddings
- optional vector or semantic reranking
- richer typed relation expansion beyond bounded project/file evidence
- bounded MCP ContextFS tools
- retrieval evaluation fixtures comparing flat and hierarchical strategies
- controlled architecture record projection from known validated architecture stores

Any future semantic adapter should remain optional so the local deterministic path continues to work without it.

## Removal and rollback

ContextFS is a projection layer.

Removing the routed ContextFS helpers and their router entries does not require migrating approved memory, Failure Lessons, episodes, sessions, project registry entries, or commit links.

Session commit metadata files can be removed independently after review. Pending proposals should use the normal approve or reject workflow so the audit trail remains explicit.