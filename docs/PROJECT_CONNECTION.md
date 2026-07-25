# Project Connection Command Suite

`agent-kernel project connect` connects any local software repository to the global Agent Kernel runtime without duplicating code, credentials, or agent state.

---

## Overview

Agent Kernel acts as a local-first governance kernel. When managing multiple projects across local repositories, coding agents must remain strictly isolated within project boundaries while sharing global policy, memory, failure lessons, and tool registries.

```text
  Local Repository (e.g. ~/Projects/App)
    ├── .agent-kernel/project.toml      # Project manifest & capability controls
    ├── .agent-kernel/policy.toml       # Local project safety gates
    ├── .gitignore                       # Managed runtime directory entries
    └── CLAUDE.md / AGENTS.md            # Managed instruction adapters
                       │
                       │ connected via Project Context Broker
                       ▼
  Global Agent Kernel (~/.agent-kernel/)
    ├── connections/registry.toml       # Global project connection registry
    ├── connections/active-session.json  # Active session leases & context
    ├── memory/                          # Cross-agent shared memory & Failure Lessons
    └── bin/agent-kernel                 # Single global executable runtime
```

---

## Preferred CLI Commands

| Command | Alias | Description |
| :--- | :--- | :--- |
| `agent-kernel project connect` | `agent-kernel connect` | Connects current directory to global Agent Kernel |
| `agent-kernel project status` | - | Displays project connection state and system readiness |
| `agent-kernel project doctor` | - | Runs 15+ integrity diagnostics on manifest and adapters |
| `agent-kernel project reconnect` | - | Repairs stale registries, missing adapters, or gitignore entries |
| `agent-kernel project disconnect` | `agent-kernel disconnect` | Safely removes global registration & managed blocks |
| `agent-kernel approvals request/list/approve/deny/revoke` | - | Controls one-time production provider authorization |
| `agent-kernel audit list/tail` | - | Reads provider and approval audit events for the current project only |
| `agent-kernel context enter/switch/current` | - | Creates and inspects a validated active project environment session |

---

## Fast Start

Run from inside any project directory using **Bun**:

```bash
# Navigate to your project root
cd ~/Projects/my-app

# Connect project to global kernel
agent-kernel project connect

# Or using Bunx without global installation:
bunx @mamdouh-aboammar/agent-kernel project connect

# Inspect connection status
agent-kernel project status

# Run diagnostics and auto-repair if needed
agent-kernel project doctor --fix
```

---

## Command Flags

### `agent-kernel project connect`

```bash
agent-kernel project connect [options]

Options:
  --path <dir>     Explicitly set project directory root
  --agents <list>  Comma-separated agents to install adapters for (e.g., claude,codex,cursor,all)
  --no-agent-files Skip writing managed agent instruction blocks (CLAUDE.md, AGENTS.md)
  --no-scripts     Skip injecting helper scripts into package.json
  --json           Output status in structured JSON format
  --dry-run        Simulate connection without modifying filesystem or registry
  --quiet          Suppress non-error log messages
  --yes            Accept safe default options non-interactively
```

### `agent-kernel project disconnect`

```bash
agent-kernel project disconnect [options]

Options:
  --keep-manifest   Preserve .agent-kernel/project.toml configuration (default)
  --remove-manifest Completely remove local .agent-kernel directory
  --dry-run         Simulate disconnection without file mutations
```

### `agent-kernel project doctor`

```bash
agent-kernel project doctor [options]

Options:
  --fix   Automatically repair missing footers, corrupted adapters, and stale registry entries
```

---

## Validated Context and Audit Inspection

`context enter` and `context switch` write an owner-only active session only after verifying that the requested project ID matches the current project manifest and that the environment is declared in that manifest. The stored session includes the project ID, environment, risk, repository UUID, root, timestamp, and active status.

```bash
agent-kernel context enter my-project production
agent-kernel context switch my-project staging --json
agent-kernel context current --json
```

`audit list` and `audit tail` read `~/.agent-kernel/logs/project-audit.jsonl`, filter events to the current manifest project, and return at most 1-500 records. Malformed unrelated log lines are counted and skipped rather than returned as project evidence.

```bash
agent-kernel audit list --limit 50
agent-kernel audit tail --limit 10 --json
```

Unknown or unsupported subcommands in routed broker families fail with a nonzero exit. Help exits successfully only when invoked without a command or with `help`, `-h`, or `--help`.

---

## Production Provider Approvals

Sensitive provider commands in an environment declared with `risk = "production"` require a short-lived approval scoped to the current project ID, environment, provider, and normalized operation. Approvals cannot authorize another project, environment, provider, account, project reference, region, or operation.

