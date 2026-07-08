# Public CLI release gate

Before release, verify public routing:

```bash
npm run build
npm run lint
npm test
npm run size
npm run publish:dry
```

## Required proof

- `agent-kernel` bin points to wrapper
- `ak` bin points to wrapper
- routed commands use safe behavior
- helpers remain packaged

## Safety rule

Do not release if `agent-kernel link` can overwrite project files through the public bin path.
