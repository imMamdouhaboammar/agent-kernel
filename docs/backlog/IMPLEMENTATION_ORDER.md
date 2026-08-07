# Agent Kernel Backlog Implementation Order

## Goal

Turn the backlog into a practical build sequence that keeps Agent Kernel local, lightweight, and safe.

This file intentionally prioritizes small steps over a large rewrite. The runtime should grow as an optional layer around the existing CLI, not replace the current JSON-first architecture.

## Definition of done for the whole backlog

Agent Kernel succeeds if a user can do this:

```text
Start an optional local runtime.
Let Claude Code or Codex work on a repository.
Capture a failed command as local evidence.
Turn repeated failures into pending proposals.
Approve only the lessons that should last.
Before another agent touches the same file, retrieve the related approved rule and Failure Lesson.
Keep all of this local and review-first.
```

## MVP scope

The first useful version should include only:

1. Optional local daemon
2. Runtime health checks
3. Session model
4. Observation capture
5. Context endpoint
6. File context command
7. Session timeline
8. Claude hook integration for context and failure capture
9. No auto-approval
10. No vector database
11. No web dashboard
12. No required daemon on install

## Sprint 1: Runtime foundation

### Items

1. AK-LIVE-001: Optional local daemon
2. AK-LIVE-002: Runtime health and diagnostics
3. AK-LIVE-004: Observation endpoint
4. AK-SESSION-001: Session model
5. AK-SESSION-002: Observation capture

### Why first

These items create the smallest useful runtime loop:

```text
agent starts session
  -> sends observations
  -> Agent Kernel stores evidence locally
  -> user can inspect runtime status
```

### Hard constraints

1. Do not add external database
2. Do not add embeddings
3. Do not auto-start daemon
4. Do not add approval through runtime
5. Do not change existing compile/link behavior

### Validation

```bash
npm run build
npm test
npm run lint
npm run typecheck
agent-kernel daemon start
agent-kernel daemon status
agent-kernel session list
```

---

## Sprint 2: Context retrieval

### Items

1. AK-LIVE-003: Context endpoint
2. AK-FILE-001: File context command
3. AK-FILE-002: File references to core records
4. AK-SEARCH-001: Structured local search index
5. AK-SEARCH-002: Relevance scoring

### Why second

Capturing observations is not enough. Agents need useful context before repeating a mistake. File context should work both through CLI and runtime.

### Target loop

```text
agent is about to edit src/cli.mjs
  -> asks Agent Kernel for file context
  -> receives approved rules, related Failure Lessons, and recent episodes
  -> avoids repeating old mistake
```

### Hard constraints

1. File context must work without daemon mode
2. Search must work without embeddings
3. Pending proposals must be marked as pending
4. Rejected proposals must never appear
5. Budget limits must be respected

### Validation

```bash
agent-kernel file-context src/cli.mjs
agent-kernel search "safe-link" --debug
agent-kernel reindex
npm test
```

---

## Sprint 2.5: ContextFS hierarchical retrieval

### Delivered items

1. AK-CONTEXT-001: Clean-room `ak://` URI contract and traversal-safe canonicalization
2. AK-CONTEXT-002: Virtual ContextFS projection over existing Agent Kernel stores
3. AK-CONTEXT-003: Deterministic L0/L1/L2 progressive record projections
4. AK-RETRIEVE-001: Hierarchy-aware retrieval with project/file locality and context budgets
5. AK-TRACE-001: Explainable collection/candidate retrieval trace
6. AK-SESSION-004: Append-only `context_used` session evidence
7. AK-SESSION-005: Review-first deterministic session commit
8. AK-MEMORY-001: Normalized candidate hashing and approved/pending deduplication

### Delivered loop

```text
agent needs context
  -> browses or searches ak://
  -> receives L0/L1 context within budget
  -> records the exact ContextFS URI used
  -> session summary and failure evidence produce candidate lessons
  -> context commit deduplicates candidates
  -> novel candidates enter inbox/pending only
  -> user reviews before durable publication
```

### Delivered constraints

