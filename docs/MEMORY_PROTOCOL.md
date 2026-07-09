# Memory Protocol

Agent Kernel uses local JSON files as the source of truth for durable agent memory. Agents may propose memory. The user approves. The kernel publishes.

The protocol is:

```text
Capture intent -> Propose -> Review -> Approve or reject -> Publish -> Sync/link to agents
```

## Source of truth

Approved memory lives under the Agent Kernel home directory:

```text
~/.agent-kernel/source/memories/rules.json
~/.agent-kernel/source/memories/preferences.json
~/.agent-kernel/source/memories/workflows.json
~/.agent-kernel/source/memories/project-notes.json
~/.agent-kernel/source/memories/skills.json
~/.agent-kernel/source/policies/policies.json
```

Pending review items live in:

```text
~/.agent-kernel/inbox/pending/*.json
```

Approved and rejected audit copies live in:

```text
~/.agent-kernel/inbox/approved/*.json
~/.agent-kernel/inbox/rejected/*.json
```

Generated files under `~/.agent-kernel/dist/` are disposable outputs. Do not edit generated markdown directly.

## Memory types

| Type | Use for | Example |
|---|---|---|
| `rule` | Durable instruction the agents should follow | "Use explicit `.js` extensions in Node ESM imports." |
| `policy` | Stronger control or safety boundary | "Never add local SQLite fallback to production Supabase apps." |
| `preference` | User or team style preference | "Prefer concise status updates during long tasks." |
| `workflow` | Repeatable process | "Before changing a CLI command, update help, docs, and smoke tests." |
| `project-note` | Project-specific context | "This repo keeps core runtime in `src/cli.mjs`." |
| `skill-trigger` | A reusable skill invocation rule | "Use Failure Lessons when a build/test failure repeats." |

## Manual memory

Use `remember` when the user explicitly wants a durable instruction saved now.

```bash
agent-kernel remember "Use pnpm in TypeScript CLI projects." \
  --type rule \
  --level standard \
  --tags node,typescript \
  --publish
```

`--publish` immediately compiles the updated memory into generated agent files.

## Agent-proposed memory

Agents must not edit source JSON files or generated markdown files directly.

They should run:

```bash
agent-kernel propose \
  --from claude \
  --type rule \
  --scope global \
  --level standard \
  --targets all \
  --tags node,esm \
  --text "Use explicit .js extensions for local Node ESM imports." \
  --reason "This prevented ERR_MODULE_NOT_FOUND in the current repo."
```

The proposal lands in:

```text
~/.agent-kernel/inbox/pending/<proposal-id>.json
```

The agent stops there. Approval is a user action.

## Review

```bash
agent-kernel inbox
agent-kernel memory search supabase
agent-kernel memory show <memory-id>
```

Review should answer three questions:

1. Is the memory true?
2. Is it likely to be useful again?
3. Is the scope correct: global or project?

## Approve and publish

```bash
agent-kernel approve <proposal-id> --publish
```

Approval moves the pending item into approved audit history, writes the durable memory into `source/memories/*.json`, then publishes generated agent guidance.

## Reject

```bash
agent-kernel reject <proposal-id>
```

Rejection keeps an audit copy but does not affect generated guidance.

## Publish and sync

`publish` compiles the current source memory into `~/.agent-kernel/dist/`.

```bash
agent-kernel publish
agent-kernel sync
```

`sync` pushes compiled guidance to supported global agent locations where configured.

`link` writes project-local guidance:

```bash
agent-kernel link . --hooks
```

## Validation

```bash
agent-kernel validate
```

Validation checks shape, duplicate IDs, required fields, supported values, likely secret leakage, and policy pack arrays.

Use validation before releases and after direct manual edits.

## Failure Lessons are not approved memory

Failure Lessons live separately:

```text
~/.agent-kernel/source/failures/failure-lessons.json
```

A captured failure is evidence, not a rule. It must be promoted into a pending proposal first:

```bash
agent-kernel failure propose <failure-lesson-id> --as rule
agent-kernel inbox
agent-kernel approve <proposal-id> --publish
```

This keeps the loop safe:

```text
failure evidence -> pending proposal -> human approval -> durable memory
```

## Hooks and trigger phrases

A Claude `UserPromptSubmit` hook may watch for prompts containing durable-memory phrases such as:

```text
AK remember:
AK rule:
remember this
save this
خلي دي rule
احفظ دي
احفظها لباقي agents
```

When matched, the hook should create a pending proposal and return instructions for review. It must not silently approve or publish memory.

## Direct edit policy

Direct edits are acceptable only for maintainers doing controlled maintenance. After direct edits:

```bash
agent-kernel validate
agent-kernel publish
agent-kernel sync
```

Agents should never perform direct edits to memory source files unless the user explicitly asks for that low-level operation.
