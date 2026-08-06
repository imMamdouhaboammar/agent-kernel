---
name: agent-kernel
description: |
  Local-first governance, memory, runtime evidence, project isolation, architecture conformance,
  and release safety for AI coding agents. Use Agent Kernel when a user wants Claude Code,
  Codex, Cursor, OpenCode, Antigravity, Gemini CLI, or AGENTS.md-compatible agents to share
  persistent rules, reviewed workflows, Failure Lessons, episodes, bounded runtime context,
  project connection manifests, provider approvals, generated guidance, MCP tools, hooks,
  command guards, or architecture contracts. Strong triggers include: remember this rule,
  make every coding agent follow this workflow, capture this recurring failure, search previous
  debugging evidence, prevent architecture drift, search before creating a service, connect this
  repository safely, configure local MCP, secure the runtime daemon, inspect project provider
  boundaries, or prepare and verify an Agent Kernel release.
---

# Agent Kernel

Agent Kernel is a local-first governance layer for coding agents. It does not replace the agent. It gives multiple agents one reviewed source of truth for durable memory, failure evidence, project boundaries, architecture policy, and release discipline.

## Activate this skill when

Use this skill when the task requires one or more of these capabilities:

- save a durable user rule, preference, workflow, policy, project note, or skill trigger
- let an agent propose memory without approving it
- capture and search repeated build, test, command, or edit failures
- retrieve bounded task or file context from local approved state
- record sessions, observations, timelines, episodes, or commit evidence
- connect a project without duplicating the global runtime or overwriting user instructions
- isolate provider profiles, environments, project targets, and production approvals
- prevent architecture drift, duplicate capabilities, cycles, or out-of-scope writes
- install or inspect generated agent guidance, hooks, MCP, guard rules, or safe linking
- inspect or secure the optional HTTP daemon
- back up, import, compact, report, or review local state
- verify Agent Kernel CI, package, documentation, or release integrity

Do not activate it for a generic coding task when the user does not need persistent governance, memory, runtime evidence, project connection, or architecture conformance.

## Core mental model

```text
user intent
  -> agent reads approved guidance and bounded context
  -> agent works inside project and architecture scope
  -> failures and useful evidence are captured locally
  -> durable changes become pending proposals
  -> user reviews and approves
  -> Agent Kernel publishes generated guidance
  -> future agents inherit the reviewed result
```

## Non-negotiable trust boundaries

1. Approved source memory is canonical. Generated `AGENTS.md`, `CLAUDE.md`, Cursor rules, Gemini guidance, and other compiled files are delivery outputs.
2. Agents may capture and propose. They must not silently approve or publish durable memory.
3. Failure Lessons are evidence. Promotion creates a pending proposal.
4. Session, proposal, episode, commit-link, and other file-backed IDs are identifiers, not filesystem paths.
5. The daemon is optional and local-only by default. Remote mode requires explicit opt-in and a bearer token of at least 32 bytes.
6. MCP defaults to a bounded core surface. Approval is disabled by default. Publish and delete are never exposed through MCP.
7. Existing project instructions are user-owned. Use safe-link and dry-run before changing them.
8. Project provider targets come from reviewed manifests. Caller overrides must not replace project, region, account, configuration, or project reference.
9. Architecture policy, baselines, contracts, and exceptions require review. Do not broaden them silently.
10. A release is not complete until the package, GitHub tag, npm registry, provenance path, release assets, and checksums are verified.

## Fast setup

```bash
npm install -g @mamdouh-aboammar/agent-kernel
agent-kernel --version
agent-kernel init --sync
agent-kernel doctor
```

For an existing repository:

```bash
cd /path/to/project
agent-kernel compile
agent-kernel-safe-link . --dry-run
agent-kernel-safe-link .
agent-kernel-safe-git-hook . --dry-run
agent-kernel-safe-git-hook .
agent-kernel doctor
```

Use `agent-kernel link . --hooks` only when the main linker is intentionally preferred over managed-block preservation.

## Operating loop

### 1. Inspect before writing

```bash
agent-kernel doctor
agent-kernel status
agent-kernel search "<task or error>" --explain
agent-kernel context "<task>" --files src/example.mjs --budget 1200
```

For a connected project:

```bash
agent-kernel project status --json
agent-kernel context current --json
```

### 2. Start a bounded session when evidence matters

```bash
agent-kernel session start --agent codex --project . --json
agent-kernel session observe <session-id> \
  --type command \
  --command "npm test" \
  --exit-code 0 \
  --text "Focused tests passed" \
  --file test/example.mjs
agent-kernel session timeline <session-id> --compact
agent-kernel session end <session-id>
```

Do not construct session paths manually. Pass only the ID returned by Agent Kernel.

### 3. Search Failure Lessons before retrying

```bash
agent-kernel failure search "ERR_MODULE_NOT_FOUND"
```

Capture reusable failure evidence:

```bash
agent-kernel failure capture \
  --from codex \
  --type test-failure \
  --command "npm test" \
  --exit-code 1 \
  --text "<redacted error output>" \
  --root-cause "<supported root cause>" \
  --fix "<smallest verified fix>"
```

