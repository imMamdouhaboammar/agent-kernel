# Wrapper file requirements

## Required files

```text
bin/agent-kernel.mjs
bin/agent-kernel-safe-link.mjs
bin/agent-kernel-safe-git-hook.mjs
dist/cli.mjs
```

## Safety rule

The wrapper must never route to a missing implementation silently.
