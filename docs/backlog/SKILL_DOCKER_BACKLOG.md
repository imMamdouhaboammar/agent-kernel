# Skill Docker Backlog

## Status

Proposed subsystem for the Agent Kernel roadmap.

`Skill Docker` is the working product name for a local capability discovery and routing layer. It is not related to Docker containers and must not execute, sandbox, or package third-party code.

## Problem

Coding agents can have hundreds of skills, tools, hooks, slash commands, MCP tools, and plugins available across project and global installations.

The current failure mode is not only missing capability. It is capability overload:

1. The agent sees too many choices.
2. Similar resources use different names and metadata.
3. Two skills can target the same task while each contains a useful capability that the other does not.
4. The agent often loads the first obvious skill instead of the best combination.
5. Reading every resource before every task wastes context and tokens.
6. Useful task outcomes remain trapped inside one agent session instead of improving future routing for every local coding agent.

Agent Kernel needs a small local layer that discovers available capabilities, converts them into use cases, builds a compact graph, and makes capability selection a normal pre-task step.

## Goal

Before each user task, an enabled coding agent should be able to:

```text
understand the task
  -> query a compact local capability graph
  -> select one primary resource and a small supporting bundle
  -> lazy-load only the selected resources
  -> execute the task
  -> record the outcome as shared local evidence
  -> turn repeated evidence into reviewable lessons and rules
```

The routing step should be cheap enough to become the default behavior after the user enables Skill Docker.

## Product principles

1. Local-first
2. Agent-agnostic
3. Dependency-light
4. Useful without a daemon
5. Useful without embeddings or a vector database
6. Metadata-first and lazy-loading by default
7. Deterministic routing before model-assisted routing
8. Review-first for durable memory
9. Safe around symlinks and untrusted plugin content
10. Never execute discovered resources during inventory
11. Never inject the full graph into an agent prompt
12. Prefer a small capability bundle over a long resource list
13. Return `no additional capability needed` when that is the best answer
14. Keep routing explainable and inspectable

## Non-goals

Skill Docker must not become:

1. A plugin marketplace
2. A package manager replacement
3. A required background service
4. A cloud capability registry
5. A remote telemetry system
6. An autonomous tool executor
7. A model that rewrites third-party skills in place
8. A reason to add every installed tool to the MCP surface
9. A system that auto-approves durable rules
10. A graph database dependency

## Core user experience

### Automatic mode

After the user connects an agent and enables Skill Docker, the generated agent instruction or supported pre-task hook performs one lightweight routing call per user task.

```text
UserPromptSubmit or equivalent
  -> create task fingerprint
  -> query warm graph cache
  -> return compact route capsule
  -> agent opens only selected resources
```

The hook must not rescan the machine on every task.

### Explicit command mode

Users and agents can trigger the same behavior directly:

```bash
agent-kernel dock route --task "fix the failing GitHub Actions release workflow"
agent-kernel skill-docker route --task "design a safe Supabase migration"
```

Agent-specific slash command adapters may expose:

```text
/dock <task>
/skill-docker <task>
```

### No-match mode

The router must be allowed to return:

```text
No installed skill, tool, hook, or plugin adds meaningful value for this task.
Proceed with the normal agent workflow.
```

This prevents forced and irrelevant skill usage.

## Default pre-task protocol

When Skill Docker is enabled, the generated agent rule should remain short:

```text
Before starting a user task, query Agent Kernel Skill Docker once.
Use the returned primary capability and supporting capabilities in the stated order.
Load only the selected resources.
If the route says no additional capability is needed, continue normally.
Record the route outcome when the task ends.
```

The static instruction contains the protocol, not the capability inventory.

## System architecture

```text
Installed capability sources
  -> source adapters
  -> safe inventory scanner
  -> normalized capability records
  -> use-case and capability compiler
  -> local capability graph
  -> task intent fingerprint
  -> bundle scorer and selector
  -> compact route capsule
  -> agent lazy-loads selected resources
  -> outcome evidence
  -> routing history and memory proposals
```

## Integration with existing Agent Kernel product lines

| Existing product line | Skill Docker responsibility |
|---|---|
| Memory Core | Store approved routing rules, pending lessons, and cross-agent evidence |
| Agent Adapters | Install short pre-task instructions, hooks, and slash command adapters |
| Project Intelligence | Supply framework, language, package manager, repository, and risk context |
| Skills Registry | Supply first-class Agent Kernel skill metadata and triggers |
| Enforcement | Optionally require routing for configured high-risk task classes |
| MCP | Expose a very small route and outcome surface |
| Sessions and Episodes | Connect selected capabilities to task results and failures |
| Doctor | Report stale graphs, broken symlinks, unsafe sources, and missing adapters |

## Storage target

