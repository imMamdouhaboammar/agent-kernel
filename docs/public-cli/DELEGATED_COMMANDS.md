# Delegated public commands

Commands that are not safety-routed should delegate to the existing runtime CLI.

## Examples

```bash
agent-kernel --version
agent-kernel init --sync
agent-kernel doctor
agent-kernel compile
agent-kernel sync
agent-kernel inbox
agent-kernel approve <id>
```

## Safety rule

Delegation should preserve existing CLI behavior for non-routed commands.
