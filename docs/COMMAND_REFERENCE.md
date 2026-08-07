# Command reference

This is the canonical user-facing command map for Agent Kernel `1.20.1`.

The `agent-kernel` and `ak` commands route to focused runtime helpers. Use the routed command unless a helper binary is required by an integration, hook, or recovery procedure.

## Conventions

- Paths default to the current project where applicable.
- `AGENT_KERNEL_HOME` defaults to `~/.agent-kernel`.
- Commands that support `--json` should be preferred in automation.
- Unknown commands and invalid identifiers return a nonzero exit.
- Durable memory approval, production provider access, and remote daemon access are separate trust boundaries.

## Core memory and guidance

| Command | Purpose |
|---|---|
| `agent-kernel init [--sync] [--enforce]` | Initialize the local home, optionally compile guidance and install supported enforcement. |
| `agent-kernel doctor [--runtime]` | Diagnose local memory, generated outputs, and optional runtime state. |
| `agent-kernel compile` | Compile approved source memory into generated guidance. |
| `agent-kernel sync` | Refresh global agent-facing outputs. |
| `agent-kernel link [project] [--hooks]` | Use the main linker in a controlled project. Prefer safe-link for existing hand-written files. |
| `agent-kernel remember "text" [options] [--publish]` | Store user-approved durable memory. |
| `agent-kernel propose --from <agent> --text "..." --reason "..."` | Create a pending memory proposal. |
| `agent-kernel inbox` | List pending proposals. |
| `agent-kernel approve <proposal-id> [--publish]` | Approve a pending proposal. |
| `agent-kernel reject <proposal-id>` | Reject a pending proposal. |
| `agent-kernel publish` | Compile and distribute approved memory. |
| `agent-kernel validate` | Validate memory and generated state. |
| `agent-kernel migrate json [--publish]` | Migrate compatible legacy memory into JSON-first storage. |
| `agent-kernel memory` with `list`, `search`, or `show` | Inspect approved memory. |

Common memory options include `--type`, `--scope`, `--level`, `--targets`, and `--tags`. Agents should create proposals; they should not silently approve or publish.

## Project Environment Vault

Environment Vault stores selected project environment files locally under the configured Agent Kernel home

```text
${AGENT_KERNEL_HOME:-~/.agent-kernel}/vault/env/<full-sha256>/
```

| Command | Purpose |
|---|---|
| `agent-kernel env link [project] [options]` | Resolve stable project identity, discover environment files, create the version 2 manifest, and store initial revisions |
| `agent-kernel env status [project] [--json]` | Report identity, health, selected files, conflicts, missing files, and permission drift without secret contents |
| `agent-kernel env push [project] [--file path] [--prune] [--dry-run]` | Store changed local files and create revisions |
| `agent-kernel env pull [project] [--file path] [--force] [--no-backup] [--dry-run]` | Restore missing files and refuse differing local content unless force is explicit |
| `agent-kernel env watch [project] [--interval seconds]` | Watch linked file parents with debounce and periodic reconciliation |
| `agent-kernel env doctor [project] [--repair-permissions] [--migrate]` | Validate manifests, stored files, locks, permissions, and optional legacy migration |
| `agent-kernel env history [project] [--file path] [--json]` | List revision metadata without secret content |
| `agent-kernel env restore [project] --file path --revision id [--force]` | Restore a selected revision through the same conflict and backup rules as pull |
| `agent-kernel env list [--json]` | List local Vault identities, health, linked paths, and file names |
| `agent-kernel env unlink [project]` | Detach the current path while retaining stored files and revisions |
| `agent-kernel env purge [project] --yes` | Delete stored data for the exact resolved identity |

Common link options

```text
--include path
--exclude pattern
--allow-empty
--allow-path-identity
--max-bytes number
--json
```

Common SSH and HTTPS forms for the same repository resolve to one identity

Path identity requires explicit opt-in and does not survive moving the project folder

Normal pull and automatic session restore do not overwrite differing local files