1. Existing JSON and JSONL stores remain authoritative
2. `ak://` never becomes a raw filesystem path
3. L2 is explicit and retrieval does not load it automatically
4. No vector database, embeddings, LLM, daemon, cloud service, or runtime dependency is required
5. Used-context evidence never creates durable memory
6. Session commit never auto-approves or publishes
7. Repeated session commit is idempotent
8. Clean-room implementation preserves the MIT licensing boundary

### Validation

```bash
agent-kernel context tree ak:// --json
agent-kernel context read ak://global/memory/<id> --level 1 --json
agent-kernel context find "query" --under ak://global/ --trace --json
agent-kernel context used <session-id> ak://global/memory/<id> --json
agent-kernel context commit <session-id> --dry-run --json
npm test
```

### Optional future work

These items are explicitly optional adapters, not default-path requirements:

1. AK-RETRIEVE-002: Optional semantic reranker
2. AK-RETRIEVE-003: Optional embeddings provider
3. AK-RETRIEVE-004: Optional vector index adapter
4. AK-RELATION-001: Richer bounded relation expansion
5. AK-MCP-005: Bounded ContextFS MCP tools
6. AK-EVAL-001: Flat-vs-hierarchical retrieval benchmark fixtures
7. AK-HOOK-001: Pre-task ContextFS retrieval adapters for supported coding agents

Any semantic implementation must preserve a fully functional deterministic local path.

---

## Sprint 3: Hooks and live injection

### Items

1. AK-FILE-003: File context hook adapter
2. AK-INTEGRATION-001: Claude Code integration guide
3. AK-INTEGRATION-002: OpenCode integration guide
4. AK-INTEGRATION-003: Codex and Cursor integration guide updates
5. AK-MCP-002: MCP context tools

### Why third

Once context retrieval is reliable, integrations can call it. Hooks should be thin adapters. They should not own memory decisions.

### Target loop

```text
Claude Code PreToolUse
  -> detect file or command
  -> request Agent Kernel context
  -> inject compact local context
  -> continue safely
```

### Hard constraints

1. Hooks fail open unless strict guard mode blocks the command
2. Hooks have short timeouts
3. Hooks never approve or publish memory
4. Hook output is compact
5. All integration docs include rollback steps

### Validation

```bash
agent-kernel-safe-git-hook . --dry-run
agent-kernel mcp config claude
agent-kernel doctor --agents
npm test
```

---

## Sprint 4: Session timeline and commit links

### Items

1. AK-SESSION-003: Session timeline
2. AK-COMMIT-001: Commit link command
3. AK-COMMIT-002: Optional post-commit helper
4. AK-PATTERN-001: Recurring failure detection
5. AK-PATTERN-002: Pattern to proposal

### Why fourth

At this point Agent Kernel has enough local evidence to connect work history, failures, and commits. This makes the memory useful for PR review, debugging, and repeated-error prevention.

### Target loop

```text
command fails
  -> failure is captured
  -> session timeline shows the path to failure
  -> commit links preserve work evidence
  -> recurring pattern becomes pending proposal
```

### Hard constraints

1. Commit linking must work offline
2. Post-commit helper is opt-in
3. Pattern detection must work without LLM
4. Pattern proposal creates pending inbox item only
5. Repeated hook install must not duplicate marked blocks

### Validation

```bash
agent-kernel session timeline <session-id>
agent-kernel commit link --sha <sha> --session <session-id>
agent-kernel failure patterns
npm test
```

---

## Sprint 5: Agent identity and MCP polish

### Items

1. AK-AGENT-001: Agent identity model
2. AK-AGENT-002: Agent registry commands
3. AK-AGENT-003: Project identity
4. AK-MCP-001: Core and extended MCP tools
5. AK-MCP-003: MCP failure tools
6. AK-MCP-004: MCP guard behavior

### Why fifth

Multi-agent work needs identity and trust levels. This should come after the core runtime and context behavior are stable.

### Target loop

```text
Cursor gets read-only context
Codex captures failures
Claude proposes memory
User approves manually
```

### Hard constraints

1. Unknown agents get safe defaults
2. MCP default tool list stays small
3. Extended tools are opt-in
4. Approval through MCP remains disabled by default
5. Guard tool never executes commands

