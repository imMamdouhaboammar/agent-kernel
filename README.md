<div align='center'>

<img src='./docs/brand/agent-kernel-wordmark.svg' alt='Agent Kernel wordmark' width='420' />

<h1>Agent Kernel</h1>

<p><strong>Lightweight local memory, safety, and architecture controls for the AI coding agents you already use.</strong></p>

<p>
Install once. Give Claude Code, Codex, Cursor, Gemini CLI, OpenCode, Antigravity, and AGENTS.md-compatible tools one shared source of truth for repo rules, user preferences, workflows, debugging lessons, architecture policies, and generated agent instructions.
</p>

<p>
  <a href='https://www.npmjs.com/package/@mamdouh-aboammar/agent-kernel'><img alt='npm version' src='https://img.shields.io/npm/v/@mamdouh-aboammar/agent-kernel'></a>
  <a href='https://www.npmjs.com/package/@mamdouh-aboammar/agent-kernel'><img alt='npm downloads' src='https://img.shields.io/npm/dw/@mamdouh-aboammar/agent-kernel'></a>
  <a href='https://bundlephobia.com/package/@mamdouh-aboammar/agent-kernel'><img alt='bundle size' src='https://img.shields.io/bundlephobia/min/@mamdouh-aboammar/agent-kernel'></a>
  <a href='https://github.com/imMamdouhaboammar/agent-kernel/actions/workflows/ci.yml'><img alt='CI' src='https://github.com/imMamdouhaboammar/agent-kernel/actions/workflows/ci.yml/badge.svg'></a>
  <img alt='node' src='https://img.shields.io/badge/node-%3E%3D18.18.0-30363d'>
  <img alt='runtime dependencies' src='https://img.shields.io/badge/runtime_deps-0-30363d'>
  <a href='./LICENSE'><img alt='license' src='https://img.shields.io/badge/license-MIT-30363d'></a>
</p>

<img src='./docs/brand/agent-strip.svg' alt='Agent Kernel supported agent stack' width='900' />

</div>

---

## Why you would install this

AI coding agents are useful, but most sessions still start with missing context. The agent forgets your repo rules, repeats old mistakes, runs commands you already warned against, or produces code that works while quietly weakening the architecture.

Agent Kernel gives those agents a small local operating layer.

| Recurring problem | What Agent Kernel gives you |
|---|---|
| You repeat the same rules in every prompt | Durable local memory compiled into agent-readable files |
| Claude, Codex, Cursor, and Gemini drift from each other | One source of truth distributed to each surface |
| The same build or test failure comes back | Failure Lessons that capture command, error, root cause, and fix |
| AI-generated code creates hidden dependency drift | Architecture Guardian with maps, boundaries, contracts, baselines, and reports |
| An agent creates a second service or validator that already exists | Reuse-first symbol search before new capabilities are introduced |
| Agents find useful project rules but should not silently save them | Proposal inbox with user approval before publish |
| Existing AGENTS.md, CLAUDE.md, or Cursor rules might be damaged | Safe linking with dry-run mode and marked blocks |
| You do not want a heavy platform | A Node CLI, local JSON files, optional hooks, optional MCP |

The practical gain: keep using your current agents, but stop making each one relearn the same project context and architectural boundaries from scratch.

---

## What Agent Kernel is

Agent Kernel is not another coding agent. It does not replace Claude Code, Codex, Cursor, Gemini CLI, OpenCode, Antigravity, or any AGENTS.md-compatible tool.

It sits around them as a local control layer:

```text
your rules, preferences, workflows, notes, policies, failure lessons,
and project architecture constraints
  -> local Agent Kernel source JSON and project-local architecture state
  -> compile, safe-link, hooks, and conformance checks
  -> AGENTS.md, CLAUDE.md, GEMINI.md, Cursor rules, Codex files, reports
  -> agents start with better context and clearer boundaries next run
```

The approval boundary stays explicit:

```text
agent notices a durable lesson or architectural risk
  -> agent captures evidence or proposes memory
  -> you review the inbox, policy, contract, baseline, or exception
  -> you approve only what should last
  -> Agent Kernel publishes guidance or enforces the reviewed boundary
```

Autopilot here means repeated context and checking work is automated. Approval stays human-owned.

---

## Lightweight by design

When you install Agent Kernel, you are not taking on a large system.

It is currently:

- one npm package
- a local `~/.agent-kernel/` folder
- project-local `.agent-kernel/architecture/` state when Architecture Guardian is used
- JSON-first storage
- generated markdown and config surfaces
- optional git and Claude hooks
- optional local stdio MCP server
- optional local daemon for live context capture
- zero runtime npm dependencies

