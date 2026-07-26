# Skill contract and synchronization

Agent Kernel ships multiple skill documents because different agent ecosystems discover different paths. They share one behavioral contract but are not byte-for-byte copies.

## Skill surfaces

| Path | Role |
|---|---|
| `SKILL.md` | Canonical product-level Agent Kernel skill. |
| `.claude/skills/agent-kernel/SKILL.md` | Claude Code entry point with Claude-specific hooks and MCP guidance. |
| `.agents/skills/agent-kernel/SKILL.md` | AGENTS-compatible entry point for Codex, Antigravity, and file-based agents. |
| `skills/architecture-guardian/SKILL.md` | Canonical Architecture Guardian orchestration skill. |
| `.claude/skills/architecture-guardian/SKILL.md` | Claude-specific Architecture Guardian entry point. |
| `.agents/skills/architecture-guardian/SKILL.md` | AGENTS-compatible Architecture Guardian entry point. |

The root skills contain the full workflow. Adapter skills should stay concise enough for discovery but must preserve the critical trust boundaries.

## Required Agent Kernel skill contract

Every Agent Kernel skill surface must communicate these invariants:

1. Approved source memory is canonical; generated guidance is disposable delivery output.
2. Agents may capture evidence and create proposals. Approval and publication remain user-owned unless the user deliberately selects a broader write mode.
3. Failure Lessons are evidence first; promotion creates a pending proposal.
4. File-backed IDs are identifiers, not paths.
5. The daemon is optional and local-only by default. Remote mode requires explicit opt-in and a strong bearer token.
6. MCP defaults to a bounded core surface. Approval is disabled by default; publish and delete are not exposed.
7. Existing project instructions are user-owned. Use safe-link and dry-run before modifying them.
8. Non-trivial code changes should follow Architecture Guardian: doctor, discover, reuse, contract, implement, check.
9. Project Context Broker provider targets come from reviewed manifests, not caller overrides.
10. Behavior changes require tests, docs, version consistency, and release gates.

## Required Architecture Guardian contract

Every Architecture Guardian skill surface must require:

1. Read repository instructions and current project policy.
2. Run `architecture doctor` and `architecture discover`.
3. Search reuse candidates before creating a parallel capability.
4. Create or validate a change contract for non-trivial work.
5. Keep writes inside the reviewed scope.
6. Run `architecture check` before commit.
7. Classify baseline debt separately from new regressions.
8. Use only scoped, owned, expiring exceptions.
9. Keep review and strict modes explicit.
10. Capture repeated architecture failures as Failure Lessons rather than silently weakening policy.

## Adapter-specific differences

Adapter skills may add platform details:

- Claude skills may document `PreToolUse`, `PostToolUseFailure`, and local MCP setup.
- AGENTS-compatible skills may emphasize `AGENTS.md`, `.codex/`, and `.agents/` discovery.
- Adapter skills may link to the canonical skill instead of duplicating every command.

Adapter differences must not weaken the shared approval, daemon, MCP, identifier, or architecture boundaries.

## Trigger quality

Skill descriptions should contain concrete user intents, not generic claims. Good triggers include:

- remember this rule
- make all coding agents follow this workflow
- capture this recurring failure
- search previous debugging evidence
- prevent architecture drift
- create or validate a change contract
- connect this project without overwriting instructions
- configure local MCP
- inspect or secure the runtime daemon
- prepare or verify an Agent Kernel release

Do not activate Agent Kernel for an ordinary coding task when no persistent governance, memory, runtime evidence, project connection, or architecture conformance is needed.

## Documentation links

Skill docs should point users to stable task-oriented references:

- `docs/COMMAND_REFERENCE.md`
- `docs/ENVIRONMENT_VARIABLES.md`
- `docs/OPERATING_MODEL.md`
- `docs/AGENT_RUNBOOK.md`
- `docs/MCP_SERVER.md`
- `docs/PROJECT_CONNECTION.md`
- `docs/ARCHITECTURE_GUARDIAN.md`
- `docs/SECURE_RUNTIME_AND_RELEASES.md`

Links inside distributable skill files should use repository URLs when the skill may be installed outside this repository.

## Change procedure

When a skill-visible behavior changes:

1. Update the runtime and focused tests first.
2. Update `SKILL.md` and the canonical protocol doc.
3. Update both agent-kernel adapter skills.
4. Update the canonical Architecture Guardian skill and its adapters when architecture behavior changes.
5. Update discovery metadata when the product description or capability set changes.
6. Run `npm run docs:check`, `npm run lint`, and the relevant smoke tests.
7. Keep all version surfaces aligned for release-visible changes.

The documentation contract test verifies required phrases, public binary coverage, and key security boundaries. It does not replace human review of clarity, examples, or platform accuracy.
