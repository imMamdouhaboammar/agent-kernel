# Failure Lessons Protocol

Failure Lessons turns repeated coding errors into reviewable local knowledge.

The goal is simple: when an agent hits a build error, test failure, broken import, unsafe edit, or repeated user correction, the failure should not disappear into the chat. Agent Kernel should capture the failure, record the fix path, and let the user promote that lesson into an approved rule, workflow, skill trigger, or policy.

## Problem

AI coding agents often solve the same class of problem more than once:

- a Node ESM import misses its explicit `.js` extension
- a Vite build fails because an env variable was read from the wrong side of the app
- a Supabase app receives a fake local SQLite fallback
- a generated patch rewrites too much code to fix a small bug
- a test fails because the agent did not inspect the repo conventions first

Without a durable loop, every project starts from zero.

## Core loop

```text
failure happens
  -> capture failure evidence
  -> dedupe by project + command + error signature
  -> store or update local failure lesson
  -> search similar lessons before retrying
  -> propose durable memory
  -> user approves or rejects
  -> publish to agent guidance
```

## Storage

Captured lessons are stored locally at:

```text
~/.agent-kernel/source/failures/failure-lessons.json
```

The file is intentionally separate from approved memories. Failure evidence is not automatically a rule. It must pass through proposal and approval before it affects other agents.

The schema lives at:

```text
docs/schemas/failure-lesson.schema.json
```

## Dedupe model

Capture computes a deterministic fingerprint from:

```text
project + command + errorSignature
```

If the same failure is captured again, the existing lesson is updated instead of creating a duplicate record. The lesson keeps:

- `occurrences`
- `firstSeenAt`
- `lastSeenAt`
- merged symptoms
- merged fix recipe
- merged tags and targets

Use this only when the repeated error is the same technical pattern. To force a separate record:

```bash
agent-kernel failure capture --allow-duplicate --text "..."
```

## CLI

Capture a failed command:

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

Search previous lessons before retrying a fix:

```bash
agent-kernel failure search "ERR_MODULE_NOT_FOUND"
```

Inspect a lesson:

```bash
agent-kernel failure show <failure-lesson-id>
```

Validate stored lessons:

```bash
agent-kernel failure validate
agent-kernel failure validate --json
```

Propose it as durable memory:

```bash
agent-kernel failure propose <failure-lesson-id> --as rule
```

Shortcut capture and proposal:

```bash
agent-kernel failure learn \
  --from codex \
  --type build-failure \
  --text "TS2307: Cannot find module ./thing" \
  --root-cause "The generated import path did not match the file layout." \
  --fix "Inspect the actual file tree before writing the import." \
  --as workflow
```

## Promotion types

| Promotion | Use when | Resulting memory type |
|---|---|---|
| `--as rule` | The lesson is a general prevention rule | `rule` |
| `--as policy` | The mistake must be blocked or treated as critical | `policy` |
| `--as workflow` | The lesson is a repeatable debug process | `workflow` |
| `--as skill` | The lesson should trigger a reusable procedure | `skill-trigger` |
| `--as note` | The lesson is project-specific context | `project-note` |

## Agent behavior

Agents should follow this sequence when a command, test, or edit fails:

1. Capture the failure with `agent-kernel failure capture` or the installed hook.
2. Search for similar failures with `agent-kernel failure search <signature>`.
3. Apply the smallest fix that matches the known lesson.
4. Run the same failing command again.
5. If the failure was useful and likely to repeat, propose it with `agent-kernel failure propose <id> --as rule`.
6. Do not approve the proposal unless the user explicitly asks for that approval path.

## Safety rules

Failure Lessons must not store secrets. The capture command refuses common API key and token patterns.

Failure Lessons must not silently rewrite approved memory. Promotion creates a pending proposal, matching the existing Agent Kernel approval model.

Failure Lessons should not turn every one-off typo into a global rule. Promote only patterns that are likely to repeat across projects or agents.

## What this adds to Agent Kernel

This protocol adds a missing loop between episodic memory and approved rules:

- episodic memory records what happened
- failure lessons record why a technical failure happened and how it was fixed
- approved memory controls what agents should do next time

The kernel remains the source of truth. Agents can capture and propose, but the user approves.
