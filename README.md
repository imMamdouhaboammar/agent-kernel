# Agent Kernel

Shared memory, rules, and safety for every AI coding agent on your machine.

Agent Kernel is a local-first governance layer for Claude Code, Codex, Cursor, Antigravity, Gemini CLI, OpenCode, and other coding agents. It gives them one shared source of truth for rules, preferences, workflows, project notes, episodes, policy guards, and reusable failure lessons.

---

## What is this?

`agent-kernel` is the memory + governance layer for any agentic-coding workflow.
Instead of repeating "use TypeScript strict mode" or "always run pnpm typecheck" in every prompt, save the rule once and every agent in every project can use it.

| Without agent-kernel | With agent-kernel |
|---|---|
| Standards repeated in every prompt | Standards live in `~/.agent-kernel/source/memories/*.json` and auto-attach |
| Lost context after session end | Episodes saved locally; searchable later via `agent-kernel episode search` |
| Same build/test error solved repeatedly | Failure Lessons capture the error, dedupe it, and let you promote it to a rule/workflow/skill |
| Agent writes whatever rule it wants | Proposal inbox; you approve before publish |
| Manual `git commit` may leak secrets | Pre-commit hook + `agent-kernel guard --staged` blocks |
| Different agents see different rules | One JSON-first source compiles to all platforms |

Try it:

```bash
npm install -g @mamdouh-aboammar/agent-kernel
agent-kernel --version
agent-kernel doctor
```

---

## Quick start

### 1. Install

```bash
npm install -g @mamdouh-aboammar/agent-kernel
npx -y @mamdouh-aboammar/agent-kernel --version
```

### 2. Initialize in your project

```bash
cd ~/Projects/YourProject
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

The next time any agent in any project touches that code, the rule auto-attaches to its context.

### 4. Capture a failure lesson

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

Later:

```bash
agent-kernel failure search "ERR_MODULE_NOT_FOUND"
agent-kernel failure propose <failure-lesson-id> --as rule
agent-kernel inbox
agent-kernel approve <proposal-id> --publish
```

Repeated captures of the same project + command + error signature update the existing lesson and increment `occurrences` instead of creating noisy duplicates.

### 5. Capture an episode

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

### 6. Health check

```bash
agent-kernel doctor
agent-kernel status
```

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
agent-kernel start <claude|codex|cursor|antigravity|gemini> [project]
agent-kernel status
```

Full reference: see [`docs/`](./docs).

---

## Memory layout

```text
~/.agent-kernel/                              # Memory home (configurable via AGENT_KERNEL_HOME)
  config.json                                 # User's settings (level, targets, etc.)
  source/
    memories/
      rules.json                              # Always-follow rules
      preferences.json                        # Style preferences
      workflows.json                          # How-to steps
      project-notes.json                      # Per-project facts
      skills.json                             # Available skills
    failures/
      failure-lessons.json                    # Captured coding failures and fix recipes
    schemas/                                  # JSON Schema for validation
    policies/policies.json                    # Policy pack arrays
  episodes/
    archive/                                  # Past session snapshots
    index.json                                # Searchable index
    sources.json                              # Where episodes were captured from
  inbox/
    pending/                                  # Agent proposals waiting for approval
    approved/                                 # Approved audit copies
    rejected/                                 # Rejected audit copies
  dist/                                       # Compiled instruction files
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
    failures.jsonl
```

---

## Compatibility

| Agent | Memory source | Hook install | Compile target |
|---|---|---|---|
| Claude Code | yes | yes `~/.claude/hooks/` | `PreToolUse` + `PostToolUse` |
| Codex | yes | n/a | `AGENTS.md` |
| Cursor | yes | n/a | `.mdc` rule |
| OpenCode | yes | n/a | `AGENTS.md` |
| Antigravity | yes | n/a | `.agents/` |
| Gemini CLI | yes | n/a | `GEMINI.md` |
| 60+ others | yes via Skills.sh index | depends on agent | via `AGENTS.md` |

Memory layout is backward compatible with v0.0.1. `agent-kernel migrate json --publish` upgrades in place.

---

## Safety model

- Agents may propose memories. Only `agent-kernel` publishes memories.
- Failure Lessons capture locally first. Promotion creates a pending proposal, not approved memory.
- Generated markdown files are not treated as the only defense.
- Critical rules should also be backed by hooks, scanners, git hooks, or CI checks.

Built-in guards:

```text
dangerous-rm       rm -rf / or rm -rf ~        blocked
curl-pipe-shell    curl ... | sh               blocked
chmod-777          chmod -R 777                blocked
force-push-main    git push --force main       blocked
delete-git         rm -rf .git                 blocked
secret-leak        OPENAI/ANTHROPIC/SUPABASE/Google API keys blocked
```

---

## Integrations

- delegate-team — bundled inside `delegate-team` v2.5.0+ at `agent-kernel/`.
- MCP — every core command is exposed as an MCP tool. See [`docs/MCP_SERVER.md`](./docs/MCP_SERVER.md).
- Skills.sh — discoverable via `npx skills add imMamdouhaboammar/agent-kernel -a claude-code -g -y`.

---

## Development

```bash
git clone https://github.com/imMamdouhaboammar/agent-kernel
cd agent-kernel

npm install
npm run build
npm test
npm run typecheck
npm run lint
npm run size
npm run publish:dry
```

### Project layout

```text
agent-kernel/
├── src/cli.mjs              # Source CLI (single ESM file)
├── dist/cli.mjs             # Built CLI (copied from src via scripts/build.mjs)
├── bin/                     # Public wrappers and helper binaries
├── scripts/                 # Build, lint, version checks
├── test/                    # Focused smoke test modules
├── docs/                    # Architecture + protocol docs
├── examples/                # CI guard workflow + samples
├── development/             # Roadmap
├── .github/workflows/       # CI + release automation
├── .claude-plugin/          # Claude Code marketplace manifest
├── SKILL.md                 # Skills.sh + Claude marketplace discovery
├── package.json             # npm metadata
├── tsconfig.json            # TypeScript config
├── CHANGELOG.md             # Version history
├── LICENSE                  # MIT
└── README.md                # This file
```

### Adding a new command

The core CLI is a single `src/cli.mjs` file. Thin helpers in `bin/` may route focused standalone behavior when it is intentionally outside the current single-file runtime.

1. Edit the relevant CLI/helper file.
2. Update help output, README, and docs.
3. Add or update a focused smoke test.
4. Run `npm run build && npm test`.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). For now:

1. Fork and branch from `master`.
2. Run `npm install && npm test` locally.
3. Make focused commits.
4. Open a PR with a clear description of what changed and why.

## License

MIT © Mamdouh Aboammar

## Links

- npm — https://www.npmjs.com/package/@mamdouh-aboammar/agent-kernel
- Repository — https://github.com/imMamdouhaboammar/agent-kernel
- Issues — https://github.com/imMamdouhaboammar/agent-kernel/issues
- Releases — https://github.com/imMamdouhaboammar/agent-kernel/releases
- Skills.sh — https://skills.sh/imMamdouhaboammar/agent-kernel
- delegate-team integration — https://github.com/imMamdouhaboammar/delegate-team/blob/master/integrations/agent-kernel.md

---

<div align="center">

*Built by [Mamdouh Aboammar](https://github.com/imMamdouhaboammar) for everyone who is tired of explaining the same standards to a new agent every morning.*

</div>
