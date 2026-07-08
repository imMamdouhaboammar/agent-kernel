# Mode security test plan

## Cases

1. invalid config does not select bypass
2. unknown mode is rejected
3. trusted mode blocks global critical auto-write
4. MCP approval remains gated
5. bypass requires explicit selection

## Pass condition

The mode system cannot be used to silently remove user approval.
