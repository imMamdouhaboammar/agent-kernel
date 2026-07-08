# Wrapper to core exit criteria

The wrapper can become thinner after core runtime commands match safe behavior.

## Exit criteria

- core `link` preserves existing files
- core `git-hook install` preserves existing hooks
- core tests cover both behaviors
- public wrapper tests pass
- migration docs are updated

## Safety rule

Do not remove wrapper routing until core parity is proven.
