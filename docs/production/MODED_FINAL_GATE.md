# Moded final gate

Before claiming production-grade mode support, run:

```bash
npm run build
npm run lint
npm test
npm run typecheck
npm run size
npm run publish:dry
```

## Required proof

- binaries are packaged
- mode config works
- agent write helper respects modes
- approval remains default
- bypass requires explicit selection

## Safety rule

No release should ship if mode behavior is untested.