Promote only after the pattern is reusable:

```bash
agent-kernel failure propose <failure-id> --as rule
agent-kernel inbox
```

### 4. Propose durable memory

```bash
agent-kernel propose \
  --from codex \
  --text "Use pnpm in this repository." \
  --reason "The user corrected the package manager during setup."
```

The normal user review path is:

```bash
agent-kernel inbox
agent-kernel approve <proposal-id> --publish
# or
agent-kernel reject <proposal-id>
```

When the user explicitly states a durable rule and asks to save it, direct approved memory is appropriate:

```bash
agent-kernel remember "Never commit provider credentials." \
  --type policy \
  --level critical \
  --publish
```

### 5. Keep architecture changes bounded

Load the dedicated Architecture Guardian skill before a non-trivial feature, refactor, cross-module fix, new service, new dependency, schema change, or public API change.

```bash
agent-kernel architecture doctor .
agent-kernel architecture discover . --json
agent-kernel architecture reuse "<capability>" . --json
agent-kernel architecture contract init . \
  --task "<reviewed task>" \
  --owner "<domain or team>" \
  --allow "src/area/**,test/area/**" \
  --expect "src/area/file.ts,test/area/file.test.ts" \
  --tests "<observable behavior>"
agent-kernel architecture check . --json
```

Use `--strict` only when the project policy, baseline, contract, and active exceptions are reviewed.

### 6. Link evidence to Git when useful

```bash
agent-kernel commit link \
  --sha <commit-sha> \
  --session <session-id> \
  --failure <failure-id> \
  --files src/example.mjs,test/example.mjs

agent-kernel commit context <commit-sha> --json
```

## Environment Vault

Environment Vault stores selected project `.env` files locally under the configured Agent Kernel home. It uses a full SHA256 project fingerprint so fresh clones, SSH and HTTPS remotes, and Monorepos all resolve to one identity.

Safety rules before any vault command:

- Never print, summarize, diff, or paste vault file contents
- Read `docs/ENVIRONMENT_VAULT.md` before a forced overwrite or purge
- Do not use `--force` unless the user understands a differing local file will be replaced

Quick workflow:

```bash
# Link project and discover eligible .env files
agent-kernel env link [project] [--include path] [--exclude pattern]

# Check identity, health, and file states
agent-kernel env status [project] --json

# Store changed local files
agent-kernel env push [project] [--file path] [--dry-run]

# Restore missing files (never overwrites existing without --force)
agent-kernel env pull [project] [--file path] [--force]

# Watch for changes in the background
agent-kernel env watch [project]

# Inspect revision history (no secret content)
agent-kernel env history [project] --file .env

# Restore a specific revision
agent-kernel env restore [project] --file .env --revision <id>

# Run health checks and repair permissions
agent-kernel env doctor [project] [--repair-permissions] [--migrate]

# List all local vault identities
agent-kernel env list --json

# Detach project path while keeping stored files
agent-kernel env unlink [project]

# Delete stored data (requires explicit --yes)
agent-kernel env purge [project] --yes
```

Vault directories use `0700` and stored files use `0600` on POSIX systems.

See [docs/ENVIRONMENT_VAULT.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/ENVIRONMENT_VAULT.md) for discovery rules, monorepo support, migration, conflict handling, and threat boundaries.

## Project Context Broker

Use project connection when a repository needs shared global memory but isolated local configuration and provider targets.

```bash
agent-kernel project connect --dry-run
agent-kernel project connect --yes
agent-kernel project status --json
agent-kernel project doctor
```

Validated project/environment context:

```bash
agent-kernel context enter <project-id> development --json
agent-kernel context current --json
```

Production provider operations require a matching short-lived approval:

```bash
agent-kernel approvals request \
  --provider gcloud \
  --operation deploy \
  --reason "Reviewed deployment window"
agent-kernel approvals approve <approval-id> --ttl-minutes 15
agent-kernel provider gcloud exec -- run deploy <service>
```

Do not add credentials to project manifests. Persistent credentials use the supported secure platform backend. Process environment credentials remain process-scoped and must not be logged.

## Optional daemon

Local mode:

```bash
agent-kernel daemon start
agent-kernel daemon status --json
agent-kernel daemon stop
```

Remote mode is a separate security decision:

```bash
export AGENT_KERNEL_DAEMON_HOST=0.0.0.0
export AGENT_KERNEL_DAEMON_ALLOW_REMOTE=1
export AGENT_KERNEL_DAEMON_TOKEN="$(openssl rand -hex 32)"
agent-kernel daemon start
```

Remote requests require `Authorization: Bearer <token>`. Use a private network or authenticated tunnel. Never expose the port directly to the public internet.

## MCP

Inspect the default surface:

```bash
agent-kernel mcp test
```

Core mode exposes ten tools for status, memory search, bounded context, proposals, guard checks, Failure Lessons, and episode search.

Extended mode is explicit:

```bash
AGENT_KERNEL_MCP_TOOLS=extended agent-kernel mcp test
```

Approval requires both extended mode and `AGENT_KERNEL_MCP_ALLOW_APPROVE=1`. Prefer terminal review even when explicit MCP approval is available.

