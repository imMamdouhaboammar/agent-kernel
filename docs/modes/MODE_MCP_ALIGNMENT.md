# Mode MCP alignment

MCP write tools should respect Agent Kernel mode.

## Desired alignment

- approval: MCP proposal write only
- trusted: MCP may propose; low-risk auto-write requires explicit trusted tool support
- bypass: direct write may be allowed only after explicit mode selection

## Current safe baseline

Keep MCP approval disabled by default.

## Safety rule

MCP clients must not use mode as a way to silently self-approve global rules.