### Validation

```bash
agent-kernel agent list
agent-kernel agent add claude-code --trust propose-only
agent-kernel mcp serve
npm test
```

---

## Sprint 6: Retention, export, and inspection

### Items

1. AK-RETENTION-001: Raw observation retention policy
2. AK-RETENTION-002: Session compaction
3. AK-EXPORT-001: Local export
4. AK-IMPORT-001: Review-first import
5. AK-VIEW-001: Terminal viewer
6. AK-REPORT-001: Static HTML report
7. AK-AUDIT-001: Audit trail standard

### Why sixth

After the runtime starts collecting local evidence, users need cleanup, backup, import, and inspection. These should come after the data model is stable enough.

### Target loop

```text
view local state
  -> prune old raw observations
  -> keep approved memory
  -> export backup
  -> import to inbox on another machine
```

### Hard constraints

1. Approved memory is never pruned by raw observation retention
2. Import defaults to inbox
3. Export excludes secrets by default
4. Static report has no external assets
5. Terminal viewer adds no runtime dependencies

### Validation

```bash
agent-kernel retention prune --dry-run
agent-kernel export ./backup.json --redact
agent-kernel import ./backup.json --inspect
agent-kernel view
npm test
```

---

## What to avoid

Do not add these to the default path:

1. Required daemon on install
2. Required cloud service
3. Required external database
4. Required vector database
5. Required embeddings
6. Hosted sync
7. Large MCP tool explosion
8. Auto-approve from hooks
9. Agent-owned durable memory mutation
10. Repo-local secrets
11. Heavy dashboard
12. Browser app as the primary inspection layer
13. Runtime dependency bloat
14. Silent changes to generated project files
15. Background autostart without explicit user command

## Default architecture target

```text
~/.agent-kernel/
  source/
    memories/
    policies/
    failures/
    agents/
    projects/
  inbox/
    pending/
    approved/
    rejected/
  episodes/
  runtime/
    sessions/
      *.json
      *.jsonl
      *.context-commit.json
    observations/
    logs/
  index/
  dist/
```

ContextFS remains a virtual projection over these stores and does not add a parallel persistence root.

## Issue creation order

The original issue creation sequence remains the historical build order for the runtime foundation. New ContextFS follow-up issues should be created only for optional adapters or measured retrieval improvements.

Historical sequence:

1. Optional local daemon
2. Runtime diagnostics
3. Session model
4. Observation capture
5. Context endpoint
6. File context command
7. Add file references to records
8. Local search index
9. Relevance scoring
10. Claude context hook
11. Session timeline
12. Commit link command
13. Recurring failure patterns
14. Pattern to proposal
15. Agent identity model
16. Agent registry
17. MCP core and extended split
18. MCP context tools
19. Retention policy
20. Export and import

ContextFS follow-up priority:

1. Retrieval benchmark fixtures
2. Bounded relation expansion
3. ContextFS MCP read/search tools
4. Pre-task agent adapters
5. Optional semantic reranker only after deterministic baseline measurements exist

## Release strategy

Ship this as incremental minor releases, not one large release.

Suggested release groups:

| Release | Scope |
|---|---|
| `v1.1` | Runtime foundation and sessions |
| `v1.2` | File context and local search |
| `v1.3` | Hooks and MCP context tools |
| `v1.4` | Commit links and pattern proposals |
| `v1.5` | Agent identity and trust levels |
| `v1.6` | Retention, export, import, and reports |
| Next minor | ContextFS virtual namespace, progressive retrieval, trace, used-context evidence, and review-first session commit |

## Final success criteria

Agent Kernel remains small if the user wants it small:

```bash
agent-kernel remember "Use pnpm in this repo" --publish
agent-kernel compile
agent-kernel-safe-link .
```

Agent Kernel becomes live only when the user asks:

```bash
agent-kernel daemon start
agent-kernel mcp serve
agent-kernel file-context src/cli.mjs
```

ContextFS remains useful without the daemon:

```bash
agent-kernel context find "safe-link" --under ak://global/ --trace
```

That distinction is the product line. Preserve it.