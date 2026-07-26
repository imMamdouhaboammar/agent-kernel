# CI and gates

Recommended pull-request sequence:

```bash
agent-kernel architecture policy validate . --json
agent-kernel architecture contract validate . --json
agent-kernel architecture check . --base origin/master --strict --json
npm run build
npm run lint
npm run typecheck
npm test
```

Run contract validation only when project policy or the task requires a contract.

## Adoption stages

1. local review mode
2. review-mode CI artifact
3. strict mode on selected blocking rules
4. protected-branch required check after false-positive review

Do not switch directly from no policy to a strict protected gate.

## Evidence

Archive `.agent-kernel/architecture/reports/latest.json` when CI evidence is needed. The report should identify baseline, contract, mode, findings, suppressions, and status.

Do not update the baseline, create exceptions, or modify policy automatically in CI.

Run project tests after architecture checks; conformance does not prove functional correctness.
