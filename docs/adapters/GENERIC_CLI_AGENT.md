# Generic CLI agent contract

Any CLI-based coding agent can integrate with Agent Kernel if it can read files and run shell commands.

## Minimum read contract

The agent should read one of these files:

```text
project/AGENTS.md
project/GEMINI.md
project/.agents/agents.md
```

## Minimum write contract

The agent should create pending proposals through:

```bash
agent-kernel-agent-propose --from <agent-name> --reason "<reason>" --text "<memory>"
```

## Minimum install contract

The agent should help the user run:

```bash
npm install -g @mamdouh-aboammar/agent-kernel
agent-kernel init --sync
agent-kernel-safe-link .
```

## Safety rule

When support is unknown, assume instruction-file integration only. Do not claim blocking hooks until tested.
