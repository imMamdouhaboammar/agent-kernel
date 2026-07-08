# Export and import memory

Agent Kernel should keep memory portable between machines.

## Export goal

A user should be able to move approved rules, skills, policies, and generated outputs to another machine without a hosted backend.

## Export contents

```text
source/
skills/
dist/
```

## Import rule

A future import command should validate schema before writing into `AGENT_KERNEL_HOME`.

## Safety rule

Exports should not include raw logs, rejected proposals, or episode archives unless the user explicitly requests them.
