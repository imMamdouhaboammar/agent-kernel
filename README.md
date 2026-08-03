<div align='center'>

<img src='./docs/brand/agent-kernel-wordmark.svg' alt='Agent Kernel wordmark' width='440' />

<h1>Agent Kernel</h1>

<p><strong>Local memory, trust boundaries, environment vault, and self-learning architecture controls for AI coding agents.</strong></p>

<p>
Install once. Give Claude Code, Codex, Cursor, Gemini CLI, OpenCode, Antigravity, Kiro, OpenClaw, and AGENTS.md-compatible tools one shared source of truth for repository rules, user preferences, environment keys, workflows, debugging lessons, architecture policies, and generated agent instructions.
</p>

<p>
  <a href='https://github.com/imMamdouhaboammar/agent-kernel/releases/latest'><img alt='release' src='https://img.shields.io/github/v/release/imMamdouhaboammar/agent-kernel?style=flat-square&color=38BDF8&label=release&logo=github&logoColor=white&labelColor=050505'></a>
  <a href='https://www.npmjs.com/package/@mamdouh-aboammar/agent-kernel'><img alt='npm version' src='https://img.shields.io/npm/v/@mamdouh-aboammar/agent-kernel?style=flat-square&color=F8F46A&logo=npm&logoColor=white&labelColor=050505'></a>
  <a href='https://www.npmjs.com/package/@mamdouh-aboammar/agent-kernel'><img alt='npm downloads' src='https://img.shields.io/npm/dw/@mamdouh-aboammar/agent-kernel?style=flat-square&color=10B981&logo=npm&logoColor=white&labelColor=050505'></a>
  <a href='https://github.com/imMamdouhaboammar/agent-kernel'><img alt='status' src='https://img.shields.io/badge/status-Tested_%E2%9C%93-10B981?style=flat-square&logo=githubactions&logoColor=white&labelColor=050505'></a>
  <a href='https://github.com/imMamdouhaboammar/agent-kernel/actions/workflows/ci.yml'><img alt='CI' src='https://img.shields.io/badge/CI-passing-10B981?style=flat-square&logo=githubactions&logoColor=white&labelColor=050505'></a>
  <a href='https://github.com/imMamdouhaboammar/agent-kernel/actions/workflows/codeql.yml'><img alt='CodeQL' src='https://img.shields.io/badge/CodeQL-passing-10B981?style=flat-square&logo=github&logoColor=white&labelColor=050505'></a>
  <img alt='node' src='https://img.shields.io/badge/node-%3E%3D18.18.0-30363d?style=flat-square&logo=nodedotjs&logoColor=white&labelColor=050505'>
  <img alt='runtime dependencies' src='https://img.shields.io/badge/runtime_deps-0-10B981?style=flat-square&labelColor=050505'>
  <a href='./LICENSE'><img alt='license' src='https://img.shields.io/badge/license-MIT-30363d?style=flat-square&labelColor=050505'></a>
</p>

<p>
  <strong>Current stable release: <a href='https://www.npmjs.com/package/@mamdouh-aboammar/agent-kernel'>v1.19.0</a></strong><br />
  Includes Multi-Scoped Persistent Memory Engine, Self-Healing Failure Remediation Loop, Superpowers Workflows, Universal Setup Command, Environment Vault, and Architecture Guardian.
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
      <li>1 issue changed, including #111: docs: Add examples and troubleshooting guide for agent-kernel CLI setup.</li>
      <li>Daily summary covers 1 public activity item from the last 1 day.</li>
      <li>Documentation and project status remain aligned with the repository’s current public state.</li>
  </ul>
</details>
<!-- project-story:end -->

---

## 🚀 Key Highlights & New Features in v1.18.0

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    AGENT KERNEL                                         │
│                      Local Governance, Vault & Self-Evolving Engine                      │
└───────────────────────────┬─────────────────────────────────┬───────────────────────────┘
                            │                                 │
            ┌───────────────┴───────────────┐ ┌───────────────┴───────────────┐
            │    Project Environment Vault  │ │   Universal Skills Engine     │
            │   (agent-kernel env link)     │ │  (agent-kernel skills sync)   │
            │  SHA256 Fingerprint & Auto    │ │   18 Modules across Claude,   │
            │     0600 .env Restoration     │ │ Cursor, Codex, Antigravity    │
            └───────────────┬───────────────┘ └───────────────┬───────────────┘
                            │                                 │
                            └────────────────┬────────────────┘
                                             │
                             ┌───────────────┴───────────────┐
                             │     Self-Evolve Engine        │
                             │  (agent-kernel evolve)        │
                             │ Dynamic Playbook Generation,  │
                             │  /learn & Universal Hooks     │
                             └───────────────────────────────┘
