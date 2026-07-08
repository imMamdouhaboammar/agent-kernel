# Mode backward compatibility test plan

## Cases

1. old configs without `agentWriteMode` behave like approval mode
2. existing `agent-kernel-agent-propose` still always creates pending proposals
3. existing approved memory remains readable
4. compile output remains compatible
5. package install still exposes original `agent-kernel` and `ak` bins

## Pass condition

Mode support does not break existing Agent Kernel workflows.
