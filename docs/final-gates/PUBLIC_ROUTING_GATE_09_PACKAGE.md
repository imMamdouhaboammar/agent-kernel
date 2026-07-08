# Gate 09: Package contents

The published package must contain wrapper, helpers, runtime, docs, and examples.

## Check

```bash
npm pack --dry-run --ignore-scripts
```

## Pass condition

The tarball includes `bin/agent-kernel.mjs`, helper scripts, and `dist/cli.mjs`.
