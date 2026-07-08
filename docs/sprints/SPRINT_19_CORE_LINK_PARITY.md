# Sprint 19: Core link parity

## Goal

Move safe-link behavior into the core runtime `link` implementation.

## Scope

- extract marked-block merge logic
- add backup behavior
- add idempotency tests
- keep public wrapper tests
- preserve helper compatibility

## Done when

`node dist/cli.mjs link` and `agent-kernel link` have equivalent safe behavior.
