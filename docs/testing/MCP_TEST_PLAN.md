# MCP test plan

MCP support must prove that agents can read memory and propose memory safely.

## Required cases

1. server responds to `tools/list`
2. memory search tool returns approved memory
3. proposal tool creates pending memory
4. approval tool is disabled by default
5. guard command tool reports blocked commands

## Pass condition

MCP write access stops at pending proposals unless explicit approval gating is enabled.
