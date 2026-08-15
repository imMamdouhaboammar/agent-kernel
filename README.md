<div align='center'>

<img src='./docs/brand/agent-kernel-wordmark.svg' alt='Agent Kernel wordmark' width='440' />

<h1>Agent Kernel</h1>

<p><strong>Local memory, trust boundaries, environment continuity, and architecture controls for AI coding agents</strong></p>

<p>
Install once and give Claude Code, Codex, Cursor, Gemini CLI, OpenCode, Antigravity, Kiro, OpenClaw, and AGENTS.md-compatible tools one reviewed source for repository rules, user preferences, environment files, workflows, debugging lessons, architecture policies, and generated agent instructions
</p>

<p>
  <a href='https://github.com/imMamdouhaboammar/agent-kernel/releases/latest'><img alt='release' src='https://img.shields.io/github/v/release/imMamdouhaboammar/agent-kernel?style=flat-square&color=38BDF8&label=release&logo=github&logoColor=white&labelColor=050505'></a>
  <a href='https://www.npmjs.com/package/@mamdouh-aboammar/agent-kernel'><img alt='npm version' src='https://img.shields.io/npm/v/@mamdouh-aboammar/agent-kernel?style=flat-square&color=F8F46A&logo=npm&logoColor=white&labelColor=050505'></a>
  <a href='https://www.npmjs.com/package/@mamdouh-aboammar/agent-kernel'><img alt='npm downloads' src='https://img.shields.io/npm/dw/@mamdouh-aboammar/agent-kernel?style=flat-square&color=10B981&logo=npm&logoColor=white&labelColor=050505'></a>
  <a href='https://github.com/imMamdouhaboammar/agent-kernel/actions/workflows/ci.yml'><img alt='CI' src='https://img.shields.io/badge/CI-tested-10B981?style=flat-square&logo=githubactions&logoColor=white&labelColor=050505'></a>
  <a href='https://github.com/imMamdouhaboammar/agent-kernel/actions/workflows/codeql.yml'><img alt='CodeQL' src='https://img.shields.io/badge/CodeQL-enabled-10B981?style=flat-square&logo=github&logoColor=white&labelColor=050505'></a>
  <img alt='node' src='https://img.shields.io/badge/node-%3E%3D18.18.0-30363d?style=flat-square&logo=nodedotjs&logoColor=white&labelColor=050505'>
  <img alt='runtime dependencies' src='https://img.shields.io/badge/runtime_deps-0-10B981?style=flat-square&labelColor=050505'>
  <a href='./LICENSE'><img alt='license' src='https://img.shields.io/badge/license-MIT-30363d?style=flat-square&labelColor=050505'></a>
</p>

<p>
  <strong>Current stable release: <a href='https://www.npmjs.com/package/@mamdouh-aboammar/agent-kernel'>v1.20.1</a></strong><br />
  Includes Multi-Scoped Persistent Memory, Failure Lessons, approved update workflows, Universal Skills, Environment Vault, and Architecture Guardian
</p>

<img src='https://raw.githubusercontent.com/imMamdouhaboammar/agent-kernel/master/docs/brand/agent-strip.svg' alt='Agent Kernel supported agent stack' width='900' />

</div>

<!-- project-story:start -->
<details open>
  <summary><strong>Problem to project: Why I built Agent Kernel</strong></summary>
  <br />
  <p align="center"><img src="https://raw.githubusercontent.com/imMamdouhaboammar/imMamdouhaboammar/main/assets/profile/project-badges.svg" width="488" alt="Real friction, building in public, daily pulse" /></p>
  <table>
    <tr>
      <td width="104" align="center" valign="middle"><img src="./docs/brand/agent-kernel-logo.svg" width="76" alt="Agent Kernel repository mark" /></td>
      <td valign="middle"><strong>Agent Kernel</strong><br />A local memory and governance layer for the AI coding agents developers already use.</td>
    </tr>
  </table>
  <table>
    <tr>
      <td width="50%" valign="top"><strong>Recurring problem</strong><br />Coding agents repeatedly lose repository context, repeat rejected mistakes, and weaken architecture boundaries across sessions.</td>
      <td width="50%" valign="top"><strong>Practical goal</strong><br />Keep durable local memory, reviewed rules, failure lessons, and architecture controls around existing coding agents without replacing them.</td>
    </tr>
    <tr>
      <td width="50%" valign="top"><strong>Built for</strong><br />Developers and teams using Claude Code, Codex, Cursor, Gemini CLI, OpenCode, or AGENTS.md-compatible tools.</td>
      <td width="50%" valign="top"><strong>Search terms</strong><br />AI coding agent memory · local agent governance · architecture guardrails · coding agent context</td>
    </tr>
  </table>
  <p><strong>Daily build pulse</strong></p>
  <ul>
      <li>3 pull requests updated, led by #132: chore(deps): bump github/codeql-action/init from 4.37.4 to 4.37.6.</li>
      <li>Daily summary covers 3 public activity items from the last 7 days.</li>
      <li>Documentation and project status remain aligned with the repository’s current public state.</li>
  </ul>
