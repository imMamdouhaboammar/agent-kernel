# Generic agent proposal helper

`agent-kernel-agent-propose` is the smallest cross-agent write path.

It lets any coding agent create a pending memory proposal without knowing the internal `~/.agent-kernel/inbox/` layout.

## Why this matters

The product goal is shared memory across coding agents. A user should not need to repeat the same preference, project rule, or architecture decision every time they switch between Claude Code, Codex, Cursor, Antigravity, OpenCode, Gemini CLI, or another agent.

The helper gives agents a simple rule:

> When the user asks you to remember something, call `agent-kernel-agent-propose`.

The proposal still waits for user approval. It does not become global memory by itself.

## Usage

```bash
agent-kernel-agent-propose \
  --from codex \
  --reason "User asked to save this preference for future agents." \
  --text "Use pnpm for this repository unless the repo already defines another package manager."
```

From stdin:

```bash
echo "Never add local SQLite fallback to production Supabase apps." | \
  agent-kernel-agent-propose \
    --from cursor \
    --reason "User corrected this behavior twice."
```

Optional fields:

```bash
--type rule|policy|preference|workflow|project-note|skill-trigger
--scope global|project
--level critical|standard|note
--targets all,claude,codex,cursor
--tags supabase,database,production
```

## Review flow

```bash
agent-kernel inbox
agent-kernel approve <proposal-id> --publish
# or
agent-kernel reject <proposal-id>
```

## Agent integration rule

Add this guidance to any agent instruction file:

```md
When the user asks you to remember a rule, preference, project fact, rejected approach, or repeated correction, do not edit generated files directly. Create a pending memory proposal:

agent-kernel-agent-propose --from <agent-name> --reason "<why this should be remembered>" --text "<exact memory>"
```

## Safety boundary

This helper intentionally does not approve or publish memory. It only writes to the normal proposal workflow through `agent-kernel propose`.
