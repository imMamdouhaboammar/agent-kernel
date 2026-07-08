# Core runtime merge risk

The current runtime is still concentrated in `src/cli.mjs` and `dist/cli.mjs`.

## Risk

Directly rewriting core command implementations can break unrelated CLI behavior.

## Mitigation

Use wrapper routing first, prove behavior through public smoke tests, then move logic inward with smaller focused patches.

## Safety rule

Production hardening should reduce risk before it restructures the runtime.
