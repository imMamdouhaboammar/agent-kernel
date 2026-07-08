# Claude Code adapter contract

Claude Code is the strongest current integration path because it can use instruction files, MCP, and native hook events.

## Read path

Claude should read:

```text
~/.claude/CLAUDE.md
project/CLAUDE.md when present
project/AGENTS.md when present
```

## Write path

Claude should create memory proposals through one of these paths:

```bash
agent-kernel propose --from claude --text "<memory>" --reason "<reason>"
agent-kernel-agent-propose --from claude --text "<memory>" --reason "<reason>"
```

## Hook path

Claude can use:

- `SessionStart` for context injection
- `UserPromptSubmit` for memory capture triggers
- `PreToolUse` for command and path checks
- `PostToolUse` for file scans

## Safety rule

Claude must not edit generated Agent Kernel files directly. It should propose memory, wait for approval, then let the kernel publish.
