# Agent-Approved Updater Design

## Status

Approved for implementation on 2026-07-14.

## Objective

Add a focused update helper to the public Agent Kernel CLI. The helper checks configurable npm release channels, exposes update availability to connected AI agents, and permits only explicitly trusted agents to install an update after the user enables agent-approved mode.

## Confirmed repository constraints

- The public package is `@mamdouh-aboammar/agent-kernel`.
- The current package version is `1.9.0`.
- Public command routing is implemented by `bin/agent-kernel-router.mjs`.
- Focused helper binaries under `bin/` are an accepted boundary for behavior outside the single-file core runtime.
- Generated agent guidance is compiled by `src/cli.mjs` and distributed by `compile`, `sync`, and `link`.
- `src/commands/` remains an unwired placeholder and must not receive production behavior.
- Routed commands require focused smoke coverage.

## Command surface

```text
agent-kernel update status [--json]
agent-kernel update check [--force] [--json]
agent-kernel update enable --agents claude,codex [--yes] [--json]
agent-kernel update disable [--yes] [--json]
agent-kernel update channel <latest|next|semver> [--yes] [--json]
agent-kernel update trust <agent-id> [--yes] [--json]
agent-kernel update revoke <agent-id> [--yes] [--json]
agent-kernel update apply --agent <agent-id> [--json]
```

`AGENT_KERNEL_AGENT_ID` is accepted as the identity source when `--agent` is omitted.

## Architecture

### Focused update helper

Create `bin/agent-kernel-update.mjs` as the only component allowed to query the npm registry or execute package installation. The public router sends the `update` command family to this helper.

The helper owns:

- configuration validation and persistence
- release channel resolution
- semantic version comparison
- update status caching
- agent trust enforcement
- npm installation and verification
- rollback after failed verification
- redacted audit events
- human and JSON output

The package name is a source constant and cannot be supplied from user input.

### State files

All update state lives under the existing Agent Kernel home:

```text
~/.agent-kernel/config.json
~/.agent-kernel/runtime/update-status.json
~/.agent-kernel/logs/updates.jsonl
```

The config gains this additive object:

```json
{
  "updates": {
    "mode": "disabled",
    "channel": "latest",
    "trustedAgents": [],
    "checkIntervalHours": 24
  }
}
```

Existing configurations without `updates` use these defaults without requiring migration.

The cache schema is:

```json
{
  "schemaVersion": 1,
  "packageName": "@mamdouh-aboammar/agent-kernel",
  "currentVersion": "1.9.0",
  "channel": "latest",
  "targetVersion": "1.10.0",
  "updateAvailable": true,
  "checkedAt": "2026-07-14T00:00:00.000Z",
  "error": null
}
```

## Permission model

Agent-approved mode is disabled by default.

Enabling, disabling, changing a channel, trusting an agent, and revoking an agent are user-governance operations. They require either an interactive terminal confirmation or `--yes`. JSON mode does not bypass confirmation.

An update apply operation is allowed only when:

1. mode is `agent-approved`
2. the caller supplies an agent identity
3. the identity is present in `trustedAgents`
4. the requested target is not lower than the installed version
5. registry resolution succeeds

Agent identities are normalized to lowercase identifiers containing letters, digits, dots, underscores, or hyphens.

The default recommended allowlist is supplied by the user through `update enable --agents ...`; no agent is trusted implicitly.

## Channel model

The default channel is `latest`.

A channel value may be:

- a safe npm dist-tag such as `latest`, `next`, or `beta`
- an exact semantic version such as `2.0.0` or `2.0.0-beta.1`

Package names, URLs, ranges, shell fragments, whitespace, and command flags are rejected.

Registry lookup uses argument arrays:

```text
npm view @mamdouh-aboammar/agent-kernel@<channel> version --json
```

Tests inject a fake npm executable through `AGENT_KERNEL_NPM_BIN`. Production defaults to `npm`.

## Check and cache behavior

`update check` performs a network lookup. `--force` ignores a fresh cache.

Normal CLI commands must not perform a blocking network request. The router reads the cache and prints one concise update notice to stderr when the cache says an update is available.

The helper treats registry failures as non-fatal for `status` and cached notifications. Explicit `check` returns a structured failure and a non-zero exit status. No unrelated command fails because the registry is unavailable.

## Agent guidance notifications

The compiler reads `runtime/update-status.json`. When an update is available, generated guidance receives a bounded section containing:

- current and target versions
- configured channel
- whether agent-approved mode is enabled
- trusted agent identities
- the exact apply command

The section is present in the shared constitution and therefore reaches Codex. Agent-specific generated files also receive a concise pointer so Claude, Cursor, Antigravity, and Gemini can surface the update.

No registry lookup occurs during compilation.

## Apply transaction

`update apply` follows this sequence:

1. load and validate config
2. authorize the agent identity
3. resolve the configured channel
4. reject downgrade targets
5. audit the attempted transition
6. execute `npm install --global @mamdouh-aboammar/agent-kernel@<targetVersion>` without a shell
7. execute the installed CLI `version` command
8. require the reported version to equal the target
9. execute `doctor`
10. execute `compile` and `sync`
11. persist a fresh success cache and audit record

If installation succeeds but verification fails, execute one rollback attempt:

```text
npm install --global @mamdouh-aboammar/agent-kernel@<previousVersion>
```

The final JSON response states whether rollback was attempted and whether it succeeded.

## Audit rules

Append JSON lines to `logs/updates.jsonl` for:

- check success or failure
- governance changes
- denied update attempts
- install start
- verification result
- rollback result
- final success or failure

Audit entries include timestamps, agent identity, channel, previous version, target version, action, outcome, and a bounded error category. They never include environment dumps, npm output, tokens, credentials, or arbitrary command text.

## Error handling

- Invalid config produces an actionable error and no write.
- Config writes are atomic through a temporary file and rename.
- Cache writes are atomic.
- A malformed cache is ignored.
- An unknown or untrusted agent is denied before npm executes.
- A failed registry lookup never mutates trust configuration.
- Update installation uses a timeout and inherited terminal output for human mode.
- JSON mode captures bounded subprocess output for structured reporting.

## Testing strategy

Create `test/public-cli-update.mjs` with a fake npm executable and isolated Agent Kernel home. The test covers:

- routed command discovery
- default disabled status
- confirmation requirements
- channel validation
- enabling trusted agents
- successful update availability checks
- cache reuse and forced refresh
- registry failure behavior
- denial of untrusted agents
- agent identity through environment
- successful install and verification
- verification failure and rollback
- JSON responses
- redacted audit records
- generated guidance notification
- router cached notice behavior

Wire the test into `test/smoke.mjs`.

Because the current execution environment cannot clone the repository, GitHub Actions is the source of truth for the failing-test and passing-test evidence. The test-only commit must fail before implementation is added.

## Documentation impact

Update:

- `README.md`
- `docs/README.md`
- `docs/ARCHITECTURE_NOW.md`
- `docs/public-cli/ROUTED_COMMANDS.md`

Create:

- `docs/UPDATES.md`

## Out of scope

- background daemon or operating-system service
- silent updates on every CLI invocation
- npm package publishing
- release creation or version bump
- remote update service
- automatic trust expansion
- updating arbitrary packages
- self-update through MCP approval