</details>
<!-- project-story:end -->

---

## What Agent Kernel adds

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│                              AGENT KERNEL                                     │
├──────────────────────────┬──────────────────────────┬─────────────────────────┤
│ Reviewed local memory    │ Project Environment Vault│ Architecture Guardian   │
│ Rules and preferences    │ Identity and revisions   │ Policies and contracts  │
│ Approval inbox           │ Safe restore and watcher │ Baselines and reports   │
├──────────────────────────┴──────────────────────────┴─────────────────────────┤
│ ContextFS · Universal Skills · Failure Lessons · Agent integrations          │
└───────────────────────────────────────────────────────────────────────────────┘
```

| Recurring problem | Agent Kernel response |
|---|---|
| Rules are repeated in every prompt | Durable reviewed memory compiled into agent-readable files |
| Claude, Codex, Cursor, and Gemini drift from each other | One source distributed to supported agent surfaces |
| Context gets large or retrieval is hard to explain | ContextFS with virtual `ak://` URIs, progressive L0/L1/L2 reads, deterministic hierarchy-aware retrieval, budgets, and traces |
| Local `.env` files disappear after a fresh clone | Environment Vault with stable identity, revisions, missing-only restore, conflicts, and backups |
| Agents need repository-specific operating instructions | Universal Skills copied into supported agent directories |
| The same build or test failure returns | Failure Lessons with command, error, cause, fix, and evidence |
| AI-generated code creates structural drift | Architecture policies, contracts, baselines, reuse search, and checks |
| An agent identifies a useful rule | Proposal inbox with explicit review and publication |
| A hosted control plane is unwanted | Local Node CLI, optional hooks, MCP tools, and zero runtime dependencies |

---

## ContextFS

ContextFS projects Agent Kernel's existing local records behind a virtual `ak://` namespace. The original JSON and JSONL stores remain authoritative.

```bash
# Browse the virtual tree
agent-kernel context tree ak:// --json

# Read compact or detailed projections
agent-kernel context read ak://global/memory/<id> --level 0 --json
agent-kernel context read ak://global/memory/<id> --level 1 --json
agent-kernel context read ak://global/memory/<id> --level 2 --json

# Search hierarchically with project/file locality and an explainable trace
agent-kernel context find "restore conflict" \
  --under ak://global/ \
  --project-id my-project \
  --file src/env-vault/engine.mjs \
  --budget 1200 \
  --trace \
  --json

# Record which context was actually used during a session
agent-kernel context used <session-id> ak://global/failures/<id> \
  --reason "pre-edit check" \
  --result helpful \
  --json

# Preview candidate durable lessons without writing
agent-kernel context commit <session-id> --dry-run --json

# Materialize novel candidates as pending proposals only
agent-kernel context commit <session-id> --json
```

L0 is a compact abstract, L1 is a structured overview, and L2 is opt-in authoritative detail. Hierarchical `find` never loads L2 automatically.

Session commit is review-first. It deduplicates candidate text against approved memory and pending proposals, writes local session commit metadata, and uses the existing proposal inbox for novel candidates. It never auto-approves or publishes durable memory.

Phase 1 is deterministic and local. It requires no vector database, embeddings, LLM, daemon, cloud service, or new runtime dependency.

Read [`docs/CONTEXTFS.md`](./docs/CONTEXTFS.md) for the URI contract, retrieval behavior, security boundaries, clean-room licensing boundary, and rollback path.

---

## Install

### Universal installer

```bash
curl -sSL https://raw.githubusercontent.com/imMamdouhaboammar/agent-kernel/master/install.sh | bash
```

### npm

```bash
npm install -g @mamdouh-aboammar/agent-kernel
agent-kernel setup
```

### Bun

```bash
bun install -g @mamdouh-aboammar/agent-kernel
agent-kernel setup
```

### Run without global installation

```bash
npx -y @mamdouh-aboammar/agent-kernel setup
```

Requires Node.js `>=18.18.0` or Bun `>=1.0.0`

Read [`docs/INSTALL_AND_AGENT_SETUP.md`](./docs/INSTALL_AND_AGENT_SETUP.md) for agent-specific installation details

---

## ⚡ Quick-start prompt — copy and paste into any AI coding agent

> Paste the block below into Claude Code, Cursor, Gemini CLI, Codex, or any `AGENTS.md`-compatible agent.
> The agent will install or upgrade Agent Kernel, connect your project, activate all tools, save your environment files, and enable the watcher.

