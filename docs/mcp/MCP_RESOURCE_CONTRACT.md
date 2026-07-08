# MCP resource contract

Agent Kernel MCP resources expose read-only views of local memory state.

## Expected resources

```text
agent-kernel://constitution
agent-kernel://policy
agent-kernel://memories/rules
agent-kernel://episodes/index
agent-kernel://inbox/pending
```

## Safety rule

Resources should not expose raw secrets, environment variables, or full private transcripts by default.
