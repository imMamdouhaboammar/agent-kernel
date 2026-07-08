# Helper transition release requirements

## Requirements

- helpers remain in `package.json#bin`
- helpers remain in package files
- public CLI docs prefer `agent-kernel link`
- transition docs explain helper status
- no hard removal before a migration window

## Safety rule

Do not break scripts that already call helper binaries.
