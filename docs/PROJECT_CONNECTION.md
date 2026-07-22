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

Sanitized provider audit events use the same lock discipline and are written with owner-only permissions. Recognized secret values are redacted before persistence. Repository drift checks also work from Git worktrees, where `.git` is a file rather than a directory.

Provider execution strips the documented `--` separator before invoking the real CLI. Supabase always receives the manifest-bound `project_ref`. GCloud removes caller overrides for project, region, configuration, account, impersonation, and billing project, then applies the connected profile and manifest-bound target.

Provider executable discovery uses the operating system PATH delimiter, ignores non-executable path entries, and reports a nonzero exit when the underlying CLI cannot start. Generated command shims follow the same fail-closed behavior. Lock retries use an in-process synchronous wait rather than relying on an external `sleep` command.

### 4. Secret & Credential Boundary Preservation
Sensitive project files (`.env`, `service-account.json`, `id_rsa`, `*.pem`, `supabase/config.toml`, `.gcp/credentials.json`) are scanned by path classification only. Secret values are **never printed, logged, or recorded** in global registries.

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
