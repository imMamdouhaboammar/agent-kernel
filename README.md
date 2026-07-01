<div align="center">

# 🧠 Agent Kernel

### *Shared memory, rules, and safety for every AI coding agent on your machine.*

<br>

```text
shared memory  ·  approval inbox  ·  episodic recall  ·  MCP tools  ·  deterministic guard
```

<br>

**One CLI. Every agent. Persistent memory.**

<br>

```bash
npm install -g @mamdouh-aboammar/agent-kernel
```

<br>

[![npm version](https://img.shields.io/npm/v/@mamdouh-aboammar/agent-kernel?color=cb3837&logo=npm&logoColor=white&label=npm&style=for-the-badge)](https://www.npmjs.com/package/@mamdouh-aboammar/agent-kernel)
[![npm bundlephobia](https://img.shields.io/bundlephobia/min/@mamdouh-aboammar/agent-kernel?color=cb3837&logo=npm&logoColor=white&label=install%20size&style=for-the-badge)](https://bundlephobia.com/package/@mamdouh-aboammar/agent-kernel)
[![License: MIT](https://img.shields.io/github/license/imMamdouhaboammar/agent-kernel?color=4c1&style=for-the-badge)](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/LICENSE)
[![GitHub release](https://img.shields.io/github/v/release/imMamdouhaboammar/agent-kernel?color=4c1&label=version&style=for-the-badge)](https://github.com/imMamdouhaboammar/agent-kernel/releases/latest)

</div>

<br>

---

## 🧭 Why Agent Kernel Exists

Modern AI coding is no longer one tool in one project.

You might start the morning in Claude Code, fix something in Codex, review another repo in Cursor, then test an idea in Antigravity or Gemini CLI. Each agent is smart in its own way, but every new session starts with the same problem:

**The agent does not know your rules.**

It does not know that you prefer `pnpm` for TypeScript projects.
It does not know that production Supabase apps should not get random SQLite fallbacks.
It does not know which files are sensitive.
It does not remember why you rejected a previous architecture.
It does not know the standards you refuse to compromise on.

So you repeat yourself.

Again and again.

You explain the same project rules, the same engineering preferences, the same safety boundaries, the same *"please do not rewrite the whole repo"* warning. Then you switch to another coding agent and repeat the process from scratch.

**Agent Kernel exists to fix that.**

It gives every AI coding agent on your machine the same local memory, rules, and safety layer.

Instead of storing your standards inside one chat, one IDE, or one temporary prompt, Agent Kernel keeps them in a local JSON-first memory system. From there, it generates the files and integrations that different agents understand:

- `AGENTS.md` for agents that read repo instructions
- `CLAUDE.md` for Claude Code
- Cursor rules for Cursor
- Antigravity agent files
- Gemini-compatible guidance
- MCP tools for agents that can query memory directly
- hooks and guards for rules that must be enforced, not just suggested

This means your standards become portable across agents.

> Claude can learn a rule and propose it.
> You can review and approve it.
> Agent Kernel can publish it.
> Codex, Cursor, Antigravity, and other agents can see it later.

The agent does not own the memory.
**The kernel does.**

That distinction matters.

A normal instruction file is just context. It can be forgotten, ignored, or buried under a long prompt. Agent Kernel treats memory as a controlled system:

1. Agents can **propose** memories.
2. You **approve or reject** them.
3. Approved memories become the **source of truth**.
4. The kernel generates **agent-specific instruction files**.
5. Critical rules can be enforced with **hooks, guards, git checks, or CI**.

So a rule like this:

```txt
Never add a local SQLite fallback to production Supabase apps.
```

does not have to live as a sentence in a chat.

It can become:

- a shared memory
- a generated instruction
- a policy
- a guardrail
- a pre-commit check
- a reusable rule across future projects

Agent Kernel is **not** a replacement for Claude Code, Codex, Cursor, or any other coding agent.

It is the **local control layer around them**.

> Use your agents for coding.
> Use Agent Kernel to make sure they all work with the same memory, the same rules, and the same safety boundaries.

In one sentence:

> **Agent Kernel is a local-first governance and memory layer for AI coding agents.**
>
> It helps you stop repeating your standards in every session, and starts turning your personal engineering rules into a shared, inspectable, enforceable system.

---

<br>

## 🏗️ How it fits between your agents and your projects

```text
   ┌─────────────┐
   │ Claude Code │──────┐
   └─────────────┘      │
   ┌─────────────┐      │
   │    Codex    │──────┤
   └─────────────┘      │
   ┌─────────────┐      │      ┌──────────────────────┐       ┌──────────────┐
   │   Cursor    │──────┼─────▶│                      │──────▶│   AGENTS.md  │
   └─────────────┘      │      │                      │       │   CLAUDE.md  │
   ┌─────────────┐      │      │     Agent Kernel     │       │  .cursor/    │
   │ Antigravity │──────┤      │                      │       │  GEMINI.md   │
   └─────────────┘      │      │  • shared memories   │       │  SKILLS.md   │
   ┌─────────────┐      │      │  • approval inbox    │       │  policy.json │
   │  Gemini CLI │──────┤      │  • episodic recall   │       │  pre-commit  │
   └─────────────┘      │      │  • MCP tools         │       │  hooks       │
   ┌─────────────┐      │      │  • policy guard      │       └──────────────┘
   │ 60+ others  │──────┘      └──────────────────────┘
   └─────────────┘
        agents                       kernel                          your project
```

The flow of a rule, end to end:

```text
   agent proposes              you approve               kernel publishes
   new rule         ────────▶   or reject      ────────▶   instruction files
                                                                │
                                                                ▼
                                                       agents auto-attach
                                                       on next session
```

---

## ✨ At a glance

### 📦 Install

[![npm version](https://img.shields.io/npm/v/@mamdouh-aboammar/agent-kernel?color=cb3837&logo=npm&logoColor=white&label=npm&style=for-the-badge)](https://www.npmjs.com/package/@mamdouh-aboammar/agent-kernel)
[![npm bundlephobia](https://img.shields.io/bundlephobia/min/@mamdouh-aboammar/agent-kernel?color=cb3837&logo=npm&logoColor=white&label=install%20size&style=for-the-badge)](https://bundlephobia.com/package/@mamdouh-aboammar/agent-kernel)
[![npm weekly downloads](https://img.shields.io/npm/dw/@mamdouh-aboammar/agent-kernel?color=cb3837&logo=npm&logoColor=white&label=weekly%20installs&style=for-the-badge)](https://www.npmjs.com/package/@mamdouh-aboammar/agent-kernel)

### 🧬 Status

[![GitHub release](https://img.shields.io/github/v/release/imMamdouhaboammar/agent-kernel?color=4c1&label=version&style=for-the-badge)](https://github.com/imMamdouhaboammar/agent-kernel/releases/latest)
[![Release date](https://img.shields.io/github/release-date/imMamdouhaboammar/agent-kernel?color=4c1&style=for-the-badge)](https://github.com/imMamdouhaboammar/agent-kernel/releases)
[![License: MIT](https://img.shields.io/github/license/imMamdouhaboammar/agent-kernel?color=4c1&style=for-the-badge)](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/LICENSE)
[![Last commit](https://img.shields.io/github/last-commit/imMamdouhaboammar/agent-kernel?color=4c1&style=for-the-badge)](https://github.com/imMamdouhaboammar/agent-kernel/commits/master)
[![Commits since latest release](https://img.shields.io/github/commits-since/imMamdouhaboammar/agent-kernel/latest?color=4c1&style=for-the-badge)](https://github.com/imMamdouhaboammar/agent-kernel/compare/v0.0.5...master)

### 🛡️ Quality

[![CI](https://img.shields.io/github/actions/workflow/status/imMamdouhaboammar/agent-kernel/ci.yml?branch=master&label=CI&logo=github-actions&logoColor=white&style=for-the-badge)](https://github.com/imMamdouhaboammar/agent-kernel/actions/workflows/ci.yml)
[![npm publish CI](https://img.shields.io/github/actions/workflow/status/imMamdouhaboammar/agent-kernel/npm-publish.yml?label=npm%20publish&logo=npm&logoColor=white&style=for-the-badge)](https://github.com/imMamdouhaboammar/agent-kernel/actions/workflows/npm-publish.yml)
[![Release CI](https://img.shields.io/github/actions/workflow/status/imMamdouhaboammar/agent-kernel/release.yml?label=auto-release&logo=github-actions&logoColor=white&style=for-the-badge)](https://github.com/imMamdouhaboammar/agent-kernel/actions/workflows/release.yml)

### 🌐 Ecosystem

[![skills.sh](https://img.shields.io/badge/skills.sh-agent--kernel-blueviolet?style=for-the-badge&logo=lightning&logoColor=white)](https://skills.sh/imMamdouhaboammar/agent-kernel)
[![Claude Code plugin](https://img.shields.io/badge/Claude-Code%20plugin-D4A857?style=for-the-badge&logo=anthropic&logoColor=white)](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/.claude-plugin/marketplace.json)
[![GitHub stars](https://img.shields.io/github/stars/imMamdouhaboammar/agent-kernel?style=for-the-badge&logo=github&color=gold)](https://github.com/imMamdouhaboammar/agent-kernel/stargazers)
[![Issues](https://img.shields.io/github/issues/imMamdouhaboammar/agent-kernel?style=for-the-badge&logo=github)](https://github.com/imMamdouhaboammar/agent-kernel/issues)
[![PRs](https://img.shields.io/github/issues-pr/imMamdouhaboammar/agent-kernel?style=for-the-badge&logo=github&color=lime)](https://github.com/imMamdouhaboammar/agent-kernel/pulls)

### ⚙️ Stack

[![Node.js 18.18+](https://img.shields.io/badge/Node.js-18.18+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript 5.9+](https://img.shields.io/badge/TypeScript-5.9+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![ESM only](https://img.shields.io/badge/ESM-only-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://nodejs.org/api/esm.html)
[![Open Source MIT](https://img.shields.io/badge/Open%20Source-MIT-yellow?style=for-the-badge)](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/LICENSE)

---

## ✨ What's new in v0.0.9

The **discovery + governance hardening** release.

- **New `AGENTS.md`** at the repo root — instructions for AI coding
  agents working on or with this repo: source layout, hard rules,
  release checklist, Skills.sh + Claude marketplace pointers.
- **Wired Skills.sh + Claude marketplace** — `.claude-plugin/marketplace.json`
  and `.claude-plugin/plugin.json` aligned with the current Claude
  marketplace spec (v2.1.143+): `displayName`, per-plugin keywords,
  `homepage` / `repository` at the plugin level. Verified discoverable
  via `npx skills add imMamdouhaboammar/agent-kernel --list`.
- **README hero rewritten** — capitalized `Agent Kernel` (was lowercase
  `agent-kernel`), tagline "Shared memory, rules, and safety for every
  AI coding agent on your machine.", added an ASCII architecture diagram
  (agents → kernel → project files) and a rule-flow diagram
  (propose → approve → publish → attach).
- **`docs/ARCHITECTURE_NOW.md`** — explicit "what the repo actually is
  today" doc to prevent future contributors from mistaking the
  `src/{adapters,commands,core,hooks}/` placeholder folders for
  implemented modules.
- **`scripts/check-version.mjs`** — single-source-of-truth check that
  fails if `package.json#version` differs from the `VERSION` constant
  in `src/cli.mjs` or `dist/cli.mjs`. Wired into `npm run lint`,
  `npm test`, and `npm run typecheck`.
- **`scripts/lint.mjs`** expanded from 8 → 15 checks, now includes a
  hardcoded-secret scan and `package.json#files` whitelist
  validation.
- **Test suite refactor** — `test/smoke.mjs` is now an orchestrator
  that runs each focused test module (`init`, `memory`, `episode`,
  `guard`, `mcp`, `version`, `package-files`) in isolation and reports
  a pass/fail summary.
- **`CONTRIBUTING.md`** — added a manual release recovery section
  (the v0.0.6 → v0.0.7 npm CDN propagation retry pattern).

No CLI behavior change. `npm install -g @mamdouh-aboammar/agent-kernel@latest`
will pick up v0.0.9 on the next refresh. See the full notes in
[`CHANGELOG.md`](./CHANGELOG.md).

---

## ⚡ What is this?

`agent-kernel` is the **memory + governance layer** for any agentic-coding workflow.
Instead of repeating *"use TypeScript strict mode"* or *"always run pnpm typecheck"* in
every prompt, save the rule once — every agent in every project uses it.

| Without agent-kernel                                            | With agent-kernel                                                              |
|-----------------------------------------------------------------|--------------------------------------------------------------------------------|
| Standards repeated in every prompt                              | Standards live in `~/.agent-kernel/source/memories/*.json` and auto-attach     |
| Lost context after session end                                  | Episodes saved locally; searchable later via `agent-kernel episode search`     |
| Agent writes whatever rule it wants                             | Proposal inbox; you approve before publish                                     |
| Manual `git commit` may leak secrets                            | Pre-commit hook + `agent-kernel guard --staged` blocks                         |
| Different agents see different rules                            | One JSON-first source compiles to all platforms (AGENTS.md / CLAUDE.md / .cursor / GEMINI.md) |

**Sounds good? Try it:**

```bash
npm install -g @mamdouh-aboammar/agent-kernel
agent-kernel --version
agent-kernel doctor
```

---

## 🚀 Quick start

### 1. Install

```bash
# Global install (recommended)
npm install -g @mamdouh-aboammar/agent-kernel

# Or one-off use
npx -y @mamdouh-aboammar/agent-kernel --version
```

### 2. Initialize in your project

```bash
cd ~/Projects/YourProject

# First-time setup: create AGENTS.md, CLAUDE.md, .cursor/rules/, etc.
# + install Claude hooks + git pre-commit hook
agent-kernel init --sync --enforce
agent-kernel link . --hooks
```

This drops these files into your project:

```text
AGENTS.md                              # Read by Claude Code / Codex / Cursor / OpenCode
CLAUDE.md                              # Read by Claude Code
.cursor/rules/00-agent-kernel.mdc     # Read by Cursor
.agents/agents.md                      # Read by Antigravity
GEMINI.md                              # Read by Gemini CLI
.git/hooks/pre-commit                  # Runs `agent-kernel guard --staged` on every commit
```

### 3. Save your first rule

```bash
agent-kernel remember "Never add local SQLite fallback to production Supabase apps." \
    --type policy --level critical --tags supabase,database --publish
```

The next time any agent in any project touches that code, the rule auto-attaches to its
context.

### 4. Capture an episode

```bash
agent-kernel episode add \
    --title "Stripe webhook bug fix" \
    --tags stripe,webhook,bug \
    --text "Root cause: missing signature verification on /api/stripe webhook. Fix: verify signature via stripe.webhooks.constructEvent()."
```

Later:

```bash
agent-kernel episode search "stripe webhook"
agent-kernel episode show <episode-id>
```

### 5. Health check

```bash
agent-kernel doctor
agent-kernel status
```

---

## 📚 Core commands

```text
agent-kernel init [--sync] [--enforce]
agent-kernel doctor
agent-kernel compile
agent-kernel sync
agent-kernel link [project] [--hooks]
agent-kernel remember "rule text" [--type rule] [--level critical] [--publish]
agent-kernel propose --from claude --text "rule text" --reason "..."
agent-kernel inbox
agent-kernel approve <id> [--publish]
agent-kernel reject <id>
agent-kernel publish
agent-kernel validate
agent-kernel migrate json [--publish]
agent-kernel memory list|search|show
agent-kernel episode add|sync|search|show|stats|reindex
agent-kernel enforce install
agent-kernel guard [--staged|--file path]
agent-kernel git-hook install [project]
agent-kernel start <claude|codex|cursor|antigravity|gemini> [project]
agent-kernel status
```

Full reference: see [`docs/`](./docs).

---

## 🗂️ Memory layout

```text
~/.agent-kernel/                              # Memory home (configurable via AGENT_KERNEL_HOME)
  config.json                                 # User's settings (level, targets, etc.)
  source/
    memories/
      rules.json                              # Always-follow rules
      preferences.json                        # Style preferences (e.g. "prefer tabs over spaces")
      workflows.json                          # How-to steps ("to deploy, run X")
      project-notes.json                      # Per-project facts
      skills.json                             # Available skills
    schemas/                                  # JSON Schema for validation
    policies/policies.json                    # Policy pack arrays
  episodes/
    archive/                                  # Past session snapshots (compact JSON)
    index.json                                # Searchable index
    sources.json                              # Where episodes were captured from
  inbox/
    pending/                                  # Agent proposals waiting for approval
    approved/                                 # Approved (about to publish)
    rejected/                                 # Rejected (kept for audit)
  dist/                                       # Compiled instruction files (one per target)
    AGENTS.md
    CLAUDE.md
    cursor-rule.mdc
    antigravity-agents.md
    GEMINI.md
    SKILLS.md
    policy.json
  logs/                                       # Append-only JSONL event logs
    compile.jsonl
    sync.jsonl
    proposals.jsonl
    approvals.jsonl
    episodes.jsonl
```

---

## 🔌 Compatibility

| Agent        | Memory source                | Hook install                 | Compile target                |
|--------------|------------------------------|------------------------------|-------------------------------|
| Claude Code  | ✅                           | ✅ `~/.claude/hooks/`        | `PreToolUse` + `PostToolUse`  |
| Codex        | ✅                           | n/a (read-only)              | `AGENTS.md`                   |
| Cursor       | ✅                           | n/a                          | `.mdc` rule                   |
| OpenCode     | ✅                           | n/a                          | `AGENTS.md`                   |
| Antigravity  | ✅                           | n/a                          | `.agents/`                    |
| Gemini CLI   | ✅                           | n/a                          | `GEMINI.md`                   |
| 60+ others   | ✅ see Skills.sh index       | depends on agent             | via `AGENTS.md`               |

Memory layout is **fully backward compatible with v0.0.1** —
`agent-kernel migrate json --publish` upgrades in place.

---

## 🔒 Safety model

- Agents may **propose** memories. Only `agent-kernel` **publishes** memories.
- Generated markdown files are not treated as the only defense.
- Critical rules should also be backed by **hooks**, **scanners**, **git hooks**, or **CI checks**.

Built-in guards (override via policy packs):

```text
dangerous-rm       rm -rf / or rm -rf ~        — blocked
curl-pipe-shell    curl ... | sh               — blocked
chmod-777          chmod -R 777                — blocked
force-push-main    git push --force main       — blocked
delete-git         rm -rf .git                 — blocked
secret-leak        OPENAI/ANTHROPIC/SUPABASE/Google API keys — blocked
```

---

## 🧩 Integrations

- **delegate-team** — bundled inside `delegate-team` v2.5.0+ at `agent-kernel/`.
  See [integrations/agent-kernel.md](https://github.com/imMamdouhaboammar/delegate-team/blob/master/integrations/agent-kernel.md).
- **MCP** — every command is also exposed as an MCP tool. See [`docs/MCP_SERVER.md`](./docs/MCP_SERVER.md).
- **Skills.sh** — discoverable via `npx skills add imMamdouhaboammar/agent-kernel -a claude-code -g -y`.

---

## 🛠️ Development

```bash
git clone https://github.com/imMamdouhaboammar/agent-kernel
cd agent-kernel

npm install              # Install devDependencies (typescript)
npm run build            # Copy src/cli.mjs → dist/cli.mjs + chmod 755
npm test                 # Run smoke tests (init + validate + memory + episode + MCP)
npm run typecheck        # tsc --noEmit
npm run lint             # Custom lint (MCP tool names + secret pattern sanity)
npm run size             # npm pack --dry-run (preview published tarball)
npm run publish:dry      # npm publish --dry-run
```

### Project layout

```text
agent-kernel/
├── src/cli.mjs              # Source CLI (single ESM file, ~85 KB)
├── dist/cli.mjs             # Built CLI (copied from src via scripts/build.mjs)
├── scripts/
│   ├── build.mjs            # copyFileSync src → dist + chmod
│   └── lint.mjs             # MCP tool name + secret pattern sanity
├── test/smoke.mjs           # Integration smoke test (init + validate + memory + episode + MCP)
├── docs/                    # 8 architecture + protocol docs
├── examples/                # CI guard workflow + sample memory rules + sample episode
├── develpment/              # Roadmap (BACKLOG, EPICS, MILESTONES, SPRINT-PLAN, backlog.json)
├── bin/install-local.sh     # Local non-npm install helper
├── .github/workflows/       # CI + auto-publish + auto-release
├── .claude-plugin/          # Claude Code marketplace manifest
├── SKILL.md                 # Skills.sh + Claude marketplace discovery
├── package.json             # npm metadata
├── tsconfig.json            # TypeScript config (for src/**/*.ts — keep extensible)
├── CHANGELOG.md             # Version history
├── LICENSE                  # MIT
└── README.md                # This file
```

### Adding a new command

The CLI is a single `src/cli.mjs` file (intentional — single-file ship keeps the npm
package < 100 KB). To add a new command:

1. Edit `src/cli.mjs` — find the `dispatch(args)` function (or the relevant section).
2. Add a case for your command, update `--help`, and update the readme + `docs/`.
3. Add a smoke test to `test/smoke.mjs`.
4. `npm run build && npm test`.

---

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) (TBD). For now:

1. Fork & branch from `master`.
2. Run `npm install && npm test` locally.
3. Make focused commits (single command or single doc per commit).
4. Open a PR with a clear description of what changed and why.

## 📄 License

MIT © Mamdouh Aboammar

## 🔗 Links

- **npm** — https://www.npmjs.com/package/@mamdouh-aboammar/agent-kernel
- **Repository** — https://github.com/imMamdouhaboammar/agent-kernel
- **Issues** — https://github.com/imMamdouhaboammar/agent-kernel/issues
- **Releases** — https://github.com/imMamdouhaboammar/agent-kernel/releases
- **Skills.sh** — https://skills.sh/imMamdouhaboammar/agent-kernel
- **delegate-team integration** — https://github.com/imMamdouhaboammar/delegate-team/blob/master/integrations/agent-kernel.md

---

<div align="center">

*Built by [Mamdouh Aboammar](https://github.com/imMamdouhaboammar) — for everyone who is tired of explaining the same standards to a new agent every morning.*

</div>