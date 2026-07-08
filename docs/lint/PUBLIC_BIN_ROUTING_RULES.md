# Public bin routing lint rules

## Required checks

- `package.json#bin.agent-kernel` points to `./bin/agent-kernel.mjs`
- `package.json#bin.ak` points to `./bin/agent-kernel.mjs`
- wrapper file exists
- routed helper files exist
- helper binaries remain exposed

## Safety rule

Lint should fail if the public bins point back to `dist/cli.mjs` directly before safe behavior is merged there.