```text
~/.agent-kernel/
  skill-docker/
    config.json
    sources.json
    state.json
    inventory/
      resources.jsonl
      fingerprints.json
    taxonomy/
      use-cases.json
      capability-atoms.json
    graph/
      nodes.jsonl
      edges.jsonl
      adjacency.json
      build-meta.json
    routes/
      routes.jsonl
      outcomes.jsonl
      stats.json
    cache/
      summaries/
      extractors/
    logs/
      scan.jsonl
      routing.jsonl
```

The first implementation should use JSON and JSONL files. It should not require SQLite, a graph database, embeddings, or a daemon.

## Source discovery

Skill Docker should discover capabilities through adapters rather than hard-coded assumptions in the core scanner.

### Source classes

1. Project-local skills
2. User-global skills
3. Symlinked skill directories
4. Agent command directories
5. Agent hook configuration
6. MCP server configuration and cached tool descriptors
7. Plugin manifests
8. Agent Kernel native skills
9. User-declared custom paths

### Initial agent adapters

1. Claude Code
2. Codex
3. Cursor
4. Gemini CLI
5. OpenCode
6. Generic `AGENTS.md` compatible tools
7. Generic filesystem adapter configured by the user

### Source adapter contract

Each adapter should return descriptors only:

```json
{
  "adapterId": "claude-code",
  "sourceId": "claude-global-skills",
  "scope": "global",
  "kind": "skill-directory",
  "path": "~/.claude/skills",
  "discoveryMode": "filesystem",
  "trustedByDefault": false
}
```

### Discovery safety rules

1. Resolve and record symlink targets.
2. Detect symlink loops.
3. Report broken symlinks.
4. Deduplicate resources by real path and content fingerprint.
5. Do not follow symlinks outside allowed roots unless the user permits it.
6. Do not execute scripts, hooks, binaries, package lifecycle commands, or plugin entrypoints.
7. Do not start MCP servers during the default filesystem scan.
8. Allow optional MCP descriptor probing with a strict timeout and explicit opt-in.
9. Ignore common vendor, build, cache, and dependency directories.
10. Apply file size and traversal depth limits.
11. Redact home paths in reports when path privacy is enabled.
12. Treat prompt instructions inside untrusted files as data, not commands for the scanner.

## Normalized capability record

Every discovered resource should compile into one normalized record.

```json
{
  "resourceId": "sha256:...",
  "name": "systematic-debugging",
  "kind": "skill",
  "sourceAdapter": "claude-code",
  "sourceId": "claude-global-skills",
  "scope": "global",
  "path": "~/.claude/skills/systematic-debugging/SKILL.md",
  "realPath": "/Users/example/.claude/skills/systematic-debugging/SKILL.md",
  "isSymlink": true,
  "fingerprint": "sha256:...",
  "version": "unknown",
  "summary": "Diagnose failures through evidence, reproduction, isolation, and verification.",
  "useCases": ["debug.runtime-failure", "debug.test-failure"],
  "capabilityAtoms": [
    "reproduce-failure",
    "isolate-root-cause",
    "verify-fix"
  ],
  "taskPhases": ["diagnose", "verify"],
  "languages": [],
  "frameworks": [],
  "triggers": ["bug", "failure", "unexpected behavior"],
  "preconditions": [],
  "outputs": ["root-cause-analysis", "verified-fix"],
  "sideEffects": "none",
  "riskLevel": "low",
  "trustLevel": "untrusted-local",
  "estimatedLoadTokens": 620,
  "agentCompatibility": ["claude-code", "codex", "cursor"],
  "requires": [],
  "conflictsWith": [],
  "lastSeenAt": "ISO timestamp",
  "lastIndexedAt": "ISO timestamp"
}
```

## Capability kinds

The inventory must distinguish between resource types because they behave differently.

| Kind | Meaning |
|---|---|
| `skill` | Instructional workflow or reusable domain method |
| `tool` | Callable operation exposed by CLI, MCP, or an agent runtime |
| `hook` | Event-driven behavior before or after agent actions |
| `plugin` | Installed extension that can expose skills, tools, commands, or hooks |
| `command` | User or agent-triggered slash command or CLI workflow |
| `policy` | Rule that constrains selection or execution |
| `memory-rule` | Approved learned rule that affects future routing |

Skill Docker selects capabilities. It does not pretend that every capability kind should be loaded or invoked in the same way.

## Taxonomy

The taxonomy must be versioned, editable, and open to unknown tags.

### Task phases

```text
discover
research
design
plan
implement
migrate
test
debug
review
secure
document
release
operate
```

### Task modes

```text
create
modify
diagnose
compare
verify
refactor
migrate
recover
audit
explain
```

### Initial domains

```text
architecture
frontend
backend
api
database
data
mobile
infrastructure
ci-cd
security
testing
debugging
documentation
release
git
performance
accessibility
observability
agent-workflows
```

### Constraints

```text
read-only
no-network
no-new-dependencies
human-approval-required
destructive-risk
secrets-sensitive
production-impact
large-repository
legacy-code
```

