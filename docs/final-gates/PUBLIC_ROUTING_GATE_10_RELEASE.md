# Gate 10: Release proof

Public routing is release-ready only after automated and manual checks pass.

## Required commands

```bash
npm run build
npm run lint
npm test
npm run typecheck
npm run size
npm run publish:dry
```

## Pass condition

Safe public routing is proven through tests and package verification.
