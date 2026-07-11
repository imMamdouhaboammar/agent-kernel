# Command reference

| Command | Purpose |
|---|---|
| `architecture init [project]` | Create review-mode policy and empty exception store |
| `architecture discover [project]` | Build current architecture map from configured source roots |
| `architecture baseline [project]` | Record reviewed existing findings and package/import evidence |
| `architecture diff [project]` | Compare current architecture to the reviewed baseline |
| `architecture check [project] [--strict|--review]` | Produce a conformance report; strict mode returns exit 2 for new blockers |
| `architecture reuse <query> [project]` | Search existing symbols and capabilities before creating code |
| `architecture contract init/show/validate/close [project]` | Manage short-lived task scope, expected files, dependencies, and tests |
| `architecture exception add/list/revoke [project]` | Manage scoped expiring exceptions |
| `architecture policy validate [project]` | Validate policy structure |
| `architecture doctor [project]` | Validate all project-local architecture state |

All commands accept `--json` where structured output is useful. `architecture check` accepts `--files`, `--base`, `--contract`, and `--baseline` overrides.