## Use-case compiler

The compiler converts inconsistent descriptions into stable use-case identifiers.

Example:

```text
"review a pull request for security issues"
"security review of a branch diff"
"scan changed code for vulnerabilities"
```

All can map to:

```text
security.diff-review
```

The original wording remains available for search, but routing uses normalized use cases and capability atoms.

### Classification order

1. Parse explicit metadata when present.
2. Parse known manifest fields.
3. Extract headings, triggers, commands, inputs, outputs, and warnings.
4. Apply deterministic keyword and structure rules.
5. Apply adapter-specific mappings.
6. Use optional model-assisted classification only for unresolved or low-confidence resources.
7. Cache the result by content fingerprint.

Model-assisted classification must be optional, budgeted, and never required for normal routing.

## Capability atoms

Use cases describe why a resource is useful. Capability atoms describe what is different inside it.

Examples:

```text
write-threat-model
trace-source-to-sink
build-minimal-reproduction
generate-migration-plan
verify-backward-compatibility
create-test-fixtures
review-pr-diff
inspect-ci-logs
```

This is the mechanism that preserves useful differences between resources that appear to serve the same purpose.

## Overlap and differentiation model

Resources should be grouped into overlap clusters by shared use cases, but should not be collapsed into one generic record.

For every pair in an overlap cluster, the compiler should identify:

1. Shared capability atoms
2. Unique capability atoms
3. Different task phases
4. Different trust or risk levels
5. Different project compatibility
6. Different execution costs
7. Prerequisite relationships
8. Complement relationships
9. Conflict relationships
10. Superseding or deprecated relationships

Example:

```text
Skill A: security diff discovery
Skill B: source-to-sink validation
Skill C: vulnerability write-up
```

All belong to security review, but the best route may be:

```text
A -> B -> C
```

The router should not choose only one because the names look similar, and should not choose all three unless the task needs the full sequence.

## Capability graph

### Node types

```text
resource
use-case
capability-atom
task-phase
domain
constraint
agent
project
memory-rule
```

### Edge types

```text
solves
contains
supports-phase
requires
complements
conflicts-with
supersedes
compatible-with
triggered-by
preferred-for
learned-success
learned-failure
forbidden-by
```

### Graph implementation

The first version should use flat node and edge JSONL plus an adjacency index generated at build time.

The graph is queried in memory. No graph database is required.

### Graph rebuild rules

A rebuild should occur only when:

1. A source is added or removed.
2. A resource fingerprint changes.
3. Taxonomy version changes.
4. User edits capability metadata.
5. A durable routing rule is approved.
6. `agent-kernel dock graph build` is run explicitly.

The task hook should never trigger a full rebuild.

## Task intent fingerprint

A task fingerprint should be compact and deterministic where possible.

```json
{
  "taskId": "route_...",
  "taskTextHash": "sha256:...",
  "mode": "diagnose",
  "phases": ["debug", "verify"],
  "domains": ["ci-cd", "release"],
  "useCases": ["ci.failure-diagnosis", "release.workflow-repair"],
  "capabilityNeeds": [
    "inspect-ci-logs",
    "isolate-root-cause",
    "verify-workflow-fix"
  ],
  "constraints": ["no-secret-output"],
  "projectId": "agent-kernel",
  "agentId": "codex",
  "riskLevel": "medium"
}
```

### Intent sources

1. User task text
2. Current project profile
3. Explicit file paths
4. Current git state when allowed
5. Agent identity
6. Approved memory rules
7. User-specified constraints
8. Session context within a strict budget

## Router decision rules

1. Evaluate routing once per user task, not once per tool call.
2. Prefer project-local resources when they are trusted and more specific.
3. Prefer one primary resource.
4. Add a supporting resource only when it covers a missing capability atom, required phase, or prerequisite.
5. Do not select two substitutes unless the route is explicitly comparative.
6. Apply a redundancy penalty inside overlap clusters.
7. Apply a complement bonus when two resources form a useful sequence.
8. Reject resources that conflict with project constraints or trust policy.
9. Do not select a resource only because it was recently installed.
10. Routing history may adjust ranking, but it can never override safety policy.
11. Use `no additional capability needed` when no candidate passes the relevance threshold.
12. Default maximum bundle size is four resources.
13. High-risk tasks may add one mandatory policy or review capability without consuming the normal bundle limit.
14. The agent may request an alternative route, but the override is recorded.

## Candidate scoring

The first router should use an inspectable weighted score rather than an opaque model-only decision.

```text
score =
  intent_match
  + capability_coverage
  + project_fit
  + phase_fit
  + complementarity
  + trust
  + learned_history
  + freshness
  - redundancy_penalty
  - incompatibility_penalty
  - token_cost_penalty
  - risk_penalty
```

Suggested initial weights:

