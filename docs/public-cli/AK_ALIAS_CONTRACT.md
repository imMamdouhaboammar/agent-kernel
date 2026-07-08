# `ak` alias contract

`ak` should behave exactly like `agent-kernel`.

## Contract

```bash
ak link .
ak git-hook install .
ak --version
```

These should route the same way as:

```bash
agent-kernel link .
agent-kernel git-hook install .
agent-kernel --version
```

## Safety rule

The alias must not bypass wrapper safety routing.
