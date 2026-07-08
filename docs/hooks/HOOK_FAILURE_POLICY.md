# Hook failure policy

Hooks must fail in a way the user and agent can understand.

## Blocking failures

Use blocking failures for:

- dangerous shell commands
- protected write paths
- detected secrets
- forbidden content policies

## Non-blocking failures

Use warnings for:

- optional adapter unavailable
- missing global instruction file
- non-critical sync target missing

## Reporting rule

Every hook failure should include:

1. what was blocked
2. which policy matched
3. what the agent should do next

## Safety rule

Do not hide skipped hooks. If a hook cannot run, report that clearly.