| Signal | Weight |
|---|---:|
| Intent and use-case match | 0.30 |
| Capability coverage | 0.20 |
| Project fit | 0.15 |
| Task phase fit | 0.10 |
| Complementarity | 0.08 |
| Trust | 0.07 |
| Learned history | 0.05 |
| Freshness | 0.05 |

Penalties are applied after the positive score.

Weights must be configurable and visible in explain mode.

## Bundle selection

After scoring candidates, use a small set-cover style selector:

1. Select the highest scoring safe primary resource.
2. Mark its capability atoms as covered.
3. Consider supporting resources by marginal uncovered value.
4. Apply redundancy and token penalties.
5. Stop when required capability coverage is complete, the score falls below threshold, or the bundle limit is reached.
6. Order the final bundle by prerequisites and task phase.

This keeps the bundle useful without selecting every related skill.

## Route capsule

The default output should remain compact.

```json
{
  "routeId": "route_...",
  "decision": "use-capabilities",
  "confidence": 0.87,
  "primary": {
    "resourceId": "...",
    "name": "systematic-debugging",
    "load": "skills/systematic-debugging/SKILL.md",
    "reason": "Best match for evidence-led failure diagnosis"
  },
  "supporting": [
    {
      "resourceId": "...",
      "name": "verification-before-completion",
      "load": "skills/verification-before-completion/SKILL.md",
      "reason": "Adds explicit fix verification"
    }
  ],
  "loadOrder": ["systematic-debugging", "verification-before-completion"],
  "memoryRules": ["Use pnpm in this repository"],
  "budget": {
    "capsuleTokens": 220,
    "estimatedSelectedResourceTokens": 1180
  }
}
```

### Capsule limits

1. Default capsule target is 350 tokens or less.
2. Default selected bundle is one to four resources.
3. Reasons are one sentence each.
4. Full candidate ranking appears only in `--explain` mode.
5. The full graph never appears in the capsule.
6. Skill bodies are not copied into the capsule.
7. Paths or native resource references tell the agent what to open.

## Token and latency controls

1. Inventory metadata is cached by fingerprint.
2. Full resource bodies are read during indexing only when required by the extractor.
3. The routing path reads the compact graph and summaries, not every source file.
4. Warm routing must not scan directories.
5. A route is created once per user task.
6. Hooks return no output when routing is disabled or no route is needed.
7. Summaries should be capped by metadata policy.
8. Optional model classification runs only for unresolved records.
9. Route capsule and selected resource token estimates are measured.
10. The router stops adding support resources when marginal capability value is lower than token cost.
11. Project and agent filters run before detailed scoring.
12. Stale graphs can continue serving with a visible warning.

## CLI backlog

```bash
agent-kernel dock scan
agent-kernel dock scan --global --project .
agent-kernel dock source list
agent-kernel dock source add --adapter generic --path ~/.local/agent-skills
agent-kernel dock source remove <source-id>
agent-kernel dock inventory list
agent-kernel dock inventory show <resource-id>
agent-kernel dock inventory duplicates
agent-kernel dock classify <resource-id>
agent-kernel dock graph build
agent-kernel dock graph status
agent-kernel dock graph query --use-case security.diff-review
agent-kernel dock route --task "review this pull request for security issues"
agent-kernel dock route --task-file ./task.txt --project . --agent codex
agent-kernel dock explain <route-id>
agent-kernel dock feedback <route-id> --success
agent-kernel dock feedback <route-id> --failure --reason "selected skill lacked migration rollback"
agent-kernel dock outcome capture --session <session-id>
agent-kernel dock doctor
agent-kernel dock hook install claude
agent-kernel dock hook remove claude
```

`agent-kernel skill-docker` may exist as a readable alias, while `agent-kernel dock` remains the shorter daily command.

## MCP surface

Keep the default MCP surface small.

### Core candidate

```text
agent_kernel_route_capabilities
```

### Extended candidates

```text
agent_kernel_get_capability_route
agent_kernel_record_route_outcome
agent_kernel_explain_capability_route
```

The route tool returns references and reasons. It does not execute selected tools or modify third-party resources.

## Hook strategy

### Supported hook points

Use the earliest safe user-task event available for each agent:

1. User prompt submit
2. Session task start
3. Plan start
4. Wrapper command before agent invocation

Avoid routing from generic pre-tool hooks because that can run dozens of times during one task.

### Hook behavior

1. One route per task or explicit route refresh.
2. Warm cache only.
3. Short timeout.
4. Fail open by default.
5. Strict mode is opt-in and limited to configured high-risk task classes.
6. No graph rebuild.
7. No skill execution.
8. No memory approval.
9. No full candidate dump.
10. Route ID is attached to session evidence when possible.

### Agent fallback

Agents without a native hook receive a generated instruction plus the `/dock` or shell command pattern.

## Learning loop

The system should learn from actual use without allowing one agent to silently rewrite global behavior.

