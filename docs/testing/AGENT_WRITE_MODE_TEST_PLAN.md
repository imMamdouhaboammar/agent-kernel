# Agent write mode test plan

## Cases

1. approval mode creates pending proposals
2. trusted mode writes project notes directly
3. trusted mode keeps global critical memory pending
4. bypass mode writes approved memory directly
5. missing config behaves like approval mode

## Pass condition

`agent-kernel-agent-write` follows the selected mode exactly.
