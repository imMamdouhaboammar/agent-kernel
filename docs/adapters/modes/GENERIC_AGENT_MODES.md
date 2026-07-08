# Generic agent mode mapping

Any CLI-capable agent should use `agent-kernel-agent-write`.

## approval

Create pending proposals.

## trusted

Auto-write only low-risk/project-scoped memory.

## bypass

Write approved memory directly after explicit user selection.

## Safety rule

When mode cannot be detected, behave as approval mode.
