# Cross-agent recall

Cross-agent recall is the core product promise of Agent Kernel.

## Goal

When the user teaches one agent a durable rule, another agent should be able to see it later without the user repeating it.

## Flow

```text
agent captures fact -> pending proposal -> user approval -> compiled outputs -> other agents read it
```

## Required behavior

- memory source stays agent-neutral
- generated outputs are agent-specific
- agents can search memory through CLI or MCP
- project files can receive safe linked context

## Safety rule

Recall should not mean automatic trust. Captured facts become shared only through approval.
