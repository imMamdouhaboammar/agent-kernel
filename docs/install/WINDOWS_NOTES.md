# Windows notes

Windows support should be treated explicitly, not assumed.

## Expected npm behavior

The npm package should expose binaries through the normal npm global bin mechanism.

## Path considerations

Code should avoid hardcoded POSIX-only assumptions where possible. Use Node path helpers for local file paths.

## Current caution

Shell hooks and git hook scripts may need Windows-specific validation before being marketed as fully supported.

## Safety rule

Do not claim full Windows hook parity until smoke tests cover Windows path and shell behavior.