It is not:

- a hosted memory service
- a database server
- a cloud account
- a background daemon by default
- a replacement for tests, CI, code review, or software architecture decisions
- a secret store

---

## Install

```bash
npm install -g @mamdouh-aboammar/agent-kernel
agent-kernel --version
agent-kernel doctor
```

Run without global install:

```bash
npx -y @mamdouh-aboammar/agent-kernel --version
```

Requires Node.js `>=18.18.0`.

---

## Fastest safe setup

Use this path for an existing repository. It shows changes first, preserves hand-written instructions, and writes Agent Kernel content only inside marked blocks.

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
AGENTS.md                              # Claude Code, Codex, Cursor, OpenCode fallback guidance
CLAUDE.md                              # Claude Code guidance
.cursor/rules/00-agent-kernel.mdc      # Cursor rule
.codex/AGENTS.md                       # Codex guidance
.codex/config.toml                     # Codex config
.agents/agents.md                      # Antigravity-style guidance
.agents/skills/README.md               # Antigravity-style skills index
GEMINI.md                              # Gemini CLI guidance
.git/hooks/pre-commit                  # Optional guard checks when installed
```

For clean or controlled projects, the direct path is also available:

```bash
agent-kernel link . --hooks
```

For existing repositories, prefer safe-link first.

---

## Architecture Guardian

Architecture Guardian prevents working code from hiding structural regressions. It maps source dependencies, checks reviewed boundaries, searches existing capabilities, distinguishes old debt from new violations, and can block writes outside an active change contract.

Start in review mode:

```bash
cd ~/Projects/YourProject

agent-kernel architecture init .
# review and edit .agent-kernel/architecture/policy.json
agent-kernel architecture policy validate .
agent-kernel architecture discover . --json
agent-kernel architecture baseline . --json
```

Before a non-trivial change:

```bash
agent-kernel architecture contract init . \
  --task 'Add subscription cancellation' \
  --owner billing \
  --allow 'src/billing/**,test/billing/**' \
  --expect 'src/billing/cancel-subscription.ts,test/billing/cancel-subscription.test.ts' \
  --tests 'cancel active subscription,idempotent cancellation'

