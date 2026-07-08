# Claude marketplace flow

Agent Kernel includes Claude marketplace metadata so Claude Code can discover and configure it.

## Required files

```text
.claude-plugin/marketplace.json
.claude-plugin/plugin.json
SKILL.md
```

## Expected agent behavior

After discovery, Claude should help the user run:

```bash
agent-kernel enforce install
agent-kernel mcp install claude
agent-kernel doctor
```

## Release rule

Marketplace manifest versions should move with the npm package version.

## Safety rule

Marketplace discovery should not bypass user approval for memory publishing.
