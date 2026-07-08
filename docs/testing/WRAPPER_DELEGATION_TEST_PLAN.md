# Wrapper delegation test plan

## Cases

1. `agent-kernel --version` delegates
2. `agent-kernel init --sync` delegates
3. `agent-kernel doctor` delegates
4. `agent-kernel inbox` delegates
5. unknown commands fail through the runtime CLI

## Pass condition

The wrapper changes only routed command behavior.
