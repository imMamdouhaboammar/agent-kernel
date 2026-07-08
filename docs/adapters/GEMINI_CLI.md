# Gemini CLI adapter contract

Gemini CLI should use Agent Kernel through generated `GEMINI.md`, shared `AGENTS.md`, and explicit proposal commands.

## Read path

Gemini CLI should read:

```text
~/.gemini/GEMINI.md
project/GEMINI.md
project/AGENTS.md
```

## Write path

When Gemini CLI captures a durable user preference or project rule, it should create a proposal:

```bash
agent-kernel-agent-propose --from gemini --reason "<reason>" --text "<memory>"
```

## Hook reality

Gemini CLI support should be treated as file-based unless a tested hook or wrapper integration is added.

## Safety rule

Gemini should not write directly to approved memory JSON. It should use the proposal workflow.
