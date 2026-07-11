# Workflow

Architecture Guardian uses a closed control loop:

```text
understand -> map -> search reuse -> declare scope -> implement -> compare -> report -> learn
```

Use discovery before design. Use a change contract before writes. Run conformance after the change. Baseline existing debt so only new violations can block a clean-up-unrelated change.

A valid completion statement must cite the latest report and test command. A generated report without current code analysis is stale evidence.