```text
route selected
  -> task performed
  -> outcome captured
  -> resource and use-case statistics updated
  -> repeated pattern detected
  -> routing lesson proposed
  -> user approves durable rule
  -> graph rebuild includes approved rule
  -> every connected agent can use it
```

### Immediate evidence

The following can be stored automatically as local evidence:

1. Route ID
2. Agent ID
3. Project ID
4. Task fingerprint
5. Selected resources
6. User override
7. Success or failure signal
8. Test or verification result when available
9. Failure Lesson reference
10. Timestamp and duration metadata

### Durable learning

The following require review before affecting durable global behavior:

1. `always use skill X for task Y`
2. `never use plugin X in project Z`
3. `skill A must precede tool B`
4. `skill C is unsafe for production migrations`
5. `this use case requires human approval`

These become pending memory proposals, not auto-published rules.

### Cross-agent availability

All agents read the same local Agent Kernel route evidence and approved memory.

Recent unapproved evidence may appear as a low-weight experimental signal, clearly marked and bounded so it cannot override policy or create a self-reinforcing routing loop.

## Routing history model

Use a simple dependency-free statistical model first.

For each `(project, use-case, resource)` combination, track:

```json
{
  "attempts": 14,
  "successes": 11,
  "failures": 2,
  "unknown": 1,
  "userOverrides": 2,
  "lastUsedAt": "ISO timestamp",
  "lastSuccessAt": "ISO timestamp"
}
```

A bounded confidence score may use smoothed success counts with time decay. Do not introduce online learning libraries in the first release.

### Anti-feedback-loop rules

1. Require a minimum sample count before history meaningfully changes ranking.
2. Cap the maximum history bonus.
3. Decay old history.
4. Separate global and project history.
5. Count user overrides as routing quality evidence.
6. Do not learn from tasks without a credible outcome signal.
7. Safety and compatibility filters run before history scoring.
8. Show history contribution in explain mode.

## Trust model

Suggested source trust levels:

```text
trusted-native
trusted-user
trusted-project
untrusted-local
untrusted-external
blocked
```

### Trust rules

1. Agent Kernel native skills can start as `trusted-native`.
2. User-approved custom paths can become `trusted-user`.
3. Repository-provided skills start at `trusted-project` only when the repo itself is trusted.
4. Discovered global third-party resources start as `untrusted-local`.
5. Remote or newly downloaded resources remain `untrusted-external` until inspected.
6. Blocked resources remain visible in inventory but are never selected.
7. High-risk tools require stronger trust than read-only skills.
8. Hook and plugin side effects must affect risk scoring.

## Configuration sketch

```json
{
  "enabled": true,
  "autoRoute": true,
  "defaultBundleLimit": 4,
  "capsuleTokenBudget": 350,
  "selectedResourceTokenBudget": 2400,
  "warmRouteTimeoutMs": 200,
  "allowModelClassification": false,
  "allowMcpDescriptorProbe": false,
  "useExperimentalEvidence": true,
  "experimentalEvidenceWeightCap": 0.03,
  "failMode": "open",
  "strictTaskClasses": [],
  "allowedRoots": ["~/.agent-kernel", "~/.claude", "~/.codex"],
  "ignoredDirectories": ["node_modules", ".git", "dist", "build", ".cache"]
}
```

## Backlog items

# AK-DOCK-001: Source adapter registry

## User story

As a user with multiple coding agents, I want Agent Kernel to know where each agent stores skills, commands, hooks, plugins, and tool configuration.

## Scope

1. Define source adapter interface.
2. Add initial adapters for Claude Code, Codex, Cursor, Gemini CLI, OpenCode, Agent Kernel native skills, and generic paths.
3. Support global and project scope.
4. Record discovery capability and limitations per adapter.

## Acceptance criteria

1. Adapter list is inspectable.
2. Missing agent directories are normal, not errors.
3. Every discovered source includes agent, scope, kind, and trust metadata.
4. Generic custom paths work without adding an agent-specific dependency.
5. Adapters do not execute source code.

---

# AK-DOCK-002: Safe filesystem and symlink scanner

## User story

As a user with globally symlinked capabilities, I want Skill Docker to inventory the real resources without duplicate records, loops, or unsafe traversal.

## Acceptance criteria

1. Real paths and symlink paths are both recorded.
2. Broken symlinks are reported.
3. Symlink loops terminate safely.
4. Duplicate real paths collapse into one resource with multiple source references.
5. Traversal obeys roots, depth, size, and ignore limits.
6. Scan never executes discovered scripts or hooks.
7. Tests include malicious and pathological directory fixtures.

---

# AK-DOCK-003: Capability inventory schema

## User story

As the router, I need one normalized record format across skills, tools, hooks, plugins, commands, policies, and memory rules.

## Acceptance criteria

