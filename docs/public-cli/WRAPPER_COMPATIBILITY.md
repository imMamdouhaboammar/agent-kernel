# Wrapper compatibility

The wrapper keeps the same public command surface while improving selected command behavior.

## Compatible

```bash
agent-kernel --version
agent-kernel init --sync
agent-kernel link .
agent-kernel git-hook install .
ak link .
```

## Safety rule

Existing user commands should continue to work unless they depended on unsafe overwrite behavior.
