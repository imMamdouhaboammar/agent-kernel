# Architecture Guardian command reference

Use routed commands through `agent-kernel architecture ...`. All commands accept an optional project path. Structured output is available with `--json` where supported.

## Initialize and diagnose

```bash
agent-kernel architecture init [project]
agent-kernel architecture doctor [project] [--json]
agent-kernel architecture policy validate [project] [--json]
```

- `init` creates review-mode policy and an empty exception store when absent.
- `doctor` validates policy, map, baseline, contract, exceptions, and report state.
- `policy validate` checks policy structure without scanning source.

## Discover

```bash
agent-kernel architecture discover [project] [--json]
```

Discovery builds `current-map.json` from configured source roots. It records symbols, internal dependency edges, external package importer evidence, cycles, and bounded metadata. It does not execute repository code.

## Reuse search

```bash
agent-kernel architecture reuse <query> [project] [--json]
```

Search by business responsibility, public interface, state owner, validation rule, or integration boundary before creating a new abstraction.

## Baseline and diff

```bash
agent-kernel architecture baseline [project] [--json]
agent-kernel architecture diff [project] [--json]
```

- `baseline` records reviewed finding and package fingerprints.
- `diff` compares current architecture with the reviewed baseline.

Do not update a baseline automatically in CI.

## Change contracts

```bash
agent-kernel architecture contract init [project] [options]
agent-kernel architecture contract show [project] [--json]
agent-kernel architecture contract validate [project] [--json]
agent-kernel architecture contract close [project] [--json]
```

Common init options:

```text
--task <text>
--owner <name>
--allow <glob,glob>
--expect <file,file>
--dependencies <package,package>
--tests <behavior,behavior>
```

A contract is short-lived. It limits implementation scope and records expected evidence.

## Exceptions

```bash
agent-kernel architecture exception add [project] [options]
agent-kernel architecture exception list [project] [--json]
agent-kernel architecture exception revoke [project] <exception-id>
```

Common add options:

```text
--rule <rule-id>
--fingerprint <finding-fingerprint>
--files <glob,glob>
--reason <text>
--owner <name>
--expires <ISO timestamp>
```

Exceptions must be scoped, owned, reasoned, and expiring.

## Check

```bash
agent-kernel architecture check [project] [options]
```

Options include `--json`, `--strict`, `--review`, `--files`, `--base`, `--contract`, and `--baseline`.

Review mode reports without blocking. Strict mode returns a nonzero exit for new unsuppressed blockers configured by policy.

## Typical task sequence

```bash
agent-kernel architecture doctor . --json
agent-kernel architecture discover . --json
agent-kernel architecture reuse "<capability>" . --json
agent-kernel architecture contract init . --task "..." --owner "..." --allow "..."
agent-kernel architecture check . --json
```

## CI sequence

```bash
agent-kernel architecture policy validate . --json
agent-kernel architecture contract validate . --json
agent-kernel architecture check . --base origin/master --strict --json
```

Run project build, lint, typecheck, and tests separately. Architecture conformance is not functional correctness.