Forced restore creates a backup under `<project>/.agent-kernel/env-backups/<timestamp>/` unless `--no-backup` is explicit

Vault directories use `0700` and protected files use `0600` on POSIX systems

Read `docs/ENVIRONMENT_VAULT.md` for discovery rules, migration, storage behavior, and threat boundaries

## Search, context, and runtime evidence

| Command | Purpose |
|---|---|
| `agent-kernel reindex` | Rebuild the structured search index. |
| `agent-kernel search <query> [--type] [--files] [--commands] [--explain]` | Search memory, failures, episodes, commands, and file references. |
| `agent-kernel context [query] [--project-id id] [--file path] [--budget n]` | Render bounded task or project context through the existing flat context helper. |
| `agent-kernel context tree [ak://...] [--depth n] [--json]` | Browse the virtual ContextFS namespace without exposing physical storage paths. |
| `agent-kernel context read <ak://uri> [--level 0|1|2] [--json]` | Read a ContextFS record progressively as L0 abstract, L1 overview, or opt-in L2 detail. |
| `agent-kernel context find <query> [--under ak://...] [--project-id id] [--file path] [--budget n] [--limit n] [--trace] [--json]` | Perform deterministic hierarchy-aware retrieval with project/file locality, budget accounting, and optional trace output. |
| `agent-kernel context used <session-id> <ak://uri> [--reason text] [--result value] [--json]` | Append `context_used` evidence to a session without creating durable memory. |
| `agent-kernel context commit <session-id> [--dry-run] [--json]` | Extract deterministic candidate lessons, deduplicate them, and create pending proposals only. Never auto-approves memory. |
| `agent-kernel file-context <file...>` | Build file-specific context through the file-record adapter. |
| `agent-kernel session start --agent <id> [--project .]` | Start a local runtime session. |
| `agent-kernel session end <session-id>` | End a session. |
| `agent-kernel session` with `list` or `show` | Inspect session metadata. |
| `agent-kernel session observe <session-id> --type <type> --text <text>` | Append a bounded observation. |
| `agent-kernel session observations <session-id> [filters]` | Search observations for one session. |
| `agent-kernel session timeline <session-id> [filters]` | Render a chronological session timeline. |
| `agent-kernel session compact <session-id> [--dry-run]` | Deterministically compact old raw observations. |

ContextFS uses virtual `ak://` identifiers. It rejects foreign schemes, traversal and encoded traversal, backslashes, NUL bytes, query strings, fragments, and unsafe session identifiers before record access. L2 is opt-in, `context find` does not load L2, and `context commit` writes only commit metadata plus pending inbox proposals.

Session, proposal, episode, and other file-backed IDs are identifiers, not paths. Path separators and traversal-like values are rejected before filesystem access.

See `docs/CONTEXTFS.md` for the namespace contract, progressive levels, retrieval behavior, session evidence, commit governance, clean-room boundary, and rollback notes.

## Optional daemon

```bash
agent-kernel daemon start [--host 127.0.0.1] [--port 3999]
agent-kernel daemon status [--json]
agent-kernel daemon restart
agent-kernel daemon stop
```

The daemon is local-only by default. A non-loopback bind requires:

```bash
export AGENT_KERNEL_DAEMON_ALLOW_REMOTE=1
export AGENT_KERNEL_DAEMON_TOKEN="$(openssl rand -hex 32)"
```

Remote clients must send `Authorization: Bearer <token>`. Request bodies are capped at 1 MiB. Do not expose the daemon directly to the public internet.

## Episodes and Failure Lessons

| Command | Purpose |
|---|---|
| `agent-kernel episode` with `add`, `sync`, `search`, `show`, `stats`, or `reindex` | Store and search historical decisions and session summaries. |
| `agent-kernel failure capture` | Capture or deduplicate redacted failure evidence. |
| `agent-kernel failure learn` | Capture a failure with known root cause and fix. |
| `agent-kernel failure` with `list`, `search`, `show`, or `validate` | Inspect Failure Lessons. |
| `agent-kernel failure propose <id> --as <type>` | Create a pending durable-memory proposal from a lesson. |
| `agent-kernel failure patterns` | Inspect repeated failure patterns. |
| `agent-kernel failure propose-pattern` | Propose durable guidance from a reviewed pattern. |

