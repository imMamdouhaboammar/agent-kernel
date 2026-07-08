# MCP tool boundaries

MCP tools should be scoped by risk.

## Low-risk tools

- get status
- search memory
- get constitution
- search episodes
- read episode
- list pending proposals

## Medium-risk tools

- propose memory
- capture episode
- sync episodes
- guard command

## High-risk tools

- approve memory
- publish memory
- modify config
- install hooks

## Safety rule

High-risk tools should require explicit opt-in and should be documented separately.
