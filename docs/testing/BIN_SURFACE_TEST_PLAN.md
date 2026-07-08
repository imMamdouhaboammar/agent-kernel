# Bin surface test plan

Every public binary in `package.json#bin` must resolve to an existing executable Node script.

## Checked binaries

```text
agent-kernel
ak
agent-kernel-safe-link
agent-kernel-safe-git-hook
agent-kernel-agent-propose
```

## Pass condition

`npm run lint` runs bin surface checks and fails if a binary target is missing.
