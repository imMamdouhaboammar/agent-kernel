# MCP stdio mode

Agent Kernel MCP currently runs through stdio.

## Command

```bash
agent-kernel mcp serve
```

## Client config example

```json
{
  "type": "stdio",
  "command": "agent-kernel",
  "args": ["mcp", "serve"]
}
```

## Safety rule

stdio mode should not assume the MCP client is trusted. Tool-level risk boundaries still apply.
