# MCP approval gating

Memory approval through MCP is high risk because a connected agent could promote its own proposals.

## Default rule

Approval through MCP must be disabled by default.

## Opt-in rule

A user may enable MCP approval only with an explicit environment variable or future config setting.

## Required audit fields

When MCP approval is enabled, logs should include:

- proposal id
- MCP client path when available
- timestamp
- publish flag

## Safety rule

Proposal creation and approval must stay separate operations.
