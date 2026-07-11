# CI and gates

Recommended gates:

1. `agent-kernel architecture policy validate .`
2. `agent-kernel architecture contract validate .` when a contract is required
3. `agent-kernel architecture check . --base origin/master --json`
4. project build, tests, lint, and typecheck

Archive `.agent-kernel/architecture/reports/latest.json` as CI evidence. Do not auto-update the baseline in CI.
