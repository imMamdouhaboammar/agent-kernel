# Agent Kernel Updates

Agent Kernel includes a focused updater for checking npm release channels, notifying connected AI agents, and applying an exact version through an explicitly trusted agent identity.

The updater is disabled by default. It never expands its own trust list and normal CLI commands do not contact the npm registry.

## Quick start

Enable agent-approved mode and define the initial allowlist:

```bash
agent-kernel update enable --agents claude,codex
```

The command asks for terminal confirmation. For a reviewed non-interactive setup command, add `--yes`:

```bash
agent-kernel update enable --agents claude,codex --yes
```

Check the configured release channel:

```bash
agent-kernel update check
agent-kernel update status
```

A trusted agent may apply the resolved update:

```bash
agent-kernel update apply --agent claude
```

Agents may provide their identity through the environment instead:

```bash
AGENT_KERNEL_AGENT_ID=codex agent-kernel update apply
```

## Command reference

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

`--json` produces machine-readable output but does not bypass confirmation or authorization.

## Permission model

Update installation is permitted only when all of these conditions are true:

1. update mode is `agent-approved`
2. an agent identity is supplied through `--agent` or `AGENT_KERNEL_AGENT_ID`
3. the normalized identity is in the configured allowlist
4. the configured channel resolves successfully
5. the resolved version is newer than the installed version

An unknown or revoked agent is denied before npm is executed.

The following governance changes require an interactive confirmation or `--yes`:

- enabling agent-approved mode
- disabling updates
- changing the release channel
- trusting an agent
- revoking an agent

Use `--yes` only in a workflow where the user has already reviewed the exact command.

## Channels

The default channel is `latest`.

Set another npm dist-tag:

```bash
agent-kernel update channel next
agent-kernel update channel beta
```

Pin checks and updates to an exact semantic version:

```bash
agent-kernel update channel 2.0.0
agent-kernel update channel 2.0.0-beta.1
```

Package names, URLs, version ranges, whitespace, shell fragments, and command flags are rejected. The package being updated is fixed to `@mamdouh-aboammar/agent-kernel`.

## Checks, cache, and offline behavior

An explicit check queries npm with an argument array equivalent to:

```text
npm view @mamdouh-aboammar/agent-kernel@<channel> version --json
```

Successful results are cached at:

```text
~/.agent-kernel/runtime/update-status.json
```

The default cache lifetime is 24 hours. A repeated `update check` reuses a fresh cache. Use `--force` to resolve the channel again:

```bash
agent-kernel update check --force
```

Normal CLI commands read the cache only. They never perform a blocking registry request. If the cache reports an available version, the router writes a concise notice to stderr. Commands using `--json` do not receive this extra stderr notice.

A registry outage makes an explicit check fail with `registry-unavailable`. It does not break unrelated Agent Kernel commands or erase the trust configuration.

## Agent notifications

After a successful `update`, `init`, `compile`, `sync`, or `link` command, the router runs the offline guidance publisher.

The publisher reads the cached update state and maintains a bounded managed block in existing Agent Kernel guidance files for:

- Codex and other `AGENTS.md` consumers
- Claude Code
- Cursor
- Antigravity
- Gemini CLI

The block contains the installed version, available version, channel, current mode, trusted identities, and the exact apply command. It is removed when the cache no longer reports an available update.

The guidance publisher does not contact npm and does not create missing agent files by itself.

## Apply, verification, and rollback

A successful apply performs this transaction:

1. validate update configuration
2. authorize the agent identity
3. resolve the configured channel again
4. refuse downgrade targets
5. install the exact resolved version globally
6. require `agent-kernel version` to report the target version
7. run `agent-kernel doctor`
8. run `agent-kernel compile`
9. run `agent-kernel sync`
10. update the cache and audit log

Installation uses an argument array equivalent to:

```text
npm install --global @mamdouh-aboammar/agent-kernel@<exact-version>
```

No shell-interpolated package command is used.

If installation succeeds but verification fails, the updater attempts one rollback to the previously installed version. JSON output reports `rollbackAttempted` and `rollbackSucceeded`.

A rollback failure is reported explicitly. It is not hidden as a successful update.

## Audit log

Updater activity is appended to:

```text
~/.agent-kernel/logs/updates.jsonl
```

Records contain bounded operational fields such as:

- timestamp
- action and outcome
- agent identity
- channel
- previous and target versions
- normalized error category

The log does not store npm output, arbitrary command text, environment dumps, credentials, or tokens.

## JSON examples

Inspect state:

```bash
agent-kernel update status --json
```

Check the registry:

```bash
agent-kernel update check --json
```

Apply as a trusted agent:

```bash
agent-kernel update apply --agent claude --json
```

Structured errors are written to stderr and return a non-zero exit status.

## Disable or adjust trust

Add one identity:

```bash
agent-kernel update trust cursor
```

Remove one identity:

```bash
agent-kernel update revoke cursor
```

Disable agent-approved installation:

```bash
agent-kernel update disable
```

Disabling updates preserves the configured channel and allowlist, but `update apply` is denied until the mode is enabled again.

## Troubleshooting

### `confirmation-required`

The command changes updater governance in a non-interactive environment. Run it in a terminal or add `--yes` after reviewing the exact operation.

### `updates-disabled`

Enable agent-approved mode first:

```bash
agent-kernel update enable --agents claude,codex
```

### `missing-agent`

Provide `--agent <id>` or set `AGENT_KERNEL_AGENT_ID`.

### `unauthorized-agent`

Review the current allowlist:

```bash
agent-kernel update status
```

Then trust the identity through a user-confirmed command when appropriate.

### `invalid-channel`

Use a safe npm dist-tag or an exact semantic version. Ranges and package specifications are intentionally unsupported.

### `registry-unavailable`

The explicit npm lookup failed. Existing cached notices and unrelated CLI commands remain usable. Retry later with:

```bash
agent-kernel update check --force
```

### `verification-failed`

The installed CLI did not report the expected version or failed a post-install health command. Inspect the JSON result and the audit log to see whether rollback succeeded.

## Security boundary

The updater is a global package-management boundary. Treat `update enable`, trust changes, channel changes, and `update apply` as reviewed operational actions.

The implementation deliberately excludes:

- background update services
- silent installation on normal CLI invocation
- automatic allowlist expansion
- arbitrary package updates
- MCP-based approval
- npm publishing or GitHub release creation