```bash
# Create a pending request
agent-kernel approvals request \
  --provider supabase \
  --operation db-push \
  --reason "Migration reviewed in change window"

# Review pending and historical records
agent-kernel approvals list
agent-kernel approvals list --status pending --json

# Resolve the request
agent-kernel approvals approve <approval-id> --ttl-minutes 15
agent-kernel approvals deny <approval-id> --reason "Change window closed"
agent-kernel approvals revoke <approval-id> --reason "Deployment cancelled"
```

Supported approval operations are `supabase:db-push`, `supabase:migration`, `gcloud:run`, and `gcloud:deploy`. Approval TTL must be an integer from 1 to 60 minutes. An approved record is consumed atomically by the first matching production command and cannot be replayed. Repeating `request` while a matching pending or unexpired approved record exists returns the active record instead of stacking another authorization.

The state machine is:

```text
pending -> approved -> consumed
       \-> denied
approved -> revoked
approved -> expired (derived after expiresAt)
```

Approval state is stored at `~/.agent-kernel/connections/approvals.json` with owner-only permissions. Mutations are lock-protected and atomic. A malformed state file causes commands to fail closed without overwriting the file. Request reasons are redacted before persistence, and request, approval, denial, revocation, and consumption actions are recorded in the provider audit log.

Read-only Supabase operations are explicitly allowlisted (`db pull`, `db dump`, `db lint`, and `migration list`). Unknown Supabase commands are classified as sensitive rather than read-only. Sensitive operations also require the mapped capability and environment risk metadata to be explicitly enabled in `project.toml`.

---

## Core Guarantees & Safety Architecture

### 1. Zero Runtime Duplication

Projects receive only lightweight manifest configuration (`.agent-kernel/project.toml`) and instruction references. The full Agent Kernel runtime remains centralized under `~/.agent-kernel`.

### 2. Idempotent Managed Blocks

All instruction file adapters and `.gitignore` entries use strict comment delimiters:

```markdown
<!-- >>> agent-kernel managed instructions >>> -->
This project is connected to Agent Kernel.
...
<!-- <<< agent-kernel managed instructions <<< -->
```

Running `connect` repeatedly will never duplicate blocks or corrupt user-written content.

### 3. Process-Safe Atomic Registry Writes

The global registry at `~/.agent-kernel/connections/registry.toml` is protected by mutex file-locking (`registry.toml.lock`) and atomic writes to prevent race conditions during concurrent execution.

Sanitized provider audit events use the same lock discipline and are written with owner-only permissions on POSIX filesystems. Windows validation preserves the audit content, redaction, and lock-recovery guarantees without treating synthesized NTFS POSIX mode bits as an access-control contract. Repository drift checks also work from Git worktrees, where `.git` is a file rather than a directory.

Provider execution strips the documented `--` separator before invoking the real CLI. Supabase always receives the manifest-bound `project_ref`. GCloud removes caller overrides for project, region, configuration, account, impersonation, and billing project, then applies the connected profile and manifest-bound target.

Provider executable discovery uses the operating system PATH delimiter, ignores non-executable path entries, and reports a nonzero exit when the underlying CLI cannot start. Generated command shims follow the same fail-closed behavior. On Windows, only absolute regular-file `supabase.cmd`/`supabase.bat` and `gcloud.cmd`/`gcloud.bat` launchers are delegated through the validated `%SystemRoot%\\System32\\cmd.exe` path; arbitrary batch launchers and general `shell: true` execution are rejected. Lock retries use an in-process synchronous wait rather than relying on an external `sleep` command.

### 4. Secret & Credential Boundary Preservation

Sensitive project files (`.env`, `service-account.json`, `id_rsa`, `*.pem`, `supabase/config.toml`, `.gcp/credentials.json`) are scanned by path classification only. Secret values are **never printed, logged, or recorded** in global registries.

Persistent `auth add` and `auth remove` operations are available only when Agent Kernel has a configured secure platform backend. The current persistent backend is macOS Keychain. Windows and Linux fail closed with exit code 2 rather than recording a credential reference that cannot be retrieved securely. Supabase provider execution on those platforms may use `SUPABASE_ACCESS_TOKEN` or `SUPABASE_TOKEN` from the current process environment; Agent Kernel does not write those values to disk or include them in audit output.

---

## Native Bun Support

Bun is fully supported for all workflow phases:

```bash
# Installation
bun install -g @mamdouh-aboammar/agent-kernel

# Package Execution
bunx agent-kernel project connect

# Package Scripts (automatically injected into package.json)
bun run kernel:status
bun run kernel:doctor
```
