# Mode telemetry notes

Agent Kernel should remain local-first. Telemetry, if added later, must be optional.

## Local events

Mode changes and bypass writes may be logged locally under `~/.agent-kernel/logs`.

## No remote default

Do not send mode data to a remote service by default.

## Safety rule

Production-grade audit does not require hosted telemetry.
