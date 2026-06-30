<div align="center">

# 🧠 agent-kernel

### *Local-first governance kernel for AI coding agents*

```text
shared memory  ·  approval inbox  ·  episodic recall  ·  MCP tools  ·  deterministic guard
```

**One CLI. Every agent. Persistent memory.**

---

### 📦 Install

[![npm version](https://img.shields.io/npm/v/@mamdouh-aboammar/agent-kernel?color=cb3837&logo=npm&logoColor=white&label=install&style=for-the-badge)](https://www.npmjs.com/package/@mamdouh-aboammar/agent-kernel)
[![npm bundlephobia](https://img.shields.io/bundlephobia/min/@mamdouh-aboammar/agent-kernel?color=cb3837&logo=npm&logoColor=white&label=install%20size&style=for-the-badge)](https://bundlephobia.com/package/@mamdouh-aboammar/agent-kernel)
[![npm weekly downloads](https://img.shields.io/npm/dw/@mamdouh-aboammar/agent-kernel?color=cb3837&logo=npm&logoColor=white&label=weekly%20installs&style=for-the-badge)](https://www.npmjs.com/package/@mamdouh-aboammar/agent-kernel)

### 🧬 Status

[![GitHub release](https://img.shields.io/github/v/release/imMamdouhaboammar/agent-kernel?color=blue&label=version&style=for-the-badge)](https://github.com/imMamdouhaboammar/agent-kernel/releases/latest)
[![Release date](https://img.shields.io/github/release-date/imMamdouhaboammar/agent-kernel?color=blue&style=for-the-badge)](https://github.com/imMamdouhaboammar/agent-kernel/releases)
[![License: MIT](https://img.shields.io/github/license/imMamdouhaboammar/agent-kernel?color=blue&style=for-the-badge)](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/LICENSE)
[![Last commit](https://img.shields.io/github/last-commit/imMamdouhaboammar/agent-kernel?color=blue&style=for-the-badge)](https://github.com/imMamdouhaboammar/agent-kernel/commits/master)
[![Commits since latest release](https://img.shields.io/github/commits-since/imMamdouhaboammar/agent-kernel/latest?color=blue&style=for-the-badge)](https://github.com/imMamdouhaboammar/agent-kernel/compare/v0.0.5...master)

### 🛡️ Quality

[![CI](https://img.shields.io/github/actions/workflow/status/imMamdouhaboammar/agent-kernel/ci.yml?branch=master&label=CI&logo=github-actions&logoColor=white&style=for-the-badge)](https://github.com/imMamdouhaboammar/agent-kernel/actions/workflows/ci.yml)
[![npm publish CI](https://img.shields.io/github/actions/workflow/status/imMamdouhaboammar/agent-kernel/npm-publish.yml?label=npm%20publish&logo=npm&logoColor=white&style=for-the-badge)](https://github.com/imMamdouhaboammar/agent-kernel/actions/workflows/npm-publish.yml)
[![Release CI](https://img.shields.io/github/actions/workflow/status/imMamdouhaboammar/agent-kernel/release.yml?label=auto-release&logo=github-actions&logoColor=white&style=for-the-badge)](https://github.com/imMamdouhaboammar/agent-kernel/actions/workflows/release.yml)

### 🌐 Ecosystem

[![Skills.sh](https://img.shields.io/badge/Skills.sh-discovery-blueviolet?style=for-the-badge)](https://skills.sh/imMamdouhaboammar/agent-kernel)
[![Claude Code plugin](https://img.shields.io/badge/Claude-Code%20plugin-D4A857?style=for-the-badge)](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/.claude-plugin/marketplace.json)
[![GitHub stars](https://img.shields.io/github/stars/imMamdouhaboammar/agent-kernel?style=for-the-badge&logo=github&color=gold)](https://github.com/imMamdouhaboammar/agent-kernel/stargazers)
[![Issues](https://img.shields.io/github/issues/imMamdouhaboammar/agent-kernel?style=for-the-badge&logo=github)](https://github.com/imMamdouhaboammar/agent-kernel/issues)
[![PRs](https://img.shields.io/github/issues-pr/imMamdouhaboammar/agent-kernel?style=for-the-badge&logo=github&color=lime)](https://github.com/imMamdouhaboammar/agent-kernel/pulls)

### ⚙️ Stack

[![Node.js 18.18+](https://img.shields.io/badge/Node.js-18.18+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript 5.9+](https://img.shields.io/badge/TypeScript-5.9+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![ESM only](https://img.shields.io/badge/ESM-only-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://nodejs.org/api/esm.html)
[![MIT license](https://img.shields.io/badge/Open%20Source-MIT-yellow?style=for-the-badge)](https://github.com/imMamdouhaboammar/agent-kernel/blob/master/LICENSE)

</div>

> **One problem, solved:** you should not have to repeat the same standards
> to every coding agent in every session.
>
> `agent-kernel` gives every coding agent you use a shared local memory,
> an approval inbox for new rules, episodic recall across sessions, MCP
> tools, Claude + git hooks, and a deterministic policy guard.
> All local-first, all JSON-first.

---

## ⚡ What is this?

`agent-kernel` is the **memory + governance layer** for any agentic-coding
workflow. Instead of repeating "use TypeScript strict mode" or "always
run pnpm typecheck" in every prompt, save the rule once — every agent
in every project uses it.

| Without agent-kernel                      | With agent-kernel                                                            |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| Standards repeated in every prompt        | Standards live in `~/.agent-kernel/source/memories/*.json` and auto-attach   |
| Lost context after session end            | Episodes saved locally; searchable via `agent-kernel episode search`        |
| Agent writes whatever rule it wants       | Proposal inbox; you approve before publish                                  |
| `git commit` may leak secrets              | Pre-commit hook + `agent-kernel guard --staged` blocks                      |
| Different agents see different rules      | One JSON-first source compiles to all platforms (AGENTS.md, CLAUDE.md, etc.) |

**Quick verify after install:**

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
agent-kernel remember \
    "Never add local SQLite fallback to production Supabase apps." \
    --type policy \
    --level critical \
    --tags supabase,database \
    --publish
```

Once published, this rule will be included in every `agent-kernel compile`
output — i.e. every agent that reads `AGENTS.md`, `CLAUDE.md`, or the
other generated files will see it.

### 4. Capture an episode (optional)

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

The CLI exposes these top-level commands. Full reference: [`docs/`](./docs).

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

---

## 🗂️ Memory layout

The memory home is configurable via the `AGENT_KERNEL_HOME` env var
(defaults to `~/.agent-kernel/`):

```text
~/.agent-kernel/
  config.json                                 # User settings (level, targets, ...)
  source/
    memories/
      rules.json                              # Always-follow rules
      preferences.json                        # Style preferences
      workflows.json                          # How-to steps
      project-notes.json                      # Per-project facts
      skills.json                             # Available skills
    schemas/                                  # JSON Schema for validation
    policies/policies.json                    # Policy pack arrays
  episodes/
    archive/                                  # Past session snapshots
    index.json                                # Searchable index
    sources.json                              # Where episodes came from
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

| Agent               | Memory source | Hook install           | Compile target           |
| ------------------- | -------------- | ---------------------- | ------------------------ |
| Claude Code         | ✅             | ✅ `~/.claude/hooks/`   | `PreToolUse` + `PostToolUse` |
| Codex               | ✅             | n/a (read-only)        | `AGENTS.md`              |
| Cursor              | ✅             | n/a                    | `.mdc` rule              |
| OpenCode            | ✅             | n/a                    | `AGENTS.md`              |
| Antigravity         | ✅             | n/a                    | `.agents/`               |
| Gemini CLI          | ✅             | n/a                    | `GEMINI.md`              |
| Skills.sh-registered agents | ✅ via `AGENTS.md` | depends on agent | `AGENTS.md`    |

Skills.sh discovery registers this repo as a plugin for any agent that
supports the `npx skills add` flow. The actual integration depends on
the consuming agent's plugin loader. See [Skills.sh](https://skills.sh/imMamdouhaboammar/agent-kernel).

Memory layout is **backward compatible with v0.0.1** for projects
that started with the older flat-file layout. Run
`agent-kernel migrate json --publish` to upgrade in place.

---

## 🔒 Safety model

- Agents may **propose** memories. Only `agent-kernel` **publishes** memories.
- Generated markdown files are **not** the only defense.
  Critical rules should also be backed by **hooks**, **scanners**,
  **git hooks**, or **CI checks**.
- Pre-commit hooks are an **opt-in** (`agent-kernel enforce install`).
  Out of the box, the kernel does not modify git hooks or Claude settings.
- The guard scanner blocks well-known dangerous patterns. It is a
  best-effort defense, not a complete sandbox.

Built-in deny patterns (override via policy packs):

```text
dangerous-rm       rm -rf / or rm -rf ~           — blocked
curl-pipe-shell    curl ... | sh                  — blocked
chmod-777          chmod -R 777                   — blocked
force-push-main    git push --force main          — blocked
delete-git         rm -rf .git                    — blocked
secret-leak        OPENAI/ANTHROPIC/SUPABASE/Google API keys — blocked
```

---

## 🧩 Integrations

- **delegate-team** — bundled inside `delegate-team` v2.5.0+.
  See [integrations/agent-kernel.md](https://github.com/imMamdouhaboammar/delegate-team/blob/master/integrations/agent-kernel.md).
- **MCP** — a subset of commands is exposed as MCP tools
  (`agent_kernel_propose_memory`, `agent_kernel_search_episodes`, etc.).
  See [`docs/MCP_SERVER.md`](./docs/MCP_SERVER.md).
  Note: not every CLI command is exposed as an MCP tool today.
- **Skills.sh** — discoverable via `npx skills add imMamdouhaboammar/agent-kernel -a claude-code -g -y`.

---

## 🛠️ Development

### Build, test, lint

```bash
git clone https://github.com/imMamdouhaboammar/agent-kernel
cd agent-kernel

npm install              # Install devDependencies (typescript)
npm run build            # Inject VERSION, copy src/cli.mjs → dist/cli.mjs
npm test                 # check-version + smoke (init + validate + memory + episode + MCP)
npm run lint             # 14 repository consistency checks
npm run typecheck        # tsc --noEmit
npm run size             # npm pack --dry-run (preview the published tarball)
npm run publish:dry      # npm publish --dry-run
```

### Project layout

```text
agent-kernel/
├── src/cli.mjs              # Single-file CLI implementation (~85 KB)
├── dist/cli.mjs             # Built artifact (sync'd from src by scripts/build.mjs)
├── scripts/
│   ├── build.mjs            # VERSION injection + copy src → dist
│   ├── check-version.mjs    # SSOT check (fails if package.json ≠ CLI version)
│   └── lint.mjs             # 14 repo consistency checks
├── test/
│   └── smoke.mjs            # Smoke test (init + validate + memory + episode + MCP)
├── docs/                    # 7 architecture + protocol docs
│   ├── audits/              # Repository hardening audits
│   └── ARCHITECTURE_NOW.md  # Current single-file design + migration plan
├── examples/                # CI guard workflow + sample memory rules + sample episode
├── development/             # Canonical roadmap (BACKLOG, EPICS, MILESTONES, SPRINT-PLAN)
├── develpment/              # Legacy alias — points to development/, kept for old agents
├── bin/install-local.sh     # Local non-npm install helper
├── .github/workflows/       # ci.yml + npm-publish.yml + release.yml
├── .claude-plugin/          # Claude Code marketplace manifest (marketplace.json + plugin.json)
├── AGENTS.md                # Compact contributor + coding-agent guide
├── SKILL.md                 # Skills.sh + Claude marketplace discovery
├── skills.sh.json           # Skills.sh leaderboard groupings
├── package.json             # npm metadata + scripts
├── tsconfig.json            # TypeScript config (allowJs; includes src/**/*)
├── CHANGELOG.md             # Version history
├── SECURITY.md              # Threat model + reporting
├── CONTRIBUTING.md          # Tag-driven release flow
├── LICENSE                  # MIT
└── README.md                # This file
```

### Adding a new command

The CLI is intentionally a single `src/cli.mjs` file (keeps the npm
package < 100 KB). To add a new command:

1. Edit `src/cli.mjs` — find the relevant section.
2. Update `--help` text near the top.
3. Update `README.md` core-commands list.
4. Add a smoke check to `test/smoke.mjs`.
5. `npm run build && npm test && npm run lint`.

---

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the tag-driven release flow.

For other contributions:

1. Fork & branch from `master`.
2. Run `npm install && npm test && npm run lint` locally.
3. Make focused commits (single command or single doc per commit).
4. Open a PR with a clear description of what changed and why.

## 📄 License

MIT © Mamdouh Aboammar

## 🔗 Links

- **npm**: https://www.npmjs.com/package/@mamdouh-aboammar/agent-kernel
- **Repository**: https://github.com/imMamdouhaboammar/agent-kernel
- **Issues**: https://github.com/imMamdouhaboammar/agent-kernel/issues
- **Releases**: https://github.com/imMamdouhaboammar/agent-kernel/releases
- **Skills.sh**: https://skills.sh/imMamdouhaboammar/agent-kernel
- **delegate-team integration**: https://github.com/imMamdouhaboammar/delegate-team/blob/master/integrations/agent-kernel.md