````
You are setting up Agent Kernel in this project. Execute the following steps in order, stopping and reporting any failure before continuing.

## Step 1 — Install or upgrade Agent Kernel

Check if agent-kernel is already installed:

```bash
agent-kernel --version 2>/dev/null || echo "NOT_INSTALLED"
```

If NOT_INSTALLED, install with Bun (preferred) or npm:

```bash
# With Bun (preferred — requires Bun >= 1.0.0)
bun install -g @mamdouh-aboammar/agent-kernel

# Or with npm (requires Node.js >= 18.18.0)
npm install -g @mamdouh-aboammar/agent-kernel
```

If already installed, upgrade to the latest version:

```bash
agent-kernel update
```

Confirm the installed version:

```bash
agent-kernel --version
```

## Step 2 — Initialize and connect this project

Initialize the local Agent Kernel home if this is a fresh machine:

```bash
agent-kernel init --sync
agent-kernel doctor
```

Connect this repository to Agent Kernel:

```bash
agent-kernel project connect --yes
agent-kernel project status --json
```

## Step 3 — Link and activate all agent tools

Compile rules and link generated guidance into all supported agent surfaces (AGENTS.md, CLAUDE.md, Cursor rules, Gemini config):

```bash
agent-kernel compile
agent-kernel-safe-link .
```

Install MCP tools so every connected agent can call Agent Kernel capabilities:

```bash
agent-kernel mcp install claude
agent-kernel mcp install codex
```

Install safety hooks:

```bash
agent-kernel-safe-git-hook .
```

Verify all tools are active:

```bash
agent-kernel status
agent-kernel doctor
```

## Step 4 — Save environment files (Environment Vault)

Discover and link all .env files in this project:

```bash
agent-kernel env link .
```

Push all current .env files to the vault exactly as they are — do NOT modify file contents:

```bash
agent-kernel env push .
```

Confirm the vault is healthy and all files are stored:

```bash
agent-kernel env status . --json
```

## Step 5 — Enable the environment watcher (mirror mode)

Start watching .env files for changes and automatically mirror them to the vault:

```bash
agent-kernel env watch .
```

## Done — confirm the full setup

Run a final health check and report the output:

```bash
agent-kernel doctor
agent-kernel env status . --json
agent-kernel project status --json
```

Report: version installed, number of env files stored, project identity fingerprint, and which agent surfaces received compiled guidance.
````

---

## Project Environment Vault

Environment Vault stores project environment files only on the current machine under

```text
${AGENT_KERNEL_HOME:-~/.agent-kernel}/vault/env/<full-sha256>/
```

It derives identity from a canonical Git remote, then the initial commit, with path identity available only through explicit opt-in

SSH and HTTPS forms for the same GitHub repository resolve to one fingerprint

```bash
# Discover and link .env files recursively
agent-kernel env link

# Inspect identity, health, conflicts, and permissions
agent-kernel env status

# Store local edits and create revisions
agent-kernel env push

# Restore missing files without overwriting differing local files
agent-kernel env pull

# Force an intentional overwrite after creating a local backup
agent-kernel env pull --force

# Diagnose metadata, missing files, and owner-only permissions
agent-kernel env doctor

# Watch files edited outside Agent Kernel hooks
agent-kernel env watch
```

Monorepo paths can be selected explicitly

```bash
agent-kernel env link \
  --include apps/api/.env \
  --include apps/web/.env.local
```

`unlink` retains stored files and revisions

`purge --yes` performs explicit destructive deletion

Read [`docs/ENVIRONMENT_VAULT.md`](./docs/ENVIRONMENT_VAULT.md) for the command contract, storage model, migration, watcher behavior, and threat boundaries

---

## Universal Agent Skills

```bash
agent-kernel skills list
agent-kernel skills inspect agent-kernel-ops
agent-kernel skills sync
```

Agent Kernel ships operational skills and synchronizes them to supported agent directories such as `~/.claude/skills`, `~/.codex/skills`, `~/.gemini/config/skills`, and `~/.agents/skills`

---

## Failure Lessons and self-evolve workflows

```bash
agent-kernel failure capture
agent-kernel failure list
agent-kernel failure search <query>
agent-kernel evolve generate --title "Full Supabase Setup" --topic "auth"
agent-kernel evolve list
agent-kernel evolve inspect <playbookId>
agent-kernel evolve hooks
```

Failure Lessons preserve evidence from unsuccessful commands and verified remedies

Self-evolve workflows turn reviewed execution patterns into versioned local playbooks

---

## Architecture Guardian

```bash
cd ~/Projects/YourProject

agent-kernel architecture init .
agent-kernel architecture policy validate .
agent-kernel architecture discover . --json
agent-kernel architecture baseline . --json

agent-kernel architecture contract init . \
  --task 'Add subscription cancellation' \
  --owner billing \
  --allow 'src/billing/**,test/billing/**' \
  --expect 'src/billing/cancel-subscription.ts'

agent-kernel architecture reuse 'cancel subscription' . --json
agent-kernel architecture check . --json
```

