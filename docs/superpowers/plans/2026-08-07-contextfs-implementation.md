# ContextFS and Hierarchical Retrieval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `ak://` virtual context namespace, deterministic L0/L1/L2 projections, hierarchical retrieval traces, used-context session evidence, and review-first session commit proposals to Agent Kernel without changing its local-first governance or MIT licensing boundary.

**Architecture:** Add a focused routed subsystem in `bin/agent-kernel-contextfs.mjs`. Existing JSON/JSONL stores remain authoritative. The subsystem projects records into virtual nodes, performs deterministic scoped retrieval, and emits read-only projections/traces. Session usage and commit metadata append to existing session evidence and proposal inboxes without auto-approval.

**Tech Stack:** Node.js >=18.18.0 built-ins only, existing JSON/JSONL stores, current router, current smoke harness.

## Global Constraints

- Clean-room implementation. Do not copy OpenViking source code, schemas, tests, constants, or implementation-specific algorithms.
- Keep package license MIT.
- No required vector database, embeddings, LLM, cloud service, daemon, or new runtime dependency.
- Existing Agent Kernel stores remain authoritative.
- `ak://` is virtual and must never become a raw filesystem path.
- Reject `..`, encoded dot-segments, backslashes in URI paths, NUL bytes, query strings, fragments, credentials, and foreign schemes.
- Never expose secret values.
- Pending proposals remain explicitly pending and unapproved.
- Session commit must never auto-publish or mutate approved memory.
- JSON output must be deterministic enough for smoke tests.
- Every new runtime behavior gets focused smoke coverage before implementation.

---

### Task 1: ContextFS URI contract and virtual tree

**Files:**
- Create: `test/contextfs.mjs`
- Modify: `test/smoke.mjs`
- Create: `bin/agent-kernel-contextfs.mjs`
- Modify: `bin/agent-kernel-router.mjs`

**Interfaces:**
- `agent-kernel context tree [ak://...] [--depth N] [--json]`
- `agent-kernel context read <ak://...> [--level 0|1|2] [--json]`
- Root collections: `projects`, `global`, `agents`, `skills`, `policies`
- Project collections: `memory`, `failures`, `episodes`, `sessions`, `commits`, `architecture`

- [ ] Write smoke tests for root/project tree, canonical URI output, L0/L1/L2 read behavior, and traversal/foreign-scheme rejection.
- [ ] Confirm the new test fails because ContextFS routing does not exist.
- [ ] Implement safe URI parsing/canonicalization and virtual projection over existing stores.
- [ ] Route ContextFS context subcommands without breaking broker-owned `context enter|current|verify|doctor|switch`.
- [ ] Confirm focused and full smoke coverage pass.
- [ ] Commit.

### Task 2: Hierarchical find and retrieval trace

**Files:**
- Modify: `test/contextfs.mjs`
- Modify: `bin/agent-kernel-contextfs.mjs`

**Interfaces:**
- `agent-kernel context find <query> [--under ak://...] [--project path] [--file path] [--budget N] [--limit N] [--trace] [--json]`
- Result entries expose `uri`, `type`, `level`, `score`, `abstract`, optional `overview`, and provenance.
- Trace exposes deterministic collection/candidate decisions and budget accounting.

- [ ] Add failing tests proving project scope, file locality, hierarchy descent, budget enforcement, and trace explainability.
- [ ] Implement deterministic collection scoring using existing record signals and project/file metadata.
- [ ] Implement L0-first candidate selection and L1 promotion for the strongest records.
- [ ] Add bounded relation expansion from existing file/commit/session/failure references.
- [ ] Keep L2 opt-in only.
- [ ] Confirm tests pass and commit.

### Task 3: Session used-context evidence

**Files:**
- Modify: `test/contextfs.mjs`
- Modify: `bin/agent-kernel-contextfs.mjs`

**Interfaces:**
- `agent-kernel context used <session-id> <ak://uri> [--reason text] [--result helpful|neutral|unhelpful] [--json]`
- Appends a `context_used` observation to the existing session JSONL.

- [ ] Add failing tests for valid usage evidence, safe session IDs, URI validation, and observation count updates.
- [ ] Implement append-only used-context evidence with timestamps and provenance.
- [ ] Do not create or approve durable memory.
- [ ] Confirm tests pass and commit.

### Task 4: Review-first session commit

**Files:**
- Modify: `test/contextfs.mjs`
- Modify: `bin/agent-kernel-contextfs.mjs`

**Interfaces:**
- `agent-kernel context commit <session-id> [--dry-run] [--json]`
- Writes deterministic commit metadata under `runtime/sessions/<id>.context-commit.json`.
- Candidate durable lessons are materialized only as pending inbox proposals.
- Diff format includes `adds`, `updates`, `deletes` arrays; phase 1 may produce pending adds only.

- [ ] Add failing tests for dry-run, idempotency, pending-only proposal creation, diff/provenance, and no approved-memory mutation.
- [ ] Implement deterministic candidate extraction from session summary/failures/context usage without an LLM.
- [ ] Deduplicate against approved/pending memory by normalized content hash.
- [ ] Create pending proposals only when a novel stable candidate exists.
- [ ] Confirm tests pass and commit.

### Task 5: Docs, command reference, architecture notes, and backlog

**Files:**
- Modify: `README.md`
- Modify: `docs/COMMAND_REFERENCE.md`
- Modify: `docs/ARCHITECTURE_NOW.md`
- Modify: `docs/backlog/IMPLEMENTATION_ORDER.md`
- Create: `docs/CONTEXTFS.md`

- [ ] Document URI contract, stores, levels, find/trace, session evidence, commit governance, security boundaries, and rollback/removal path.
- [ ] Explicitly document clean-room inspiration and AGPL boundary without claiming code compatibility.
- [ ] Update architecture ownership and command routing.
- [ ] Mark delivered backlog items and leave semantic/vector retrieval as optional future work.
- [ ] Run docs checks and commit.

### Task 6: Security and quality review

**Files:**
- Modify only files required by validated findings.

- [ ] Review path traversal, encoded traversal, symlink assumptions, secret leakage, denial-of-service budgets, malformed JSON/JSONL, and trust-boundary behavior.
- [ ] Review code quality and public CLI compatibility.
- [ ] Fix validated findings with regression tests first.
- [ ] Run full repository gates.

### Task 7: PR verification and merge

- [ ] Open/maintain PR from `feat/contextfs-hierarchical-retrieval` to `master`.
- [ ] Verify GitHub Actions across supported Node versions and quality/package gates.
- [ ] Review PR diff and comments.
- [ ] Address actionable review findings.
- [ ] Re-run failed checks only when failure cause is understood.
- [ ] Merge only after required checks are green.
- [ ] Verify merged `master` commit and repository status.