## Memory write mode and agent identity

These are separate controls.

Global write mode:

```bash
agent-kernel-mode show
agent-kernel-mode set approval
agent-kernel-mode set trusted
agent-kernel-mode set bypass
```

Agent identity trust:

```bash
agent-kernel agent list --json
agent-kernel agent add codex --trust propose-only --surface cli
agent-kernel agent set codex --trust capture-only
agent-kernel agent show codex --json
```

Default to approval mode. Use trusted or bypass only when the user deliberately accepts the broader write behavior.

## Portability and local reports

```bash
agent-kernel retention status --json
agent-kernel export ./agent-kernel-backup.json --redact --include-observations
agent-kernel import ./agent-kernel-backup.json --inspect --json
agent-kernel dashboard --no-open --json
agent-kernel report ./agent-kernel-report.html --json
```

Inspect before import. Do not commit raw exports or reports that may contain project evidence.

## Update and release discipline

User-side update flow:

```bash
agent-kernel update status --json
agent-kernel update check --force --json
agent-kernel update apply --agent <trusted-agent-id> --json
```

Repository release flow:

```bash
npm ci
npm run verify:release
npm run publish:dry
```

Before tagging, verify:

- all version surfaces agree
- docs links and docs contracts pass
- all smoke tests pass on supported Node versions
- Windows CI and CodeQL pass
- the target npm version is not already published
- the tag exactly matches `package.json`
- release workflows load successfully

After tagging, verify npm registry visibility, package integrity, GitHub Release assets, and `SHA256SUMS`.

## Command families

Use the canonical reference for the complete surface:

- core memory and guidance
- **Environment Vault** — secure `.env` storage, versioned revisions, conflict-safe restore
- search, context, sessions, episodes, and failures
- Architecture Guardian
- guards, linking, hooks, and MCP
- project connection, provider approvals, and audit
- agent and project identity registries
- commit evidence
- retention, export, import, dashboard, and reports
- updates and releases

See [docs/COMMAND_REFERENCE.md](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/COMMAND_REFERENCE.md).

## Agent compatibility

| Agent | Primary integration |
|---|---|
| Claude Code | `CLAUDE.md`, `AGENTS.md`, local MCP, narrow hooks, Claude skills |
| Codex | `AGENTS.md`, `.codex/AGENTS.md`, `.codex/config.toml`, `.agents/skills/` |
| Cursor | `.cursor/rules/00-agent-kernel.mdc`, local MCP |
| OpenCode | `AGENTS.md`, local MCP |
| Antigravity | `.agents/agents.md`, `.agents/skills/` |
| Gemini CLI | `GEMINI.md`, local MCP configuration |
| AGENTS.md-compatible tools | `AGENTS.md` and the AGENTS-compatible skill |

Do not claim native blocking hooks for an agent unless Agent Kernel ships and tests that adapter.

## Rules for agents using this skill

- Read current project instructions before changing files.
- Search memory and Failure Lessons before repeating known work.
- Use bounded context rather than loading the entire local store.
- Keep durable memory proposal-first unless the user explicitly approves direct storage.
- Never store secrets, `.env` values, provider tokens, service-account files, or auth material in memory or project manifests.
- Use safe-link and dry-run before editing existing guidance or hooks.
- Treat remote daemon mode, MCP approval, bypass mode, strict architecture enforcement, production provider approvals, and replacement imports as separate explicit decisions.
- Run targeted tests first, then the full release or repository gate required by the change.
- Update runtime docs, skill docs, discovery metadata, and regression checks together when behavior changes.

## Canonical documentation

- [Documentation map](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/README.md)
- [Command reference](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/COMMAND_REFERENCE.md)
- [Environment Vault](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/ENVIRONMENT_VAULT.md)
- [Environment variables](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/ENVIRONMENT_VARIABLES.md)
- [Install and agent setup](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/INSTALL_AND_AGENT_SETUP.md)
- [Troubleshooting](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/TROUBLESHOOTING.md)
- [Operating model](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/OPERATING_MODEL.md)
- [AI agent runbook](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/AGENT_RUNBOOK.md)
- [MCP server](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/MCP_SERVER.md)
- [Project connection](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/PROJECT_CONNECTION.md)
- [Architecture Guardian](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/ARCHITECTURE_GUARDIAN.md)
- [Secure runtime and releases](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/SECURE_RUNTIME_AND_RELEASES.md)
- [Skill contract](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/docs/SKILL_CONTRACT.md)

## Discovery

```bash
npx skills add imMamdouhaboammar/agent-kernel -a claude-code -g -y
npm install -g @mamdouh-aboammar/agent-kernel
```

Discovery surfaces:

```text
SKILL.md
skills.sh.json
skills/architecture-guardian/SKILL.md
.claude/skills/agent-kernel/SKILL.md
.claude/skills/architecture-guardian/SKILL.md
.agents/skills/agent-kernel/SKILL.md
.agents/skills/architecture-guardian/SKILL.md
.claude-plugin/marketplace.json
.claude-plugin/plugin.json
```

## License

MIT © Mamdouh Aboammar