1. JSON Schema validates every record.
2. Records preserve source-specific metadata under a namespaced extension field.
3. Content fingerprint supports incremental indexing.
4. Trust, side effects, compatibility, and token cost are first-class fields.
5. Unknown fields do not break forward compatibility.
6. Invalid records appear in doctor output and do not enter the graph.

---

# AK-DOCK-004: Metadata extractors

## User story

As a user, I want Skill Docker to understand existing resources without requiring me to rewrite every skill into one format.

## Scope

1. Markdown skill extractor
2. JSON and YAML manifest extractor
3. Hook configuration extractor
4. Slash command extractor
5. MCP cached descriptor extractor
6. Plugin manifest extractor
7. Agent Kernel native metadata extractor

## Acceptance criteria

1. Extractors are pure and do not execute resource code.
2. Extracted descriptions preserve source attribution.
3. Headings, triggers, commands, inputs, outputs, warnings, and prerequisites are captured when present.
4. Large files are bounded.
5. Extraction failures are isolated to one resource.
6. Cache is keyed by fingerprint and extractor version.

---

# AK-DOCK-005: Use-case taxonomy and compiler

## User story

As a router, I want differently worded resources to map to stable task use cases.

## Acceptance criteria

1. Taxonomy is versioned.
2. Unknown tags remain possible.
3. Deterministic classification runs without a model.
4. Optional model classification is disabled by default.
5. Classification includes confidence and evidence.
6. Taxonomy changes invalidate only affected compiled metadata.
7. Users can inspect and override classification locally.

---

# AK-DOCK-006: Capability atom compiler

## User story

As a user with overlapping skills, I want the system to preserve the useful difference between them.

## Acceptance criteria

1. Each resource can expose shared and unique capability atoms.
2. Capability atoms include evidence references to source metadata.
3. Overlap clusters do not merge source records.
4. Duplicate resources and complementary resources are distinguishable.
5. Users can correct capability atoms without editing third-party files.
6. Corrections survive rescans through local overlays.

---

# AK-DOCK-007: Capability graph builder

## User story

As a router, I want a compact local graph that connects tasks, use cases, capabilities, resources, projects, agents, and rules.

## Acceptance criteria

1. Graph uses JSONL and adjacency files.
2. Graph builds without external services.
3. Build metadata records taxonomy and extractor versions.
4. Duplicate edges are removed deterministically.
5. Invalid or blocked resources do not become selectable nodes.
6. Graph query works without loading full resource bodies.
7. Rebuild is incremental where possible.

---

# AK-DOCK-008: Task intent fingerprint

## User story

As a coding agent, I want the current task converted into a small structured intent that can be matched without sending the full session everywhere.

## Acceptance criteria

1. Fingerprint supports mode, phase, domain, use cases, capability needs, constraints, project, agent, and risk.
2. Raw task text is not required in persistent routing history.
3. Task hashes support privacy-preserving correlation.
4. Project profile improves classification when available.
5. Classification works without a model for common task types.
6. Low-confidence fingerprints are marked.

---

# AK-DOCK-009: Deterministic candidate scorer

## User story

As a user, I want route decisions to be understandable and testable.

## Acceptance criteria

1. Scoring signals and weights are inspectable.
2. Safety filters run before scoring.
3. Project and agent filters reduce the candidate set early.
4. Redundancy, incompatibility, token cost, and risk penalties are implemented.
5. Score explanations are available in debug mode.
6. Identical inputs and graph versions produce identical base rankings.
7. History adjustments remain bounded.

---

# AK-DOCK-010: Capability bundle selector

## User story

As an agent, I want a small combination that covers the task instead of a long list of related resources.

## Acceptance criteria

1. Route selects one primary resource when possible.
2. Supporting resources add measurable uncovered capability value.
3. Default bundle limit is four.
4. Prerequisites determine load order.
5. Substitute resources are not selected together by default.
6. The selector can return no-match.
7. Tests cover overlapping, complementary, conflicting, and superseding resources.

---

# AK-DOCK-011: Compact route capsule and lazy loading

## User story

As a coding agent, I want only the selection decision and resource references in context before I open the chosen skills.

## Acceptance criteria

1. Default capsule stays within configured token budget.
2. Full graph and candidate list are excluded.
3. Skill bodies are not copied into the capsule.
4. Load order and one-sentence reasons are included.
5. Token estimates are recorded.
6. JSON and human-readable output formats exist.
7. No-match output is explicit and short.

---

# AK-DOCK-012: CLI command surface

## User story

As a user, I want to scan, inspect, route, explain, and repair Skill Docker from the terminal.

## Acceptance criteria

1. `agent-kernel dock scan` is incremental.
2. `dock route` works without a daemon.
3. `dock explain` shows score and selection reasons.
4. `dock doctor` reports graph, source, symlink, schema, and staleness problems.
5. Commands use meaningful exit codes.
6. `skill-docker` alias is documented.
7. Completion and help text remain concise.

