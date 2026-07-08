# Offline-friendly install

Agent Kernel should remain usable without a hosted backend.

## Local-first rule

The core system must work from local files:

```text
~/.agent-kernel/source
~/.agent-kernel/dist
~/.agent-kernel/inbox
```

## Offline expectations

Offline usage should support:

- reading approved memory
- creating pending proposals
- compiling generated files
- linking project instructions
- running staged file guards

## Non-goal

Remote sync can exist later, but it must remain optional.
