# MCP mode mapping

MCP-capable agents should respect Agent Kernel mode.

## approval

Use `agent_kernel_propose_memory` only.

## trusted

Proposal remains safest. Future trusted write tools must be gated.

## bypass

Direct writes through MCP should require explicit bypass mode and separate tool gating.

## Safety rule

MCP approval must remain disabled by default even in bypass unless explicitly enabled.
