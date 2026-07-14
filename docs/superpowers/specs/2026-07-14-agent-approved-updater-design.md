# Agent-Approved Updater Design

## Status

Approved on 2026-07-14 and aligned with the final implementation after TDD, CI, review feedback, and hardening.

## Objective

Provide a self-update surface inside the public CLI that:

- resolves a configurable npm release channel
- tells connected AI agents when an update is available
- allows only explicitly allowlisted agent identities to apply it
- verifies the installed version and rolls back once after verification failure
- preserves a local audit trail without storing subprocess output or secrets

The current stable npm package is v1.9.0. This updater becomes available to npm users in the first release after v1.9.0.

## Repository constraints

- Public package: `@mamdouh-aboammar/agent-kernel`
- Public router: `bin/agent-kernel-router.mjs`
- Core runtime: `src/cli.mjs`, built to `dist/cli.mjs`
- Focused helpers under `bin/` are valid routed runtime boundaries
- `src/commands/` remains an unwired placeholder
- No runtime dependency may be added
- Routed commands require smoke coverage
- The canonical build script must remain unchanged

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

`AGENT_KERNEL_AGENT_ID` may provide the identity for `update apply`.

## Runtime components

### `bin/agent-kernel-update.mjs`

This is the only updater component allowed to:

- query npm
- install a global package version
- verify the installed CLI
- attempt rollback

It owns strict config parsing, additive updater defaults, channel validation, semantic version comparison, cache persistence, authorization, audit records, human output, and JSON output.

The package name is a constant. The user cannot supply another package, URL, or command fragment.

### `bin/agent-kernel-update-guidance.mjs`

This helper publishes cached notices to existing agent guidance files. It:

- reads local config and cache only
- never contacts npm
- never installs a package
- never creates a missing integration file
- owns one bounded marker block
- skips a file when the start marker has no matching end marker
- uses atomic writes

Targets include existing Codex and AGENTS.md surfaces, Claude, Cursor, Antigravity, and Gemini files.

### `bin/agent-kernel-router.mjs`

The router:

- sends `agent-kernel update ...` to the updater helper
- prints a concise cached notice to stderr for human-oriented non-update commands
- suppresses that notice when `--json` is present
- refreshes guidance after successful `update`, `init`, `compile`, `sync`, and `link`
- performs limited stale metadata checks at selected lifecycle boundaries

## Local state

```text
~/.agent-kernel/config.json
~/.agent-kernel/runtime/update-status.json
~/.agent-kernel/logs/updates.jsonl
```

Updater defaults:

```json
{
  "mode": "disabled",
  "channel": "latest",
  "trustedAgents": [],
  "checkIntervalHours": 24
}
```

A missing updater section uses defaults. A malformed existing `config.json` is rejected and preserved.

Read-only `status` and explicit `check` may use defaults before initialization. Governance changes require the canonical config created by `agent-kernel init`; they never create a partial core config.

Cache schema:

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

Governance changes require terminal confirmation or `--yes`:

- enable
- disable
- channel
- trust
- revoke

JSON mode does not bypass confirmation. Without `--yes`, JSON governance calls fail with `confirmation-required` rather than emitting an interactive prompt.

Apply is allowed only when:

1. mode is `agent-approved`
2. an identity is supplied
3. the normalized identity is in `trustedAgents`
4. registry resolution succeeds
5. the target is not lower than the installed version

Authorization happens before npm installation.

`--yes` is an explicit confirmation override, not an operating-system authentication mechanism. It must not be exposed to untrusted automation.

## Channels and subprocess safety

A channel may be:

- a safe npm dist-tag such as `latest`, `next`, or `beta`
- an exact semantic version such as `2.0.0` or `2.0.0-beta.1`

Package specifications, URLs, ranges, whitespace, shell fragments, and flags are rejected.

Registry lookup:

```text
npm view @mamdouh-aboammar/agent-kernel@<channel> version --json
```

Install:

```text
npm install --global @mamdouh-aboammar/agent-kernel@<exact-version>
```

Both use argument arrays with no shell interpolation. Windows uses `npm.cmd` and `agent-kernel.cmd`.

Tests inject fake executables through:

```text
AGENT_KERNEL_NPM_BIN
AGENT_KERNEL_UPDATE_CLI_BIN
```

## Check and notification behavior

`update check` performs an explicit lookup. `--force` bypasses a fresh cache.

When agent-approved mode is enabled, the router may refresh stale or missing metadata before:

```text
doctor
start
compile
sync
status
```

Conditions:

- no `--json`
- cache age is at least `checkIntervalHours`
- `AGENT_KERNEL_DISABLE_AUTO_UPDATE_CHECK` is not `1`

The refresh uses a 20-second subprocess timeout. Failure is ignored by the requested lifecycle command. It never installs a package.

A failed refresh preserves a compatible prior available-version target and records `error`. The cache remains stale for retry because error-bearing caches are not treated as fresh.

After a successful lifecycle command, the offline guidance publisher adds or refreshes the bounded notice. This makes the available version visible to connected agents without placing registry or installation logic inside the core compiler.

## Apply transaction

1. Strictly parse config.
2. Authorize the identity.
3. Resolve the configured channel again.
4. Refuse downgrade targets.
5. Audit install start.
6. Install the exact target globally.
7. Require `agent-kernel version` to equal the target.
8. Run `agent-kernel doctor`.
9. Run `agent-kernel compile`.
10. Run `agent-kernel sync`.
11. Audit verification success.
12. Persist a success cache and final audit record.

If post-install verification fails:

1. audit verification failure
2. attempt one exact reinstall of the previous version
3. verify the reported rollback version
4. audit rollback outcome
5. return a non-zero structured result

## Output and audit rules

Human errors go to stderr.

With `--json`, successes and failures go to stdout as one JSON object. Failures retain a non-zero exit status. This keeps automation parsing deterministic.

Audit records contain bounded normalized fields only:

- timestamp
- action
- outcome
- error category
- agent identity
- channel
- previous version
- target version

They do not include npm output, environment dumps, arbitrary command strings, tokens, or credentials.

## Tests

`test/public-cli-update.mjs` uses an isolated Agent Kernel home plus fake npm and CLI executables. Coverage includes:

- uninitialized governance rejection
- malformed config preservation
- default disabled state
- confirmation behavior
- channel and identity validation
- cache reuse and force
- stale lifecycle refresh
- outage resilience and prior-target preservation
- denial before install
- `--agent` and environment identities
- exact install arguments
- verification and rollback
- JSON stream behavior
- audit redaction
- guidance publication
- malformed marker preservation
- cached router notices

The module is wired through `test/smoke.mjs` and runs on Node 18, 20, and 22 in CI.

## Out of scope

- background daemon or operating-system service
- package installation during unrelated commands
- automatic trust expansion
- arbitrary package updates
- MCP approval or installation
- npm publishing
- release creation
- version bump
- merging the pull request