Read [`docs/ARCHITECTURE_GUARDIAN.md`](./docs/ARCHITECTURE_GUARDIAN.md) and [`skills/architecture-guardian/`](./skills/architecture-guardian/)

---

## Local Memory Dashboard

```bash
agent-kernel dashboard
```

The dashboard is written atomically to `~/.agent-kernel/reports/dashboard.html`, uses no network requests, redacts known credential patterns, and applies a restrictive Content Security Policy

Read [`docs/STATIC_MEMORY_DASHBOARD.md`](./docs/STATIC_MEMORY_DASHBOARD.md)

---

## Agent integrations

| Agent or surface | Output or integration |
|---|---|
| Claude Code | `CLAUDE.md`, context and architecture hooks, MCP config, marketplace plugin, repo-local skills |
| Antigravity | `.agents/agents.md`, `.agents/skills/*`, hooks |
| Cursor | `.cursor/rules/00-agent-kernel.mdc` |
| Codex | `AGENTS.md`, `.codex/AGENTS.md`, `.codex/config.toml`, repo-local skills |
| Gemini CLI | `GEMINI.md` |
| OpenCode and OpenClaw | `AGENTS.md`, hooks |
| Kiro and Skills.sh | `SKILL.md`, `skills.sh.json` |

---

## Core command reference

```text
agent-kernel setup
agent-kernel env link|status|push|pull|watch|doctor|history|restore|list|unlink|purge
agent-kernel skills list|inspect|sync|install
agent-kernel evolve generate|list|inspect|repair|hooks
agent-kernel init [--sync] [--enforce]
agent-kernel doctor [--runtime]
agent-kernel compile
agent-kernel sync
agent-kernel remember <text> [--type rule] [--publish]
agent-kernel propose --from <agent> --text <text> --reason <reason>
agent-kernel inbox
agent-kernel approve <id> [--publish]
agent-kernel reject <id>
agent-kernel context tree|read|find|used|commit
agent-kernel dashboard [--out file.html] [--json]
agent-kernel architecture init|discover|baseline|check|reuse|contract
agent-kernel failure capture|learn|list|search|show|propose
agent-kernel retention status|prune
agent-kernel export <file.json>
agent-kernel import <file.json>
```

---

## Documentation

Start with [`docs/README.md`](./docs/README.md)

| Need | Read |
|---|---|
| Install and connect agents | [`docs/INSTALL_AND_AGENT_SETUP.md`](./docs/INSTALL_AND_AGENT_SETUP.md) |
| Complete command reference | [`docs/COMMAND_REFERENCE.md`](./docs/COMMAND_REFERENCE.md) |
| ContextFS virtual context and retrieval | [`docs/CONTEXTFS.md`](./docs/CONTEXTFS.md) |
| Project Environment Vault | [`docs/ENVIRONMENT_VAULT.md`](./docs/ENVIRONMENT_VAULT.md) |
| Environment variables | [`docs/ENVIRONMENT_VARIABLES.md`](./docs/ENVIRONMENT_VARIABLES.md) |
| Skill contract and synchronization | [`docs/SKILL_CONTRACT.md`](./docs/SKILL_CONTRACT.md) |
| Secure runtime and release operations | [`docs/SECURE_RUNTIME_AND_RELEASES.md`](./docs/SECURE_RUNTIME_AND_RELEASES.md) |
| Failure Lessons protocol | [`docs/FAILURE_LESSONS_PROTOCOL.md`](./docs/FAILURE_LESSONS_PROTOCOL.md) |
| Architecture checks | [`docs/ARCHITECTURE_GUARDIAN.md`](./docs/ARCHITECTURE_GUARDIAN.md) |
| Local memory dashboard | [`docs/STATIC_MEMORY_DASHBOARD.md`](./docs/STATIC_MEMORY_DASHBOARD.md) |
| Trusted CLI updates | [`docs/UPDATES.md`](./docs/UPDATES.md) |
| Safe project linking | [`docs/SAFE_LINKING.md`](./docs/SAFE_LINKING.md) |
| Safe Git hook installation | [`docs/SAFE_GIT_HOOKS.md`](./docs/SAFE_GIT_HOOKS.md) |
| Troubleshooting | [`docs/TROUBLESHOOTING.md`](./docs/TROUBLESHOOTING.md) |

---

## Development and verification

```bash
git clone https://github.com/imMamdouhaboammar/agent-kernel
cd agent-kernel
npm ci
npm run verify:release
npm run docs:check
```

---

## License

MIT © [Mamdouh Aboammar](https://github.com/imMamdouhaboammar)