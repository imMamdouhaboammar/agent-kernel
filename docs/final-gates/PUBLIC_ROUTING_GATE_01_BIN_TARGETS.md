# Gate 01: Public bin targets

`agent-kernel` and `ak` must point to the public wrapper, not directly to `dist/cli.mjs`.

## Check

```bash
node -e "console.log(require('./package.json').bin)"
```

## Pass condition

Both public commands resolve to `./bin/agent-kernel.mjs`.