---

# AK-DOCK-013: Agent hook adapters

## User story

As a user, I want connected agents to route capabilities automatically once per task.

## Acceptance criteria

1. Hooks are opt-in and reversible.
2. Hook runs against warm cache only.
3. Hook timeout is configurable and short.
4. Default failure mode is open.
5. Route IDs attach to sessions when supported.
6. Repeated installation is idempotent.
7. Unsupported agents receive a static protocol fallback.
8. Hook output remains within capsule budget.

---

# AK-DOCK-014: Slash command and wrapper adapters

## User story

As a user, I want an explicit trigger when automatic hooks are unavailable or undesirable.

## Acceptance criteria

1. Agent adapters can generate `/dock` or equivalent commands.
2. Commands call the same router as automatic mode.
3. Generated files are marked and safely replaceable.
4. Reinstall does not duplicate command definitions.
5. Removal restores user files safely.
6. Documentation lists agent-specific limitations.

---

# AK-DOCK-015: Route outcome capture

## User story

As a user, I want capability routing to improve from real results rather than static descriptions only.

## Acceptance criteria

1. Outcomes link route, task fingerprint, project, agent, and selected resources.
2. Success, failure, unknown, user override, and verification evidence are supported.
3. Outcome capture can integrate with sessions and Failure Lessons.
4. Raw prompts are excluded by default.
5. Secrets are redacted.
6. Missing outcomes do not count as successes.
7. Outcome logs are local and inspectable.

---

# AK-DOCK-016: Bounded routing history

## User story

As a user, I want repeated successful combinations to rank better without creating opaque feedback loops.

## Acceptance criteria

1. Project and global statistics are separate.
2. Minimum sample count is configurable.
3. History bonus is capped.
4. Old evidence decays.
5. Safety rules always override history.
6. Explain mode shows history contribution.
7. Users can reset history without deleting the inventory or graph.

---

# AK-DOCK-017: Routing lesson proposals

## User story

As a user, I want repeated agent outcomes to become shared lessons and rules after review.

## Acceptance criteria

1. Repeated patterns create pending proposals only.
2. Proposals cite route and outcome evidence.
3. Approval can create project or global routing rules.
4. Rejection prevents the same unsupported proposal from being recreated immediately.
5. Approved rules compile into the graph.
6. Every connected agent can read approved routing rules.
7. No agent can auto-approve a durable routing rule by default.

---

# AK-DOCK-018: Trust and side-effect policy

## User story

As a user, I want untrusted or high-side-effect resources prevented from unsafe automatic selection.

## Acceptance criteria

1. Source trust is configurable.
2. Resource risk reflects kind and side effects.
3. Blocked resources never route.
4. High-risk tools require explicit policy permission.
5. Repository trust affects project-local plugins and hooks.
6. Scanner prompt injection fixtures do not alter scanner behavior.
7. Security decisions appear in explain output without exposing secrets.

---

# AK-DOCK-019: Diagnostics, reports, and maintenance

## User story

As a user, I want to understand why routing quality changed and repair stale or broken indexes.

## Acceptance criteria

1. Doctor reports stale graph, changed sources, broken links, extractor failures, blocked resources, and oversized metadata.
2. Static report summarizes sources, overlap clusters, no-match rates, token cost, and overrides.
3. Rebuild and cache reset commands are separate.
4. Reports do not require a browser runtime or external assets.
5. Logs rotate under retention policy.
6. Approved memory is not deleted by cache cleanup.

---

# AK-DOCK-020: Benchmark and compatibility suite

## User story

As a maintainer, I want routing quality and cost protected by repeatable fixtures.

## Required fixtures

1. Two skills with the same use case and different capability atoms
2. Three complementary skills that form a sequence
3. Conflicting project and global skills
4. Broken symlink
5. Symlink loop
6. Duplicate content through multiple paths
7. Oversized skill file
8. Prompt injection text inside a skill
9. Resource update that invalidates one cache entry
10. No matching resource
11. Blocked high-risk tool
12. Project-specific capability preferred over generic global capability
13. Cross-agent outcome history
14. Stale graph fallback
15. Capsule budget overflow

## Acceptance criteria

1. Warm route latency is measured.
2. Incremental scan time is measured.
3. Capsule token estimate is measured.
4. Bundle redundancy rate is measured.
5. Top-one and top-three expected resource accuracy are measured against fixtures.
6. No fixture executes discovered code.
7. Compatibility tests cover supported agent adapters.
8. Regressions fail CI when configured budgets are exceeded.

## Suggested performance budgets

These are initial engineering targets, not public guarantees:

1. Warm route p95 under 200 ms on a normal local inventory.
2. Default capsule at or below 350 tokens.
3. Default bundle at or below four resources.
4. No full source scan on the routing path.
5. No source execution during scan or route.
6. Incremental scan reprocesses only changed fingerprints.
7. Router works with at least 1,000 inventory records without external infrastructure.

