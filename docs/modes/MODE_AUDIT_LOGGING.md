# Mode audit logging

Mode changes should become auditable production events.

## Event fields

```text
at
previousMode
nextMode
command
user
agentKernelHome
```

## Write events

Mode-aware writes should log:

```text
mode
agent
action
memoryType
scope
level
```

## Safety rule

Bypass writes should be easy to review after the session.
