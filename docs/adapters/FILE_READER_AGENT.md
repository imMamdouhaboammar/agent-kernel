# File-reader agent contract

Some agents cannot call CLI tools or MCP tools but can read project files. Agent Kernel should still help them through generated instruction files.

## Read path

The safest baseline is:

```text
project/AGENTS.md
```

Agent-specific generated files may also be available:

```text
project/GEMINI.md
project/.cursor/rules/00-agent-kernel.mdc
project/.agents/agents.md
```

## Write limitation

If an agent cannot run commands, it cannot write memory directly. It should ask the user to run:

```bash
agent-kernel-agent-propose --from <agent-name> --reason "<reason>" --text "<memory>"
```

## Safety rule

Do not present file-reader agents as fully hooked or enforcing agents.
