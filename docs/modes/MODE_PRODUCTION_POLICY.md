# Mode production policy

Production-grade mode behavior must be explicit, testable, and reversible.

## Requirements

- default to approval
- require explicit bypass selection
- support trusted mode as a gated middle path
- expose mode in config
- validate mode through lint and smoke tests

## Safety rule

No production install flow should silently enable bypass.
