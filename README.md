# Agent Kernel

[![npm version](https://img.shields.io/npm/v/@mamdouh-aboammar/agent-kernel)](https://www.npmjs.com/package/@mamdouh-aboammar/agent-kernel)
[![npm downloads](https://img.shields.io/npm/dw/@mamdouh-aboammar/agent-kernel)](https://www.npmjs.com/package/@mamdouh-aboammar/agent-kernel)
[![bundle size](https://img.shields.io/bundlephobia/min/@mamdouh-aboammar/agent-kernel)](https://bundlephobia.com/package/@mamdouh-aboammar/agent-kernel)

Local-first memory, rules, Failure Lessons, hooks, MCP tools, and safety checks for AI coding agents.

Agent Kernel gives Claude Code, Codex, Cursor, Antigravity, Gemini CLI, OpenCode, and other coding agents one shared source of truth for project rules, preferences, workflows, notes, debugging lessons, and guard policies.

It is designed for one recurring problem: every new agent session starts with missing context, repeated rules, and the same old mistakes. Agent Kernel keeps the durable knowledge local, reviewable, and reusable.

---

## What it does

| Problem | Agent Kernel answer |
|---|---|
| You repeat the same standards in every prompt | Store durable rules in `~/.agent-kernel/source/memories/*.json` |
| Agents forget previous debugging work | Save searchable episodes and Failure Lessons |
| The same error gets solved again and again | Capture, dedupe, search, and promote known fixes |
| Agents silently invent new rules | Use a proposal inbox before publishing memory |
| Generated instruction files drift from reality | Keep JSON source canonical and regenerate outputs |
| Hooks become invisible automation | Keep hooks narrow, auditable, and event-specific |
| Different tools read different instructions | Compile one source into Claude, Codex, Cursor, Gemini, Antigravity, and AGENTS.md surfaces |

---

## Install

```bash
npm install -g @mamdouh-aboammar/agent-kernel
agent-kernel --version
agent-kernel doctor
```

You can also run it through npm without a global install:

```bash
npx -y @mamdouh-aboammar/agent-kernel --version
```

Agent Kernel requires Node.js `>=18.18.0`.

---

## Fastest correct setup

For a new or existing project, use the safe path first. It preserves existing project instructions and writes Agent Kernel content only inside marked blocks.

```bash
cd ~/Projects/YourProject

agent-kernel init --sync --enforce
agent-kernel compile
agent-kernel-safe-link . --dry-run
agent-kernel-safe-link .
agent-kernel-safe-git-hook . --dry-run
agent-kernel-safe-git-hook .
agent-kernel doctor
```

Typical project-local outputs:

```text
AGENTS.md                              # Claude Code / Codex / Cursor / OpenCode fallback guidance
CLAUDE.md                              # Claude Code guidance
.cursor/rules/00-agent-kernel.mdc      # Cursor rule
.agents/agents.md                      # Antigravity-style guidance
.agents/skills/README.md               # Antigravity-style skills index
GEMINI.md                              # Gemini CLI guidance
.git/hooks/pre-commit                  # Runs Agent Kernel guard checks when installed
```

Use the direct command when you intentionally want the main CLI linker:

```bash
agent-kernel link . --hooks
```

For existing repositories with hand-written `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, Cursor rules, or `.agents` guidance, prefer `agent-kernel-safe-link` first.

---

## The operating loop

```text
agent notices durable rule or repeated failure
  -> agent proposes or captures evidence
  -> user reviews inbox or lesson
  -> user approves useful memory
  -> Agent Kernel publishes compiled guidance
  -> agents receive the updated rules next run
```

This keeps agents useful without giving them permission to rewrite your long-term standards without review.

---

## Save a durable rule

```bash
agent-kernel remember "Never add local SQLite fallback to production Supabase apps." \
  --type policy \
  --level critical \
  --tags supabase,database \
  --publish
```

Use `--publish` when you are writing memory directly as the user. When an agent wants to add memory, it should create a proposal instead:

```bash
agent-kernel propose \
  --from claude \
  --text "Use pnpm in this repository." \
  --reason "User corrected the package manager during setup."

agent-kernel inbox
agent-kernel approve <proposal-id> --publish
```

---

## Capture a Failure Lesson

```bash
agent-kernel failure capture \
  --from claude \
  --type test-failure \
  --command "npm test" \
  --exit-code 1 \
  --text "ERR_MODULE_NOT_FOUND ..." \
  --root-cause "Node ESM import path missed its explicit extension." \
  --fix "Add the explicit .js extension to the relative import."
```

Before retrying a similar failure:

```bash
agent-kernel failure search "ERR_MODULE_NOT_FOUND"
```

Promote a useful lesson into reviewable memory:

```bash
agent-kernel failure propose <failure-lesson-id> --as rule
agent-kernel inbox
agent-kernel approve <proposal-id> --publish
```

Repeated captures of the same `project + command + errorSignature` update the existing lesson and increment `occurrences` instead of creating noisy duplicates.

For Claude Code automatic capture, see [`docs/hooks/FAILURE_LESSONS_HOOK.md`](./docs/hooks/FAILURE_LESSONS_HOOK.md). The recommended event is `PostToolUseFailure` with exec-form command hooks.

---

## Capture an episode

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

Episodes are useful for project history, investigation notes, decisions, and debugging context that should be searchable but does not necessarily belong as a permanent rule.

---

## Core commands

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
agent-kernel failure capture|learn|list|search|show|propose|promote|validate
agent-kernel enforce install
agent-kernel guard [--staged|--file path]
agent-kernel git-hook install [project]
agent-kernel mcp serve|config|install
agent-kernel start <claude|codex|cursor|antigravity|gemini> [project]
agent-kernel status
```

Helper binaries exposed by the package:

```text
agent-kernel-safe-link
agent-kernel-safe-git-hook
agent-kernel-agent-propose
agent-kernel-failure
agent-kernel-failure-hook
agent-kernel-mode
agent-kernel-agent-write
ak
```

---

## Memory layout

```text
~/.agent-kernel/
  config.json
  source/
    memories/
      rules.json
      preferences.json
      workflows.json
      project-notes.json
      skills.json
    failures/
      failure-lessons.json
    policies/
      policies.json
    schemas/
  episodes/
    archive/
    index.json
    sources.json
  inbox/
    pending/
    approved/
    rejected/
  dist/
    AGENTS.md
    CLAUDE.md
    cursor-rule.mdc
    antigravity-agents.md
    GEMINI.md
    SKILLS.md
    policy.json
  logs/
    compile.jsonl
    sync.jsonl
    proposals.jsonl
    approvals.jsonl
    episodes.jsonl
    failures.jsonl
```

Generated files in `dist/` are disposable. Source JSON, proposals, episodes, policies, and Failure Lessons are canonical.

---

## Integrations

| Agent or surface | Output or integration |
|---|---|
| Claude Code | `CLAUDE.md`, hooks, MCP config, marketplace plugin metadata |
| Codex | `AGENTS.md`, `.codex/AGENTS.md`, `.codex/config.toml`, repo-local skills |
| Cursor | `.cursor/rules/00-agent-kernel.mdc` |
| OpenCode / AGENTS-compatible agents | `AGENTS.md` |
| Antigravity | `.agents/agents.md`, `.agents/skills/*` |
| Gemini CLI | `GEMINI.md` |
| Skills.sh | `SKILL.md`, `skills.sh.json` |

The repo also includes an ECC bundle for Claude Code and Codex:

```text
.claude/ecc-tools.json
.claude/skills/agent-kernel/SKILL.md
.claude/commands/*.md
.claude/identity.json
.claude/homunculus/instincts/inherited/agent-kernel-instincts.yaml
.codex/AGENTS.md
.codex/config.toml
.codex/agents/*.toml
.agents/skills/agent-kernel/SKILL.md
.agents/skills/agent-kernel/agents/openai.yaml
```

Keep credentials and private MCP details in user-level config, not in repo-local ECC files.

---

## Documentation map

Start with [`docs/README.md`](./docs/README.md).

| Need | Read |
|---|---|
| Install and connect agents | [`docs/INSTALL_AND_AGENT_SETUP.md`](./docs/INSTALL_AND_AGENT_SETUP.md) |
| Understand the operating model | [`docs/OPERATING_MODEL.md`](./docs/OPERATING_MODEL.md) |
| Current architecture | [`docs/ARCHITECTURE_NOW.md`](./docs/ARCHITECTURE_NOW.md) |
| Memory and approval protocol | [`docs/MEMORY_PROTOCOL.md`](./docs/MEMORY_PROTOCOL.md) |
| Failure Lessons | [`docs/FAILURE_LESSONS_PROTOCOL.md`](./docs/FAILURE_LESSONS_PROTOCOL.md) |
| Safe project linking | [`docs/SAFE_LINKING.md`](./docs/SAFE_LINKING.md) |
| Claude failure hook | [`docs/hooks/FAILURE_LESSONS_HOOK.md`](./docs/hooks/FAILURE_LESSONS_HOOK.md) |
| Claude hook best practices | [`docs/hooks/CLAUDE_HOOKS_BEST_PRACTICES.md`](./docs/hooks/CLAUDE_HOOKS_BEST_PRACTICES.md) |
| MCP server | [`docs/MCP_SERVER.md`](./docs/MCP_SERVER.md) |
| Agent integrations | [`docs/INTEGRATIONS.md`](./docs/INTEGRATIONS.md) |
| Guard/strict mode | [`docs/STRICT_MODE.md`](./docs/STRICT_MODE.md) |
| JSON-first storage | [`docs/JSON_FIRST_STORAGE.md`](./docs/JSON_FIRST_STORAGE.md) |

---

## Safety model

- Agents may propose memories. Only Agent Kernel publishes approved memories.
- Failure Lessons capture evidence first. Promotion creates a pending proposal, not approved memory.
- Hooks are lifecycle adapters, not hidden agents.
- Critical rules should also be backed by permissions, guard checks, git hooks, or CI.
- Repo-local configs are reviewable execution surfaces. Keep them minimal and credential-free.

Built-in guards include dangerous `rm -rf`, `curl | sh`, recursive `chmod 777`, force-push to main, `.git` deletion, and common secret patterns.

---

## Development

```bash
git clone https://github.com/imMamdouhaboammar/agent-kernel
cd agent-kernel

npm install
npm run build
npm test
npm run lint
npm run typecheck
npm run size
npm run publish:dry
```

### Project layout

```text
agent-kernel/
├── src/cli.mjs              # Core CLI source, single ESM file
├── dist/cli.mjs             # Built CLI copied from src by scripts/build.mjs
├── bin/                     # Public wrappers and helper binaries
├── scripts/                 # Build, lint, version checks
├── test/                    # Smoke orchestrator and focused test modules
├── docs/                    # Architecture and protocol docs
├── examples/                # CI guard workflow and samples
├── development/             # Roadmap
├── .claude/                 # Repo-local ECC artifacts and Claude workflow commands
├── .codex/                  # Repo-local Codex baseline and role configs
├── .agents/skills/          # Codex-facing generated repo skill
├── .github/workflows/       # CI and release automation
├── .claude-plugin/          # Claude Code marketplace manifest
├── SKILL.md                 # Skills.sh and Claude marketplace discovery
├── skills.sh.json           # Skills.sh grouping metadata
├── package.json             # npm metadata
├── tsconfig.json            # TypeScript config
├── CHANGELOG.md             # Version history
├── LICENSE                  # MIT
└── README.md                # This file
```

### Adding a command or integration

1. Edit the current runtime surface: `src/cli.mjs` for core commands or a focused `bin/` helper for intentionally standalone behavior.
2. Update help output, README, `docs/ARCHITECTURE_NOW.md`, and the relevant protocol doc.
3. Add or update a focused smoke test and wire it through `test/smoke.mjs`.
4. Run `npm run build && npm test && npm run lint && npm run typecheck`.

---

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md).

1. Branch from `master`.
2. Make focused commits.
3. Keep code, tests, docs, and discovery metadata aligned.
4. Open a PR with a clear description of what changed and why.

## License

MIT © Mamdouh Aboammar

## Links

- npm: https://www.npmjs.com/package/@mamdouh-aboammar/agent-kernel
- Repository: https://github.com/imMamdouhaboammar/agent-kernel
- Issues: https://github.com/imMamdouhaboammar/agent-kernel/issues
- Releases: https://github.com/imMamdouhaboammar/agent-kernel/releases
- Skills.sh: https://skills.sh/imMamdouhaboammar/agent-kernel
- delegate-team integration: https://github.com/imMamdouhaboammar/delegate-team/blob/master/integrations/agent-kernel.md

---

<div align="center">

*Built by [Mamdouh Aboammar](https://github.com/imMamdouhaboammar) for everyone who is tired of explaining the same standards to a new agent every morning.*

</div>
