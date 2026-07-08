# Wrapper hook contract

Some agents do not expose native hook events. For those agents, Agent Kernel may provide a wrapper-based safety layer.

## Wrapper responsibilities

Before starting the agent, the wrapper should:

1. compile shared memory
2. safely link project instruction files
3. install project hooks when requested
4. expose `agent-kernel-agent-propose` to the agent instructions

## Limitation

Wrapper hooks cannot intercept every internal action of every agent. Claims must be adapter-specific.

## Safety rule

Wrappers should prefer explicit, inspectable shell commands over hidden side effects.