Failure evidence is not approved memory. Promotion remains proposal-first.

## Architecture Guardian

```bash
agent-kernel architecture init [project]
agent-kernel architecture doctor [project] [--json]
agent-kernel architecture discover [project] [--json]
agent-kernel architecture reuse <query> [project] [--json]
agent-kernel architecture baseline [project] [--json]
agent-kernel architecture diff [project] [--json]
agent-kernel architecture contract init|show|validate|close [project]
agent-kernel architecture exception add|list|revoke [project]
agent-kernel architecture policy validate [project]
agent-kernel architecture check [project] [--files a,b] [--base ref] [--strict|--review] [--json]
```

Start in review mode. Use strict mode only after policy, baseline, contract, and exception state have been reviewed. See `docs/ARCHITECTURE_GUARDIAN.md`.

## Guards, linking, and hooks

| Command | Purpose |
|---|---|
| `agent-kernel guard --command "..."` | Evaluate a command against deterministic safety rules. |
| `agent-kernel guard --staged` | Evaluate staged files. |
| `agent-kernel guard --file <path>` | Evaluate a file. |
| `agent-kernel enforce install` | Install supported enforcement surfaces. |
| `agent-kernel git-hook install [project]` | Install the main pre-commit integration. |
| `agent-kernel git-hook install --commit-link [project]` | Install commit-to-evidence linking. |
| `agent-kernel-safe-link [project] [--dry-run] [--force]` | Update only managed guidance blocks, preserving user content. |
| `agent-kernel-safe-git-hook [project] [--dry-run] [--force]` | Update only the managed pre-commit block. |

Use dry-run before modifying an existing project. `--force` repairs malformed Agent Kernel markers; it is not a general overwrite flag.

## MCP

```bash
agent-kernel mcp serve
agent-kernel mcp test
agent-kernel mcp config claude
agent-kernel mcp install claude
```

Core mode exposes ten bounded tools for status, memory search, context, proposals, guard checks, Failure Lessons, and episode search. Extended mode is explicit:

```bash
AGENT_KERNEL_MCP_TOOLS=extended agent-kernel mcp serve
```

MCP approval requires extended mode plus `AGENT_KERNEL_MCP_ALLOW_APPROVE=1`. Publish and delete tools are never exposed.

## Project Context Broker

| Command | Purpose |
|---|---|
| `agent-kernel project connect [options]` | Connect a repository to the global kernel without duplicating runtime or credentials. |
| `agent-kernel project status [--json]` | Inspect connection state. |
| `agent-kernel project doctor [--fix]` | Validate and repair managed connection state. |
| `agent-kernel project reconnect` | Rebuild stale managed adapters and registry state. |
| `agent-kernel project disconnect [options]` | Remove managed connection state conservatively. |
| `agent-kernel project` with `init`, `register`, `inspect`, or `verify` | Manage lower-level project manifests and validation. |
| `agent-kernel context` with `enter` or `switch`, a project ID, and an environment | Create a validated active project/environment session. |
| `agent-kernel context current [--json]` | Inspect the active context. |
| `agent-kernel audit list [--limit n] [--json]` | Read project-scoped provider and approval audit events. |
| `agent-kernel approvals` with `request`, `list`, `approve`, `deny`, or `revoke` | Manage short-lived production provider approvals. |
| `agent-kernel auth` with `add`, `list`, or `remove` | Manage provider profiles through the supported secure backend. |
| `agent-kernel provider supabase exec -- <command>` | Run Supabase with manifest-bound project targeting. |
| `agent-kernel provider gcloud exec -- <command>` | Run GCloud with manifest-bound project, region, and profile targeting. |

Provider profile names are validated before keychain lookup or configuration-path use. Caller-provided target overrides are removed before provider execution.

## Agent and project identity registries

