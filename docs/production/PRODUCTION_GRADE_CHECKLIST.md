# Production-grade checklist

## Core

- install works through npm
- all binaries are packaged
- shared memory is local-first
- agent writes follow configured mode
- approval remains default

## Verification

```bash
npm run build
npm run lint
npm test
npm run typecheck
npm run size
npm run publish:dry
```

## Safety rule

A production release must prove installability and mode behavior together.