```

### ⚡ 1. The Universal Setup Command (`install.sh`)
Install, configure, sync 18 skills, and register hooks across all AI agents in one command:
```bash
curl -sSL https://raw.githubusercontent.com/imMamdouhaboammar/agent-kernel/master/install.sh | bash
```

### 🔐 2. Project Environment Vault (`agent-kernel env`)
Automatically mirrors and protects local `.env` files with `0600` permissions using SHA256 project fingerprinting (`git remote.origin.url` / commit hash). Auto-syncs on edits and auto-restores on fresh clones upon session start.

### 🧠 3. Universal Skills Engine (`agent-kernel skills`)
18 pre-packaged Skill Modules automatically deployed across all AI agent environments (`~/.claude/skills`, `~/.codex/skills`, `~/.gemini/config/skills`, `~/.agents/skills`).

### ⚙️ 4. Self-Evolve & Self-Learning Engine (`agent-kernel evolve`)
Synthesizes session execution traces and user corrections (`/learn`) into versioned **Playbooks**. Installs universal hooks automatically across Antigravity, Claude, Codex, and OpenCode.

---

## Why install Agent Kernel

AI coding agents are useful, but most sessions still begin with missing context. The agent forgets repository rules, repeats old mistakes, runs commands you already rejected, or produces working code that quietly weakens the architecture.

Agent Kernel adds a small local operating layer around those tools:

| Recurring Problem | What Agent Kernel Provides |
|---|---|
| You repeat the same rules in every prompt | Durable local memory compiled into agent-readable files |
| Claude, Codex, Cursor, and Gemini drift from each other | One source of truth distributed to each supported surface |
| Environment `.env` files are lost in fresh clones | Project Environment Vault with SHA256 fingerprinting & auto-restore |
| Agents lack knowledge of CLI capabilities | 18 Universal Skill Modules automatically synced across all agent tools |
| Multi-step workflows require manual repetition | Self-Evolve Engine synthesizing successful sessions into executable Playbooks |
| The same build or test failure returns | Failure Lessons with command, error, root cause, fix, and evidence |
| AI-generated code creates hidden dependency drift | Architecture Guardian with maps, policies, contracts, baselines, and reports |
| An agent creates a second service that already exists | Reuse-first symbol search before new capabilities are introduced |
| Agents identify useful rules but should not save them silently | Pending proposal inbox with explicit user approval |
| You do not want a hosted platform | Local Node CLI, JSON storage, optional hooks, MCP, and zero runtime dependencies |

---

## Quickstart & Fast Setup

### ⚡ Option A: Universal Auto-Installer Command (Recommended)
```bash
curl -sSL https://raw.githubusercontent.com/imMamdouhaboammar/agent-kernel/master/install.sh | bash
```

### Option B: Global Install via Package Managers
```bash
# Via npm
npm install -g @mamdouh-aboammar/agent-kernel
agent-kernel setup

# Via Bun
bun install -g @mamdouh-aboammar/agent-kernel
agent-kernel setup
```

### Option C: Run Directly via npx or bunx
```bash
npx -y @mamdouh-aboammar/agent-kernel setup
```

Requires Node.js `>=18.18.0` or Bun `>=1.0.0`. Read [`docs/INSTALL_AND_AGENT_SETUP.md`](./docs/INSTALL_AND_AGENT_SETUP.md) for full instructions.

---

## Core Features Breakdown

### 🔐 Project Environment Vault (`agent-kernel env`)
```bash
# Link current project .env to Vault
agent-kernel env link

# Check sync status and fingerprint
agent-kernel env status

# Force push local .env changes to Vault
agent-kernel env push

# Restore .env file from Vault in fresh clone
agent-kernel env pull

# List all vaulted project environments
agent-kernel env list
```

### 🧠 Universal Agent Skills (`agent-kernel skills`)
```bash
# List all registered Skill Modules
agent-kernel skills list

# Inspect detailed SKILL.md for a specific skill module
agent-kernel skills inspect agent-kernel-ops

# Synchronize Skill Modules across all AI Agent environments
agent-kernel skills sync
```

### ⚙️ Self-Evolve & Self-Learning Engine (`agent-kernel evolve`)
```bash
# Generate a Playbook from recent workflow
agent-kernel evolve generate --title "Full Supabase Setup" --topic "auth"

# List all synthesized Playbooks and metrics
agent-kernel evolve list

# Inspect Playbook steps and evolutionary history
agent-kernel evolve inspect <playbookId>

