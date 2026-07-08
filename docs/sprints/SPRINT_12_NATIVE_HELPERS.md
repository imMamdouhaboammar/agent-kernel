# Sprint 12: Native helpers

## Goal

Expose small native helper binaries that agents can call without understanding internal memory layout.

## Scope

- `agent-kernel-agent-propose`
- `agent-kernel-safe-link`
- `agent-kernel-safe-git-hook`
- bin surface linting
- package file inclusion checks

## Done when

Agents can read shared memory and write proposals through stable CLI helpers after a normal npm install.
