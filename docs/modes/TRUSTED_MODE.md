# Trusted mode

`trusted` mode is for daily work with agents the user already trusts.

## Behavior

- agents can read shared memory
- low-risk memory can be written directly
- project-scoped notes can be auto-written
- global, critical, and broad rules still require approval

## Auto-write examples

```text
scope=project
level=note
type=project-note
```

## Install command

```bash
agent-kernel-mode set trusted
```

## Safety rule

Trusted mode is not bypass mode. It must still protect global and critical memory from silent promotion.
