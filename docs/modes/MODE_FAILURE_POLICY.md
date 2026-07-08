# Mode failure policy

Mode helpers should fail clearly.

## Failure cases

- unknown mode
- missing memory text
- invalid helper arguments
- unreadable config
- unavailable `agent-kernel` binary

## Required behavior

Return non-zero and print an actionable error.

## Safety rule

Failure must not fall back to bypass.
