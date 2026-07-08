# Wrapper-based agent contract

A wrapper-based adapter starts the coding agent through Agent Kernel so the kernel can link project files, prepare context, and install safety hooks where possible.

## Start pattern

```bash
agent-kernel start <agent> <project>
```

## Responsibilities

Before launching the target agent, the wrapper should:

1. compile current shared memory
2. safely link project instruction files
3. install safe project hooks when requested
4. pass the working directory to the target agent

## Write path

The wrapper should expose this proposal path to the agent:

```bash
agent-kernel-agent-propose --from <agent> --reason "<reason>" --text "<memory>"
```

## Safety rule

Wrapper-based enforcement must fail closed for destructive commands and fail open only for unavailable optional integrations.