agent-kernel architecture reuse 'cancel subscription' . --json
agent-kernel architecture check . --json
```

Use strict mode for a blocking local or CI gate:

```bash
agent-kernel architecture check . --base origin/master --strict --json
```

Architecture Guardian provides:

- source-root-scoped architecture maps
- local dependency and circular dependency detection
- layer and forbidden dependency policies
- external package evidence and allow or deny policies
- active change contracts for files, dependencies, and test expectations
- baseline classification so old debt is not blamed on a new change
- scoped exceptions with owner, reason, and expiry
- reuse-first search across existing symbols
- review and strict modes
- Claude `PreToolUse` scope enforcement for Write, Edit, and MultiEdit
- data-driven positive and negative evaluations to reduce false positives

Read [`docs/ARCHITECTURE_GUARDIAN.md`](./docs/ARCHITECTURE_GUARDIAN.md) for the workflow and [`skills/architecture-guardian/`](./skills/architecture-guardian/) for the skill, schemas, templates, and focused references.

---

## Optional live runtime

Agent Kernel can run a small local daemon when you explicitly ask for live session evidence and context calls. It is stopped by default and binds to `127.0.0.1` unless you deliberately override it.

```bash
agent-kernel daemon start
agent-kernel daemon status
agent-kernel daemon stop
```

Runtime sessions can also be managed directly without starting the daemon:

```bash
agent-kernel session start --agent claude-code --project .
agent-kernel session observe <session-id> --type command_failure --text 'npm test failed' --command 'npm test'
agent-kernel session observations <session-id> --type command_failure
agent-kernel session list
agent-kernel session show <session-id>
agent-kernel session end <session-id>
```

Local context can be requested through CLI without starting the daemon:

```bash
agent-kernel context --query 'safe-link duplicate block' --file src/cli.mjs --budget 1200
agent-kernel context --query 'memory changes' --json
```

Runtime diagnostics are separate from the default doctor output:

```bash
agent-kernel status --runtime
agent-kernel doctor --runtime
agent-kernel doctor --runtime --json
```

The first runtime surface exposes local-only health, observation, context, and session endpoints:

```text
GET  /ak/health
GET  /ak/status
POST /ak/observe
POST /ak/context
GET  /ak/sessions
GET  /ak/sessions/:id
```

Runtime observations are evidence. They do not become approved memory unless the user promotes them through the normal proposal and approval flow.

---

## Core workflows

### Save a durable rule

Use `remember` when you are acting as the user:

```bash
agent-kernel remember 'Never add local SQLite fallback to production Supabase apps.' --type policy --level critical --tags supabase,database --publish
```

When an agent finds a useful rule, it should propose it instead:

```bash
agent-kernel propose --from claude --text 'Use pnpm in this repository.' --reason 'User corrected the package manager during setup.'
agent-kernel inbox
agent-kernel approve <proposal-id> --publish
```

### Turn repeated errors into Failure Lessons

Capture the useful parts of a failure:

```bash
agent-kernel failure capture --from claude --type test-failure --command 'npm test' --exit-code 1 --text 'ERR_MODULE_NOT_FOUND' --root-cause 'Node ESM import path missed its explicit extension.' --fix 'Add the explicit .js extension to the relative import.'
```

Search before retrying a familiar issue:

```bash
agent-kernel failure search ERR_MODULE_NOT_FOUND
```

Promote a recurring lesson into reviewable memory:

```bash
agent-kernel failure propose <failure-lesson-id> --as rule
agent-kernel inbox
agent-kernel approve <proposal-id> --publish
```

### Prevent architecture drift

```bash
agent-kernel architecture doctor .
agent-kernel architecture discover . --json
agent-kernel architecture reuse 'validate customer email' . --json
agent-kernel architecture check . --strict --json
```

If the same architectural mistake repeats, capture the failed check as a Failure Lesson, then propose a durable rule for user review rather than silently changing policy.

### Capture project history as episodes

```bash
agent-kernel episode add --title 'Stripe webhook bug fix' --tags stripe,webhook,bug --text 'Root cause: missing signature verification. Fix: verify signature via stripe.webhooks.constructEvent().'
agent-kernel episode search 'stripe webhook'
agent-kernel episode show <episode-id>
```

---

## Planned: Bundle your KB

Knowledge Bundle is a planned sharing layer for Agent Kernel.

The idea: package approved memory, Failure Lessons, policies, skills, workflows, and selected episodes into one portable `.akb` file. Another user can inspect it, diff it against their local memory, import it to their review inbox, approve selected items, then publish and link the result into their own agent surfaces.

Proposed command shape:

```bash
agent-kernel bundle create ./team-agent-kernel.akb --scope approved --redact
agent-kernel bundle inspect ./team-agent-kernel.akb
agent-kernel bundle diff ./team-agent-kernel.akb
agent-kernel bundle import ./team-agent-kernel.akb --to inbox
agent-kernel bundle install ./team-agent-kernel.akb --review --publish --link .
```

Default behavior should be review-first. A bundle should not silently overwrite another user's approved memory.

See [`docs/BUNDLE_KB.md`](./docs/BUNDLE_KB.md).

---

## Command surface

```text
agent-kernel init [--sync] [--enforce]
agent-kernel doctor [--runtime]
agent-kernel compile
agent-kernel sync
agent-kernel link [project] [--hooks]
agent-kernel remember <text> [--type rule] [--level critical] [--publish]
agent-kernel propose --from claude --text <text> --reason <reason>
agent-kernel inbox
agent-kernel approve <id> [--publish]
agent-kernel reject <id>
agent-kernel publish
agent-kernel validate
agent-kernel migrate json [--publish]
agent-kernel memory list|search|show
agent-kernel episode add|sync|search|show|stats|reindex
agent-kernel failure capture|learn|list|search|show|propose|promote|validate
agent-kernel architecture init|discover|baseline|diff|check|reuse|contract|exception|policy|doctor
agent-kernel context [--query text] [--file path] [--budget 1200]
agent-kernel daemon start|stop|restart|status
agent-kernel session start|end|list|show|observe|observations
agent-kernel enforce install
agent-kernel guard [--staged|--file path]
agent-kernel git-hook install [project]
agent-kernel mcp serve|config|install
agent-kernel start <claude|codex|cursor|antigravity|gemini> [project]
agent-kernel status [--runtime]
```

Helper binaries:

```text
agent-kernel-safe-link
agent-kernel-safe-git-hook
agent-kernel-agent-propose
agent-kernel-failure
agent-kernel-failure-hook
agent-kernel-architecture
agent-kernel-architecture-hook
agent-kernel-daemon
agent-kernel-runtime-doctor
agent-kernel-session
agent-kernel-context
agent-kernel-mode
agent-kernel-agent-write
ak
```

---

## Agent integrations

| Agent or surface | Output or integration |
|---|---|
| Claude Code | `CLAUDE.md`, context and architecture hooks, MCP config, marketplace plugin metadata, repo-local skills |
| Codex | `AGENTS.md`, `.codex/AGENTS.md`, `.codex/config.toml`, repo-local skills |
| Cursor | `.cursor/rules/00-agent-kernel.mdc` |
| OpenCode / AGENTS-compatible agents | `AGENTS.md` |
| Antigravity | `.agents/agents.md`, `.agents/skills/*` |
| Gemini CLI | `GEMINI.md` |
| Skills.sh | `SKILL.md`, `skills.sh.json`, `skills/architecture-guardian/SKILL.md` |

Keep credentials and private MCP details in user-level config, not in repo-local generated files.

---

## Safety model

- Agents may propose memories. Only Agent Kernel publishes approved memories.
- Failure Lessons capture evidence first. Promotion creates a pending proposal, not approved memory.
- Architecture policies, baselines, contracts, and exceptions are review artifacts. Agents should not silently broaden them.
- Review mode surfaces candidate blockers. Strict mode enforces reviewed blocking severities.
- Baseline findings stay visible but do not fail an unrelated change.
- Exceptions require scope, reason, owner, and expiry.
- Hooks are lifecycle adapters, not hidden agents.
- Critical rules should also be backed by permissions, guard checks, hooks, or CI.
- Repo-local configs are reviewable execution surfaces. Keep them minimal and credential-free.
- Built-in guards include dangerous `rm -rf`, `curl | sh`, recursive `chmod 777`, force-push to main, `.git` deletion, and common secret patterns.

---

## Documentation map

Start with [`docs/README.md`](./docs/README.md).

| Need | Read |
|---|---|
| Install and connect agents | [`docs/INSTALL_AND_AGENT_SETUP.md`](./docs/INSTALL_AND_AGENT_SETUP.md) |
| Understand the operating model | [`docs/OPERATING_MODEL.md`](./docs/OPERATING_MODEL.md) |
| Current repository architecture | [`docs/ARCHITECTURE_NOW.md`](./docs/ARCHITECTURE_NOW.md) |
| Prevent AI-generated architecture drift | [`docs/ARCHITECTURE_GUARDIAN.md`](./docs/ARCHITECTURE_GUARDIAN.md) |
| Architecture command reference | [`docs/architecture-guardian/COMMAND_REFERENCE.md`](./docs/architecture-guardian/COMMAND_REFERENCE.md) |
| Troubleshoot setup or runtime issues | [`docs/TROUBLESHOOTING.md`](./docs/TROUBLESHOOTING.md) |
| AI agent contributor runbook | [`docs/AGENT_RUNBOOK.md`](./docs/AGENT_RUNBOOK.md) |
| Memory and approval protocol | [`docs/MEMORY_PROTOCOL.md`](./docs/MEMORY_PROTOCOL.md) |
| Failure Lessons | [`docs/FAILURE_LESSONS_PROTOCOL.md`](./docs/FAILURE_LESSONS_PROTOCOL.md) |
| Knowledge Bundle plan | [`docs/BUNDLE_KB.md`](./docs/BUNDLE_KB.md) |
| Safe project linking | [`docs/SAFE_LINKING.md`](./docs/SAFE_LINKING.md) |
| Claude failure hook | [`docs/hooks/FAILURE_LESSONS_HOOK.md`](./docs/hooks/FAILURE_LESSONS_HOOK.md) |
| Claude hook best practices | [`docs/hooks/CLAUDE_HOOKS_BEST_PRACTICES.md`](./docs/hooks/CLAUDE_HOOKS_BEST_PRACTICES.md) |
| MCP server | [`docs/MCP_SERVER.md`](./docs/MCP_SERVER.md) |
| Agent integrations | [`docs/INTEGRATIONS.md`](./docs/INTEGRATIONS.md) |
| Guard/strict mode | [`docs/STRICT_MODE.md`](./docs/STRICT_MODE.md) |
| JSON-first storage | [`docs/JSON_FIRST_STORAGE.md`](./docs/JSON_FIRST_STORAGE.md) |

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

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) before changing runtime behavior.

---

## Links

- npm: https://www.npmjs.com/package/@mamdouh-aboammar/agent-kernel
- Repository: https://github.com/imMamdouhaboammar/agent-kernel
- Issues: https://github.com/imMamdouhaboammar/agent-kernel/issues
- Releases: https://github.com/imMamdouhaboammar/agent-kernel/releases
- Skills.sh: https://skills.sh/imMamdouhaboammar/agent-kernel
- delegate-team integration: https://github.com/imMamdouhaboammar/delegate-team/blob/master/integrations/agent-kernel.md

## License

MIT © Mamdouh Aboammar

---

<div align='center'>

*Built by [Mamdouh Aboammar](https://github.com/imMamdouhaboammar) for everyone who is tired of explaining the same standards to a new agent every morning.*

</div>
