# SessionStart context contract

`SessionStart` injects current Agent Kernel context at the start of a supported agent session.

## Input

The hook reads compiled context from:

```text
$AGENT_KERNEL_HOME/dist/AGENTS.md
```

## Output

The hook returns additional context to the agent runtime.

## Size rule

The injected context should be bounded. Large memory stores should be summarized or filtered before injection.

## Safety rule

Session context should never include raw secrets or private transcripts.
