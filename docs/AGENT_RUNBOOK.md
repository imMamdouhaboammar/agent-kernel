# AI agent runbook

This runbook is for AI coding agents working on the `agent-kernel` repository or using Agent Kernel inside another project.

The goal is simple: make useful changes without guessing, overwriting durable context, or turning generated files into fake source of truth.

---

## Prime directive

Before changing runtime behavior, read:

1. `AGENTS.md`
2. `docs/ARCHITECTURE_NOW.md`
3. `docs/OPERATING_MODEL.md`
4. The relevant protocol doc for the area being changed

Do not use roadmap files as proof of shipped behavior. Current runtime behavior is determined by the code and `docs/ARCHITECTURE_NOW.md`.

---

## First-response checklist

When the user asks you to work on this repo:

1. Identify the request type.
2. Inspect the relevant files before editing.
3. State any risky assumption briefly.
4. Make the smallest coherent change.
5. Update tests and docs when behavior changes.
6. Capture repeated failures instead of blind retrying.
7. Leave a clear summary of changed files and validation.

---

## Request type matrix

| User asks for | First files to inspect | Expected output |
|---|---|---|
| Docs improvement | `README.md`, `docs/README.md`, relevant docs | Focused docs PR |
| Runtime command change | `src/cli.mjs`, `test/smoke.mjs`, focused tests | Code, tests, docs, changelog |
| Helper binary change | `bin/*.mjs`, `package.json#bin`, tests | Helper update and smoke coverage |
| Safe-link issue | `bin/agent-kernel-safe-link.mjs`, `docs/SAFE_LINKING.md`, safe-link tests | Idempotent fix with regression test |
| Hook issue | hook docs, hook helper binary, examples | Narrow event-specific hook update |
| MCP issue | `docs/MCP_SERVER.md`, MCP code path, tests | MCP fix with trust boundary intact |
| Failure Lessons issue | Failure Lessons protocol, helper, schema, tests | Capture/search/promote behavior fix |
| Release issue | `package.json`, `CHANGELOG.md`, workflows, `CONTRIBUTING.md` | Release metadata and verification |

---

## Safe editing rules

### Runtime source

The core runtime is currently:

```text
src/cli.mjs -> scripts/build.mjs -> dist/cli.mjs
```

Rules:

- edit `src/cli.mjs` for core runtime behavior
- run build to regenerate `dist/cli.mjs`
- do not hand-edit `dist/cli.mjs`
- do not add production behavior under placeholder folders unless the modularization is wired into runtime and tests

Placeholder folders today:

```text
src/adapters/
src/commands/
src/core/
src/hooks/
```

### Generated project files

Do not manually edit generated Agent Kernel outputs as the durable fix.

Generated files include:

```text
~/.agent-kernel/dist/AGENTS.md
~/.agent-kernel/dist/CLAUDE.md
~/.agent-kernel/dist/GEMINI.md
project AGENTS.md Agent Kernel marked block
project CLAUDE.md Agent Kernel marked block
project GEMINI.md Agent Kernel marked block
.cursor/rules/00-agent-kernel.mdc Agent Kernel block
.agents/agents.md Agent Kernel block
```

If generated output is wrong, fix the source memory, compiler behavior, or docs, then regenerate.

---

## Memory rules for agents

Agents may propose memory. Agents should not approve or publish memory silently.

Use proposal flow:

```bash
agent-kernel propose \
  --from <agent> \
  --text "<durable memory>" \
  --reason "<why this should persist>"
```

Or use the helper:

```bash
agent-kernel-agent-propose --from <agent> --reason "<reason>" --text "<memory>"
```

The user should review:

```bash
agent-kernel inbox
agent-kernel approve <proposal-id> --publish
```

Do not bypass this by editing memory JSON directly unless the user explicitly asks for a direct maintenance operation.

---

## Failure behavior

When a command fails in a repeatable way, capture it before retry loops.

```bash
agent-kernel failure capture \
  --from <agent> \
  --type test-failure \
  --command "<command>" \
  --exit-code <code> \
  --text "<error output>" \
  --root-cause "<why it happened>" \
  --fix "<smallest known fix>"
```

Before retrying a similar failure:

```bash
agent-kernel failure search "<error code or signature>"
```

Promote only reusable lessons:

```bash
agent-kernel failure propose <failure-lesson-id> --as rule
```

Valid promotion targets:

```text
rule
policy
workflow
skill
note
```

---

## Hook boundaries

Hooks are lifecycle adapters, not hidden agents.

Allowed hook behavior:

- block dangerous commands before execution
- capture failed tool payloads
- add short context where the agent platform supports it
- write local evidence for review

Disallowed hook behavior:

- approve memory
- publish memory
- rewrite source memory without review
- run broad autonomous workflows
- leak secrets or private MCP credentials

Claude failure capture should prefer:

```text
PostToolUseFailure
narrow matchers
exec-form command hooks
short timeouts
structured JSON output
```

---

## MCP boundaries

MCP should help agents inspect and propose, not silently govern.

Default safe MCP uses:

- inspect status
- search memory
- propose memory
- list pending proposals
- run guard checks
- work with episodes where supported

Approval through MCP is disabled by default. Do not enable it unless the user explicitly asks for a trusted local workflow.

---

## Change discipline

### For code changes

Run:

```bash
npm install
npm run build
npm test
npm run lint
npm run typecheck
```

Also run targeted tests when available.

Update:

```text
README.md
docs/ARCHITECTURE_NOW.md
relevant protocol doc
CHANGELOG.md
SKILL.md if discovery surface changes
```

### For docs-only changes

Check:

- command examples exist in the current package
- docs link to real files
- `docs/README.md` reading path stays accurate
- docs do not claim planned behavior as shipped
- `CHANGELOG.md` has an Unreleased entry when the change is release-visible

### For discovery changes

Keep these aligned:

```text
README.md
SKILL.md
skills.sh.json
.claude-plugin/marketplace.json
.claude-plugin/plugin.json
.claude/skills/agent-kernel/SKILL.md
.agents/skills/agent-kernel/SKILL.md
```

---

## Anti-patterns

Avoid these patterns:

- editing `dist/cli.mjs` by hand
- adding runtime files under placeholder folders without wiring them
- changing package version in one manifest but not the others
- replacing hand-written project `AGENTS.md` content with generated content
- broad hook matchers that run on every event
- turning one local error into a global policy too early
- hiding generated or temporary state in committed files
- changing docs without checking current command names

---

## PR summary template

Use this shape in the final message or PR body:

```md
## Summary

<one paragraph>

## Changed files

- `<path>`: <what changed>

## Validation

- `<command>`: <result>

## Notes

- <known limitation or follow-up, if any>
```

If validation could not be run, say so directly and explain why.
