# MCP guard command

MCP clients can ask Agent Kernel whether a command would be blocked.

## Tool

```text
agent_kernel_guard_command
```

## Use cases

- check a shell command before execution
- explain why a risky command is denied
- test policy behavior from an MCP-capable agent

## Safety rule

A successful guard check is not a full security audit. It only checks the configured command policy patterns.
