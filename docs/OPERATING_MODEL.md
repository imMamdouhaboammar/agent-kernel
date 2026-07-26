# Operating model

Agent Kernel is a local governance layer between a user and coding agents. It preserves reviewed memory, bounded runtime evidence, project isolation, architecture constraints, and release evidence without turning the agent into an unreviewed policy owner.

## The five state classes

| State | Purpose | Canonical? | Normal writer |
|---|---|---:|---|
| Approved source memory | Durable rules, preferences, workflows, project notes, policies, skills | yes | governed CLI after user approval |
| Pending proposals | Suggested durable memory | no | agents and users |
| Runtime evidence | Sessions, observations, Failure Lessons, audit events, commit links | evidence | focused runtime helpers |
| Episodes | Searchable historical decisions and summaries | historical | explicit user or agent capture |
| Generated outputs | `AGENTS.md`, `CLAUDE.md`, Cursor rules, Gemini guidance, reports | no | compiler, linker, dashboard, report commands |

If generated output is wrong, fix source memory, runtime behavior, or the relevant protocol, then regenerate. Do not patch generated output as the durable fix.

## Daily user workflow

### 1. Confirm local state

```bash
agent-kernel doctor
agent-kernel status
agent-kernel update status --json
```

For a connected project:

```bash
agent-kernel project status --json
agent-kernel context current --json
```

### 2. Refresh approved guidance

```bash
agent-kernel sync
agent-kernel compile
agent-kernel-safe-link . --dry-run
agent-kernel-safe-link .
```

Use safe-link when the project already has user-authored instructions.

### 3. Retrieve bounded context

```bash
agent-kernel search "<task or error>" --explain
agent-kernel context "<task>" --files src/example.mjs --budget 1200
```

Search before loading broad local state. Prefer file and project filters.

### 4. Record runtime evidence when useful

```bash
agent-kernel session start --agent codex --project . --json
agent-kernel session observe <session-id> \
  --type test \
  --command "npm test" \
  --exit-code 0 \
  --text "Focused regression test passed"
agent-kernel session end <session-id>
```

Sessions are local evidence. They are not automatically durable guidance.

### 5. Search and capture Failure Lessons

```bash
agent-kernel failure search "<error signature>"
```

Capture a reusable failure only after the evidence supports a cause and fix:

```bash
agent-kernel failure capture \
  --from codex \
  --type test-failure \
  --command "npm test" \
  --exit-code 1 \
  --text "<redacted error>" \
  --root-cause "<supported cause>" \
  --fix "<verified fix>"
```

Failure capture deduplicates repeated project + command + signature combinations unless a separate occurrence is explicitly needed.

### 6. Promote only durable knowledge

```bash
agent-kernel failure propose <failure-id> --as rule
agent-kernel inbox
agent-kernel approve <proposal-id> --publish
```

Allowed promotion targets include `rule`, `policy`, `workflow`, `skill`, and `note`.

## Approval model

Default flow:

```text
agent captures or proposes
  -> pending or evidence state
  -> user reviews
  -> user approves or rejects
  -> approved memory is compiled and published
```

Global write mode and agent identity trust are different controls.

Global write mode:

```bash
agent-kernel-mode show
agent-kernel-mode set approval
```

Agent identity trust:

```bash
agent-kernel agent list --json
agent-kernel agent set codex --trust propose-only
```

Use approval mode by default. Do not interpret `trusted-local` identity as blanket permission to bypass project, provider, architecture, or release controls.

## Project isolation

A connected project keeps local manifest and policy files while sharing the global runtime:

```text
project/.agent-kernel/project.toml
project/.agent-kernel/policy.toml
~/.agent-kernel/connections/registry.toml
~/.agent-kernel/connections/active-session.json
~/.agent-kernel/connections/approvals.json
~/.agent-kernel/logs/project-audit.jsonl
```

Project connection does not copy credentials or the full runtime into the repository.

```bash
agent-kernel project connect --dry-run
agent-kernel project connect --yes
agent-kernel project doctor
```

## Provider operations

Provider commands are governed by three layers:

1. the current validated project and environment
2. manifest-bound profile and target configuration
3. a short-lived production approval for sensitive operations

