# AI agent runbook

This runbook applies to AI coding agents changing the Agent Kernel repository or using Agent Kernel in another project.

## Prime directive

Do not guess shipped behavior. Inspect the current code, help output, tests, and protocol docs before editing.

For this repository, read:

1. `AGENTS.md`
2. `docs/ARCHITECTURE_NOW.md`
3. `docs/OPERATING_MODEL.md`
4. `docs/COMMAND_REFERENCE.md`
5. the focused protocol or security doc

Roadmaps and backlogs describe intent, not proof of current behavior.

## First-response checklist

1. classify the request
2. identify the real runtime entry point
3. inspect current tests and documentation
4. state only material assumptions
5. reproduce a bug before fixing it
6. make the smallest coherent change
7. add a regression guard
8. update docs and skill surfaces when behavior is user-visible
9. run focused and full verification
10. report exact evidence and remaining limitations

## Request matrix

| Request | Inspect first | Required evidence |
|---|---|---|
| core CLI behavior | router, focused helper, `src/cli.mjs`, tests | focused reproduction, build, smoke |
| helper binary | `bin/<helper>.mjs`, package bin map, focused test | helper test, bin lint, package preview |
| daemon or session | daemon/session code, secure runtime doc | auth/path/body tests, process cleanup |
| MCP | MCP surface, tool definitions, MCP doc | core/extended tool tests, approval boundary |
| Project Context Broker | broker source, manifests, provider tests | target isolation, approval, audit, Windows tests |
| Architecture Guardian | canonical skill, policy, detector, tests | doctor, discover, focused detector, check |
| docs or skill refresh | help output, package bins, env vars, docs map | docs links, docs contract, lint |
| workflow or release | workflows, CI hardening test, secure release doc | actionlint, PR checks, tag precondition |

## Runtime map

Core build path:

```text
src/cli.mjs -> scripts/build.mjs -> dist/cli.mjs
```

The public router delegates many command families to focused `bin/*.mjs` helpers. Inspect `bin/agent-kernel-router.mjs` before assuming a command is implemented in `src/cli.mjs`.

Do not hand-edit `dist/cli.mjs`. Run the build.

## Generated and canonical files

Canonical state:

```text
~/.agent-kernel/source/
~/.agent-kernel/inbox/
~/.agent-kernel/episodes/
~/.agent-kernel/connections/
project/.agent-kernel/architecture/
```

Generated or derived state:

```text
~/.agent-kernel/dist/
project AGENTS.md managed block
project CLAUDE.md managed block
project GEMINI.md managed block
.cursor/rules managed block
static dashboard and reports
```

Fix the source or generator, then regenerate.

## Memory and evidence rules

Agents may capture evidence and create proposals. They should not silently approve or publish.

```bash
agent-kernel propose --from <agent> --text "<memory>" --reason "<reason>"
agent-kernel failure capture --from <agent> --type <type> --text "<redacted evidence>"
```

Before retrying a familiar failure:

```bash
agent-kernel failure search "<signature>"
```

Do not store secrets, tokens, `.env` values, service-account files, or auth material in memory, episodes, Failure Lessons, manifests, skills, tests, logs, or examples.

## File-backed identifier boundary

Session, proposal, episode, commit-link, profile, and file-record IDs are identifiers. Never concatenate untrusted IDs into paths.

Regression tests for a file-backed command should verify:

- path separators are rejected
- `.` and `..` are rejected
- traversal cannot read, write, move, or append adjacent files
- valid IDs retain existing behavior

## Daemon rules

- local loopback is the default
- remote bind requires explicit opt-in and at least a 32-byte bearer token
- tokens are never written to status or logs
- request bodies are capped
- malformed URLs fail closed
- tests must terminate child daemon processes

Do not expose remote daemon mode in examples without the token and private-transport warning.

## MCP rules

- core mode remains the default
- extended mode is explicit
- approval requires an additional explicit flag
- publish and delete are not exposed
- rejected proposals do not become context
- context remains bounded
- tool lists in docs must match `agent-kernel mcp test`

## Project Context Broker rules

- project and environment are validated against the manifest
- provider profile names are bounded identifiers
- caller target overrides are removed
- production operations consume a matching short-lived approval
- credentials use secure storage or process environment
- audit output is project-scoped and redacted
- unsupported secure backends fail closed
- Windows command execution remains restricted to validated launchers

## Architecture Guardian rules

Before non-trivial code work:

```bash
agent-kernel architecture doctor . --json
agent-kernel architecture discover . --json
agent-kernel architecture reuse "<capability>" . --json
agent-kernel architecture check . --json
```

Do not broaden policy, baseline, contract, or exception state without review. Classify baseline debt separately from new regressions.

## Hook rules

Hooks are narrow lifecycle adapters.

Allowed:

- command/path checks
- architecture scope checks
- failure evidence capture
- short context injection

Not allowed:

- memory approval or publication
- policy broadening
- automatic exception creation
- broad autonomous repair loops
- credential access or logging

Prefer failure-specific events, narrow matchers, bounded timeouts, and structured output.

## Documentation rules

For a docs or skill change:

1. compare examples with current help output
2. verify all linked files exist
3. ensure public binaries are covered by `docs/COMMAND_REFERENCE.md`
4. ensure public environment variables are classified
5. preserve the shared skill contract across adapter skills
6. avoid documenting internal test overrides as stable public API
7. update `docs/README.md` and root README navigation
8. add an Unreleased changelog entry when release-visible

Run:

```bash
npm run docs:check
npm run lint
```

## Workflow and release rules

Workflow changes require:

```bash
go run github.com/rhysd/actionlint/cmd/actionlint@latest -color .github/workflows/*.yml
npm run ci:check
```

Do not rely on YAML parsing alone. GitHub expressions and shell expansions are different languages.

Release gate:

```bash
npm ci
npm run verify:release
npm run publish:dry
```

Then install the generated tarball in a clean temporary project and run the installed CLI.

Before tagging:

- PR checks are green on Linux and Windows
- CodeQL is green
- package version is unpublished
- `master` contains the intended version
- release workflows load successfully
- tag matches `package.json`

After tagging:

- npm version is live
- package integrity is visible
- provenance path is recorded
- GitHub Release contains source archive, npm tarball, and `SHA256SUMS`

## Test sequence

Use the smallest useful sequence:

```text
focused failing test
focused passing test
build
lint and docs contracts
typecheck
full smoke suite
runtime audit
package preview
clean tarball install
supported Node and platform CI
```

Do not claim a test passed unless its current output was observed.

## Anti-patterns

- blind retries without capturing a repeatable failure
- editing `dist/cli.mjs` by hand
- adding behavior under placeholder modules without routing it
- changing one version surface only
- using `shell: true` for fixed executable plus argument invocation
- treating a package profile or record ID as a path
- storing secrets in examples or generated files
- using mutable GitHub Action references
- claiming a release before registry and asset verification
- changing docs without a regression contract

## PR summary

```md
## Summary

<what changed and why>

## Security and trust boundaries

- <boundary preserved or tightened>

## Validation

- `<command>`: <result>

## Release impact

- <version, package, workflow, docs, or no release impact>

## Known limitations

- <remaining constraint, or none>
```
