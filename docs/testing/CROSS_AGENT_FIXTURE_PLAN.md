# Cross-agent fixture plan

Agent Kernel needs fixtures that simulate different agent integration styles.

## Fixture types

```text
claude-hook-capable
codex-agents-md
cursor-rules
antigravity-agents-folder
opencode-agents-md
gemini-md
mcp-client
file-reader-only
```

## Pass condition

Each fixture can read shared memory and either create a proposal directly or instruct the user how to create one.
