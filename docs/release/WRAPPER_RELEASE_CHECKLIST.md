# Wrapper release checklist

## Commands

```bash
npm run build
npm run lint
npm test
npm run size
npm run publish:dry
```

## Manual verification

```bash
agent-kernel --version
agent-kernel link . --dry-run
agent-kernel git-hook install . --dry-run
```

## Safety rule

Release verification should use the public binaries, not only `node dist/cli.mjs`.