# Install Universal Self-Evolve Hooks across Antigravity, Claude, Codex, OpenCode
agent-kernel evolve hooks
```

---

## Local Memory Dashboard

Generate an adaptive HTML snapshot of the Agent Kernel state stored on your machine and open it in your browser:

```bash
agent-kernel dashboard
```

Output is atomic and self-contained in `~/.agent-kernel/reports/dashboard.html`. It uses zero network requests, redacts sensitive key patterns, and applies a restrictive Content Security Policy.

Read [`docs/STATIC_MEMORY_DASHBOARD.md`](./docs/STATIC_MEMORY_DASHBOARD.md) for privacy details.

---

## Architecture Guardian

Prevent AI-generated code from introducing structural regressions:

```bash
cd ~/Projects/YourProject

# Initialize architecture policy & discovery
agent-kernel architecture init .
agent-kernel architecture policy validate .
agent-kernel architecture discover . --json
agent-kernel architecture baseline . --json

# Before a non-trivial change:
agent-kernel architecture contract init . \
  --task 'Add subscription cancellation' \
  --owner billing \
  --allow 'src/billing/**,test/billing/**' \
  --expect 'src/billing/cancel-subscription.ts'

agent-kernel architecture reuse 'cancel subscription' . --json
agent-kernel architecture check . --json
```

Read [`docs/ARCHITECTURE_GUARDIAN.md`](./docs/ARCHITECTURE_GUARDIAN.md) and the canonical [`skills/architecture-guardian/`](./skills/architecture-guardian/) skill.

---

## Agent Integrations Matrix

| Agent or Surface | Output or Integration |
|---|---|
| **Claude Code** | `CLAUDE.md`, context and architecture hooks, MCP config, marketplace plugin, repo-local skills |
| **Antigravity** | `.agents/agents.md`, `.agents/skills/*`, hooks |
| **Cursor** | `.cursor/rules/00-agent-kernel.mdc` |
| **Codex** | `AGENTS.md`, `.codex/AGENTS.md`, `.codex/config.toml`, repo-local skills |
| **Gemini CLI** | `GEMINI.md` |
| **OpenCode / OpenClaw** | `AGENTS.md`, hooks |
| **Kiro / Skills.sh** | `SKILL.md`, `skills.sh.json` |

---

## Core Command Reference

```text
agent-kernel setup
agent-kernel env link|status|push|pull|list|unlink
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
agent-kernel dashboard [--out file.html] [--json]
agent-kernel architecture init|discover|baseline|check|reuse|contract
agent-kernel failure capture|learn|list|search|show|propose
agent-kernel retention status|prune
agent-kernel export <file.json>
agent-kernel import <file.json>
```

---

## Documentation Map

Start with [`docs/README.md`](./docs/README.md).

| Need | Read |
|---|---|
| Install and connect agents | [`docs/INSTALL_AND_AGENT_SETUP.md`](./docs/INSTALL_AND_AGENT_SETUP.md) |
| Complete command reference | [`docs/COMMAND_REFERENCE.md`](./docs/COMMAND_REFERENCE.md) |
| Environment variables | [`docs/ENVIRONMENT_VARIABLES.md`](./docs/ENVIRONMENT_VARIABLES.md) |
| Skill contract and synchronization | [`docs/SKILL_CONTRACT.md`](./docs/SKILL_CONTRACT.md) |
| Secure runtime and release operations | [`docs/SECURE_RUNTIME_AND_RELEASES.md`](./docs/SECURE_RUNTIME_AND_RELEASES.md) |
| Failure Lessons protocol | [`docs/FAILURE_LESSONS_PROTOCOL.md`](./docs/FAILURE_LESSONS_PROTOCOL.md) |
| Prevent AI-generated architecture drift | [`docs/ARCHITECTURE_GUARDIAN.md`](./docs/ARCHITECTURE_GUARDIAN.md) |
| Inspect local memory in browser | [`docs/STATIC_MEMORY_DASHBOARD.md`](./docs/STATIC_MEMORY_DASHBOARD.md) |
| Configure trusted CLI updates | [`docs/UPDATES.md`](./docs/UPDATES.md) |
| Safe project linking | [`docs/SAFE_LINKING.md`](./docs/SAFE_LINKING.md) |
| Safe Git hook installation | [`docs/SAFE_GIT_HOOKS.md`](./docs/SAFE_GIT_HOOKS.md) |

---

## Development & Verification

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

<div align='center'>

*Built by [Mamdouh Aboammar](https://github.com/imMamdouhaboammar) for everyone tired of explaining the same standards to a new agent every morning.*

</div>
