# Wrapper release QA runbook

## Required commands

```bash
npm run build
npm run lint
npm test
npm run size
npm run publish:dry
```

## Public binary checks

```bash
agent-kernel --version
agent-kernel link . --dry-run
agent-kernel git-hook install . --dry-run
```

## Safety rule

Run QA through public binaries, not only direct Node scripts.