```bash
agent-kernel approvals request \
  --provider supabase \
  --operation db-push \
  --reason "Reviewed migration window"
agent-kernel approvals approve <approval-id> --ttl-minutes 15
agent-kernel provider supabase exec -- db push
```

Caller target overrides do not replace reviewed project targets. Credentials stay in secure platform storage or the current process environment, not the project manifest.

## Architecture workflow

For non-trivial work:

```bash
agent-kernel architecture doctor . --json
agent-kernel architecture discover . --json
agent-kernel architecture reuse "<capability>" . --json
agent-kernel architecture contract init . --task "..." --owner "..." --allow "..."
agent-kernel architecture check . --json
```

Review mode is the adoption default. Strict mode is appropriate only after policy, baseline, contracts, and exceptions are trustworthy.

Existing baseline debt remains visible but is not attributed to an unrelated change. Exceptions require scope, reason, owner, and expiry.

## Hooks

Hooks are lifecycle adapters, not hidden agents.

Recommended uses:

| Use | Event | Approval power |
|---|---|---|
| command or path guard | pre-tool event | none |
| architecture scope check | write/edit pre-tool event | none |
| failure evidence capture | failure-specific post-tool event | none |
| short context injection | supported session event | none |

Hooks should be narrow, bounded, auditable, and credential-free. They should not approve memory, publish memory, broaden policy, create exceptions, or run autonomous repair loops.

## MCP

Core MCP supports approved memory search, bounded context, pending proposals, guards, Failure Lessons, and episode search.

```bash
agent-kernel mcp test
```

Extended mode and explicit MCP approval are separate opt-ins. Publish and delete are never exposed through MCP.

MCP and the HTTP daemon are different transports. The daemon is not required for MCP.

## Daemon

Local default:

```bash
agent-kernel daemon start
agent-kernel daemon status --json
```

Remote mode requires explicit opt-in and a strong bearer token. It should run only behind private or authenticated transport.

## Portability and retention

```bash
agent-kernel retention status --json
agent-kernel retention prune --dry-run --older-than 30d
agent-kernel export ./backup.json --redact --include-observations
agent-kernel import ./backup.json --inspect --json
```

Inspect before import. Use redacted export for sharing. Replacement import and forced pruning are explicit destructive operations.

## Commit evidence

```bash
agent-kernel commit link --sha <sha> --session <id> --files src/example.mjs
agent-kernel commit context <sha> --json
```

Commit evidence makes local runtime history traceable without making every observation durable policy.

## Repository contributor loop

For Agent Kernel runtime changes:

1. inspect the routed command and focused helper
2. reproduce the problem with a focused test
3. change the source, not generated build output
4. update command, protocol, security, and skill docs
5. run focused tests
6. run `npm run verify:release`
7. install the tarball into a clean temporary project when package behavior changes
8. review workflow syntax with `actionlint` when Actions change
9. merge only after Linux, Windows, and CodeQL checks
10. tag only after `master` is verified

Docs-only changes still run `npm run docs:check` and `npm run lint`.

## Decision guide

| Knowledge | Store as |
|---|---|
| durable policy | policy or critical rule |
| project preference | preference or project note |
| repeatable process | workflow |
| recurring verified failure | Failure Lesson, then proposal if durable |
| one session or investigation | episode or session evidence |
| architecture scope | change contract |
| accepted temporary violation | scoped expiring exception |
| provider production authorization | short-lived approval |

## Prohibited shortcuts

- editing generated guidance as canonical memory
- approving an agent proposal without user intent
- enabling bypass mode as a setup convenience
- storing credentials in repo-local manifests or skills
- exposing the daemon publicly
- using MCP approval as the default
- weakening architecture policy to make one change pass
- treating baseline debt as permission for new violations
- publishing a version without registry and release verification

## Related docs

- `COMMAND_REFERENCE.md`
- `ENVIRONMENT_VARIABLES.md`
- `INSTALL_AND_AGENT_SETUP.md`
- `PROJECT_CONNECTION.md`
- `MCP_SERVER.md`
- `ARCHITECTURE_GUARDIAN.md`
- `RETENTION_AND_PORTABILITY.md`
- `SECURE_RUNTIME_AND_RELEASES.md`
