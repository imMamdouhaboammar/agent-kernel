# Hooks

`agent-kernel-architecture-hook` supports narrow Claude `PreToolUse` scope checks for Write, Edit, and MultiEdit.

## What the hook checks

The hook validates the requested file path against the active change contract before the write. It can report in review mode or deny in strict mode.

```bash
AGENT_KERNEL_ARCHITECTURE_MODE=strict agent-kernel-architecture-hook
```

## What the hook cannot check

Before a file exists, the hook cannot reliably validate its future imports, cycles, package usage, or semantic responsibility. Those checks run after content exists through `architecture check`.

This separation prevents a source file from being blocked only because its related test or adapter will be written next.

## Hook safety

Hooks must not:

- modify policy or baseline
- create or approve exceptions
- approve or publish memory
- expand a change contract
- execute repository code for scanning
- leak file contents or credentials in output

Use narrow matchers, bounded timeouts, structured output, and explicit review/strict mode.
