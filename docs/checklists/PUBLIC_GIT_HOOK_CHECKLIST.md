# Public git hook checklist

- [ ] `agent-kernel git-hook install` routes through safe behavior
- [ ] existing pre-commit hook logic is preserved
- [ ] marker block is inserted
- [ ] backup is created
- [ ] second run is idempotent

## Release blocker

Any hook replacement without preservation fails this checklist.
