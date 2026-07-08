# Agent proposal helper test plan

The generic proposal helper must let any coding agent write a pending memory proposal.

## Required cases

1. proposal text passed through `--text`
2. proposal text read from stdin
3. agent name preserved in proposal source
4. proposal appears in `agent-kernel inbox`
5. proposal is not approved automatically

## Pass condition

The helper creates a pending proposal through the normal CLI workflow.
