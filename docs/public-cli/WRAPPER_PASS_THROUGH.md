# Wrapper pass-through contract

The public wrapper should only intercept commands that need safe behavior.

## Intercept

```text
link
git-hook install
```

## Delegate

Every other command delegates to `dist/cli.mjs` with the original arguments.

## Safety rule

The wrapper must not change unrelated command behavior.
