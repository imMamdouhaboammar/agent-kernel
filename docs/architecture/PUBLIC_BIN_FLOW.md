# Public bin flow

```text
npm bin: agent-kernel
  -> bin/agent-kernel.mjs
    -> safe routed commands
    -> dist/cli.mjs delegated commands
```

## Why

The package can improve dangerous commands first without destabilizing the full runtime.

## Safety rule

Public users should hit safe behavior before internal implementation refactors are complete.