## Implementation sequence

### Phase 0: Contracts and fixtures

1. AK-DOCK-003 capability schema
2. AK-DOCK-005 taxonomy
3. AK-DOCK-006 capability atoms
4. AK-DOCK-020 core fixtures and budgets

Exit condition:

The repository has schemas, test fixtures, and an agreed route capsule before implementation spreads across adapters.

### Phase 1: Safe inventory MVP

1. AK-DOCK-001 source adapter registry
2. AK-DOCK-002 safe scanner
3. AK-DOCK-004 metadata extractors
4. AK-DOCK-012 scan, inventory, and doctor commands

Exit condition:

The CLI can inventory project and global resources, deduplicate symlinks, and explain invalid records without executing anything.

### Phase 2: Graph and manual routing MVP

1. AK-DOCK-007 graph builder
2. AK-DOCK-008 task fingerprint
3. AK-DOCK-009 candidate scorer
4. AK-DOCK-010 bundle selector
5. AK-DOCK-011 route capsule
6. AK-DOCK-012 route and explain commands

Exit condition:

A user can run one command for a task and receive a compact, deterministic, useful capability bundle.

### Phase 3: Agent integration

1. AK-DOCK-013 hooks
2. AK-DOCK-014 slash commands and wrappers
3. Minimal MCP route tool
4. Generated short pre-task protocol

Exit condition:

Supported agents can route once per task without graph or prompt bloat, and unsupported agents have a reliable fallback.

### Phase 4: Shared learning

1. AK-DOCK-015 outcome capture
2. AK-DOCK-016 bounded history
3. AK-DOCK-017 lesson proposals
4. Session, episode, and Failure Lesson integration

Exit condition:

One agent's verified task outcome becomes shared local evidence, while durable routing changes remain review-first.

### Phase 5: Hardening and observability

1. AK-DOCK-018 trust and side-effect policy
2. AK-DOCK-019 diagnostics and reports
3. Full AK-DOCK-020 benchmark suite
4. Retention and export integration

Exit condition:

The subsystem is safe around hostile files, measurable under large inventories, repairable, and covered by compatibility tests.

## MVP boundary

The first shippable Skill Docker release should include:

1. Filesystem and symlink source discovery
2. Agent Kernel, Claude Code, Codex, Cursor, and generic path adapters
3. Markdown and manifest extraction
4. Normalized inventory
5. Deterministic use cases and capability atoms
6. Local graph
7. Manual `dock route`
8. Primary plus supporting bundle selection
9. Compact capsule
10. Explain mode
11. No-match decision
12. Doctor checks
13. Fixture-based routing tests

The MVP should not include:

1. Automatic hooks
2. MCP server probing
3. Model-assisted classification by default
4. Adaptive routing history
5. Auto-created durable rules
6. TUI graph visualization
7. Remote indexes
8. Plugin execution

## Release proposal

| Release | Scope |
|---|---|
| `v0.8.0` | Native skills registry and normalized capability schema |
| `v0.8.1` | Safe discovery, symlink inventory, and extractors |
| `v0.8.2` | Use-case compiler, capability atoms, and graph |
| `v0.8.3` | Manual route, explain, and compact capsule |
| `v0.8.4` | Agent hooks, slash commands, and minimal MCP route tool |
| `v0.8.5` | Outcome capture, bounded history, and lesson proposals |
| `v0.8.6` | Trust hardening, diagnostics, reports, and benchmarks |

Version numbers can move with the main roadmap, but the implementation slices should remain small and independently testable.

## Definition of done

Skill Docker is complete when:

1. A user can inventory skills, tools, hooks, commands, and plugins from supported local sources.
2. Global symlinks are resolved safely and duplicates are not counted as separate capabilities.
3. Resources with the same purpose retain their unique capability atoms.
4. The router selects a small primary and supporting bundle for a real coding task.
5. The agent loads only selected resources.
6. Warm routing does not scan the filesystem or require a daemon.
7. Default route capsules stay within budget.
8. Automatic mode runs once per task, not once per tool call.
9. Manual `/dock` or CLI routing works on agents without hooks.
10. Task outcomes become shared local evidence across agents.
11. Repeated outcomes can create reviewable routing lessons.
12. Durable global behavior never changes without approval by default.
13. Untrusted resources cannot silently execute or force selection.
14. The subsystem works offline without embeddings, cloud services, or external databases.
15. Tests prove that routing reduces redundant skill loading rather than adding another source of context overload.

## Final product line

Skill Docker should make Agent Kernel answer one question before an agent starts work:

```text
Given this task, this project, this agent, the installed local capabilities, and the lessons already learned, what is the smallest useful capability bundle to load now?
```

That question should be answered locally, quickly, explainably, and with enough restraint to protect the agent's context window.