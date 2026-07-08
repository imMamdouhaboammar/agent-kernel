# Public wrapper layer

The public wrapper layer sits in front of the monolithic runtime CLI.

```text
agent-kernel / ak
  -> bin/agent-kernel.mjs
    -> routed safe commands
    -> dist/cli.mjs for everything else
```

## Purpose

Improve public command safety without performing a risky full rewrite of `src/cli.mjs`.

## Safety rule

The wrapper is a migration layer until safe behavior is merged into the core runtime.
