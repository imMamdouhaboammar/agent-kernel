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

A record URI is a virtual identifier. It is never converted directly into a filesystem path.

Examples:

```text
ak://global/memory/no-secrets-in-code
ak://global/failures/contextfs-file-locality
```

## Commands

### Browse the virtual tree

```bash
agent-kernel context tree ak:// --json
agent-kernel context tree ak://global/ --depth 2 --json
agent-kernel context tree ak://global/memory/ --json
```

### Progressive record reads

```bash
agent-kernel context read ak://global/memory/no-secrets-in-code --level 0 --json
agent-kernel context read ak://global/memory/no-secrets-in-code --level 1 --json
agent-kernel context read ak://global/memory/no-secrets-in-code --level 2 --json
```

The levels are:

- L0: compact abstract for orientation and initial candidate selection
- L1: structured overview with metadata useful for planning and reranking
- L2: authoritative underlying record, sanitized before output

L2 is opt-in. Hierarchical retrieval does not load L2 by default.

### Hierarchical retrieval

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

The phase 1 retriever is deterministic and local.

It uses existing record signals such as:

- query phrase and term matches
- project identity
- file locality
- repeated failure occurrences
- collection boundaries

The retriever scores collections before descending into matching records. The strongest selected record may be promoted to L1. Other selected records begin at L0. Budget accounting can downgrade or skip a candidate instead of exceeding the requested budget.

`--trace` exposes collection and candidate decisions, scores, levels, and scoring signals. It is intended for debugging and evaluation rather than hidden model state.

## Used-context evidence

An agent can record that a specific ContextFS record was used during a session:

```bash
agent-kernel context used <session-id> \
  ak://global/failures/contextfs-file-locality \
  --reason "pre-edit context check" \
  --result helpful \
  --json
```

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
3. Carries used-context URIs as provenance
4. Normalizes and hashes candidate text
5. Deduplicates against approved memory and existing pending proposals
6. Calls the existing core proposal workflow for novel candidates
7. Writes session commit metadata to:

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
- NUL bytes
- query strings and fragments
- credential-like URI syntax
- empty path segments

Session IDs are validated before session file lookup.

Output projections sanitize known secret patterns and secret-shaped keys before exposing L2 details.

Retrieval limits candidate counts and context budgets. Phase 1 does not execute commands, resolve arbitrary filesystem paths, call a network service, or invoke an LLM.

Session commit writes only session commit metadata and pending proposals. Approved memory remains outside that write path.

## Clean-room and licensing boundary

ContextFS was designed after studying public context-engineering concepts, including virtual context namespaces, progressive context loading, retrieval traces, and session memory diffs.

OpenViking's core repository is licensed under AGPL-3.0. Agent Kernel is MIT licensed.

Agent Kernel therefore uses an independent clean-room implementation. No OpenViking source code, internal schemas, tests, constants, or implementation-specific algorithms are copied into ContextFS.

The shared ideas are architectural patterns, not source compatibility.

## Optional future work

The current implementation intentionally does not require semantic infrastructure.

Possible future adapters include:

- optional embeddings
- optional vector or semantic reranking
- richer relation expansion
- project-specific virtual projections
- bounded MCP ContextFS tools
- retrieval evaluation fixtures comparing flat and hierarchical strategies

Any future semantic adapter should remain optional so the local deterministic path continues to work without it.

## Removal and rollback

ContextFS is a projection layer.

Removing the routed ContextFS helpers and their router entries does not require migrating approved memory, Failure Lessons, episodes, sessions, or commit links.

Session commit metadata files can be removed independently after review. Pending proposals should use the normal approve or reject workflow so the audit trail remains explicit.
