# Wrapper delegation checklist

- [ ] `--version` delegates correctly
- [ ] `init` delegates correctly
- [ ] `doctor` delegates correctly
- [ ] `inbox` delegates correctly
- [ ] unknown commands fail through runtime CLI

## Release blocker

Wrapper must not break unrelated runtime commands.
