# Project-scoped memory

Not every memory belongs globally.

## Use project scope for

- repo-specific package manager decisions
- local deployment commands
- rejected architecture choices for one codebase
- client-specific constraints
- migration notes

## Use global scope for

- durable engineering preferences
- security policies
- repeated cross-project user rules
- agent workflow standards

## Safety rule

When an agent is uncertain, it should propose project scope first and let the user promote it to global later.
