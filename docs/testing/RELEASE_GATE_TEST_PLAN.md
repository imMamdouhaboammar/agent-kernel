# Release gate test plan

A release should not ship unless core install and memory behavior is verified.

## Required gates

```bash
npm run build
npm run lint
npm test
npm run typecheck
npm run size
npm run publish:dry
```

## Manual gate

Install the packed tarball globally in a clean temp environment and run `agent-kernel init --sync`.

## Pass condition

All binaries, docs, marketplace files, and generated CLI files are present in the package.
