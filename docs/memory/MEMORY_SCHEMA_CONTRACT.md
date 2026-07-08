# Memory schema contract

Agent Kernel memory must stay JSON-first and inspectable.

## Required fields

Every memory item should include:

```text
id
type
scope
level
text
status
createdAt
```

## Valid types

```text
rule
policy
preference
workflow
project-note
skill-trigger
```

## Safety rule

Schema validation should reject malformed memory before it reaches compiled agent files.