```bash
agent-kernel agent list [--json]
agent-kernel agent add <id> [--trust read-only] [--name name] [--surface cli]
agent-kernel agent set <id> [--trust propose-only]
agent-kernel agent show <id> [--json]
agent-kernel agent remove <id>
agent-kernel project identify [path] [--id project-id] [--json]
agent-kernel project list [--json]
agent-kernel project show <project-id> [--json]
agent-kernel project set-id <path> <project-id> [--json]
```

Agent identity trust (`read-only`, `capture-only`, `propose-only`, `trusted-local`) is separate from the global memory write mode (`approval`, `trusted`, `bypass`).

## Commit evidence

```bash
agent-kernel commit link --sha <sha> --session <id> [--failure id] [--episode id] [--files a,b]
agent-kernel commit list [--json]
agent-kernel commit show <sha> [--json]
agent-kernel commit context <sha> [--budget 2400] [--json]
```

Commit links connect Git history to sessions, failures, episodes, and files. Linked IDs are validated before local record access.

## Retention, portability, and reporting

```bash
agent-kernel retention status [--json]
agent-kernel retention prune --dry-run [--older-than 30d]
agent-kernel retention prune --force [--older-than 30d]
agent-kernel export <file.json> [--redact] [--scope approved] [--include-observations]
agent-kernel import <file.json> [--inspect|--to inbox|--replace]
agent-kernel view [sessions|failures|inbox|agents] [--json]
agent-kernel report <file.html> [--json]
agent-kernel dashboard [--out file.html] [--project path] [--no-open|--open] [--json]
```

Inspect imports before applying them. Redacted export is the default choice for sharing or backup review. The dashboard and report are static local artifacts, not hosted services.

## Updates

```bash
agent-kernel update status [--json]
agent-kernel update check [--force] [--json]
agent-kernel update enable --agents claude,codex [--yes] [--json]
agent-kernel update disable [--yes] [--json]
agent-kernel update channel <latest|next|semver> [--yes] [--json]
agent-kernel update trust <agent-id> [--yes] [--json]
agent-kernel update revoke <agent-id> [--yes] [--json]
agent-kernel update apply --agent <agent-id> [--json]
```

Updates are exact-version installs with post-install verification and rollback guidance. Agent-approved mode does not let an untrusted agent silently update the global package.

## Public binaries

The npm package exposes these executable names:

| Binary | Intended use |
|---|---|
| `agent-kernel` | Canonical routed CLI. |
| `ak` | Short alias for `agent-kernel`. |
| `agent-kernel-search` | Structured search helper. |
| `agent-kernel-claude-context-hook` | Claude context hook adapter. |
| `agent-kernel-safe-link` | Managed project guidance installer. |
| `agent-kernel-safe-git-hook` | Managed pre-commit installer. |
| `agent-kernel-agent-propose` | Restricted pending-proposal helper. |
| `agent-kernel-failure` | Failure Lessons helper. |
| `agent-kernel-failure-hook` | Failure capture hook adapter. |
| `agent-kernel-daemon` | Optional HTTP runtime daemon. |
| `agent-kernel-runtime-doctor` | Focused runtime diagnosis. |
| `agent-kernel-session` | Session and observation helper. |
| `agent-kernel-context` | Bounded context helper. |
| `agent-kernel-mode` | Global memory write mode selector. |
| `agent-kernel-agent-write` | Mode-aware memory write/proposal helper. |
| `agent-kernel-architecture` | Architecture Guardian CLI. |
| `agent-kernel-architecture-hook` | Architecture scope hook adapter. |
| `agent-kernel-project-broker` | Direct Project Context Broker entry point. |

Hook and integration docs may invoke focused binaries directly. Interactive users should normally prefer `agent-kernel`.

## Exit and automation guidance

- Use `--json` when a command supports it.
- Treat any nonzero exit as a failed operation unless a command explicitly documents a review-mode result.
- Architecture strict blockers use a nonzero exit; review mode reports without blocking.
- Provider and approval commands fail closed on malformed or unavailable secure state.
- Never parse human output when a JSON surface exists.