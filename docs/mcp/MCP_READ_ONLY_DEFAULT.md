# MCP read-only default

Agent Kernel MCP should prefer read-only behavior by default.

## Read tools

Read tools may expose:

- status
- approved memories
- compiled constitution
- episode search
- episode read
- pending proposal list

## Write tools

Proposal creation is allowed because it does not approve memory.

## Restricted tools

Approval and publish through MCP should remain disabled unless the user intentionally enables them.

## Safety rule

MCP clients are not automatically trusted just because they can connect.
