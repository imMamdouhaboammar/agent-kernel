# Routing debugging

## Check public bin

```bash
which agent-kernel
agent-kernel --version
```

## Check routed commands

```bash
agent-kernel link . --dry-run
agent-kernel git-hook install . --dry-run
```

## Safety rule

Debug public behavior through the installed binary, not only repository source files.
