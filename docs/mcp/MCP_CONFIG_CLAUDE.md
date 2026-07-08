# MCP Claude config

Claude can connect to Agent Kernel through the MCP stdio server.

## Generate config

```bash
agent-kernel mcp config claude
```

## Install config

```bash
agent-kernel mcp install claude
```

## Expected server name

```text
agent-kernel-memory
```

## Safety rule

Installing MCP should not approve or publish any memory by itself.
