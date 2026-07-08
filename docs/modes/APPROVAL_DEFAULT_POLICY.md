# Approval default policy

Approval mode is the production default.

## Why

It prevents memory pollution and keeps the user in control of shared memory.

## Default writes

All agent writes become pending proposals.

## Safety rule

If config is missing or unreadable, helpers should behave like approval mode.
