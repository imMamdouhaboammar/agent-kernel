# Agent Kernel Updates

Agent Kernel includes a focused updater for checking npm release channels, notifying connected AI agents, and applying an exact version through an explicitly trusted agent identity.

The updater is disabled by default. It never expands its own trust list and it never installs a version during an unrelated command.

> The updater is implemented in the repository and becomes available to npm users with the first release after v1.9.0.

## Quick start

Initialize Agent Kernel before changing updater governance:

```bash
agent-kernel init
```

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

1. Agent Kernel has been initialized
2. update mode is `agent-approved`
3. an agent identity is supplied through `--agent` or `AGENT_KERNEL_AGENT_ID`
4. the normalized identity is in the configured allowlist
5. the configured channel resolves successfully
6. the resolved version is newer than the installed version

An unknown or revoked agent is denied before npm is executed.

The following governance changes require an interactive confirmation or `--yes`:

- enabling agent-approved mode
- disabling updates
- changing the release channel
- trusting an agent
- revoking an agent

Use `--yes` only in a workflow where the user has already reviewed the exact command. It is an explicit confirmation override, not a separate operating-system authentication mechanism.

Malformed `config.json` content is rejected and preserved. Updater governance commands do not overwrite a malformed config or create a partial config before `agent-kernel init`.

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

When agent-approved mode is enabled, the public router opportunistically refreshes a stale or missing cache before these human-oriented lifecycle commands:

```text
agent-kernel doctor
agent-kernel start ...
agent-kernel compile
agent-kernel sync
agent-kernel status
```

The refresh is limited by `checkIntervalHours`, uses a 20-second subprocess timeout, and never installs a package. Its failure does not fail the lifecycle command. Commands using `--json` skip the opportunistic check to keep their output deterministic.

Disable opportunistic checks for an offline session or controlled environment:

```bash
AGENT_KERNEL_DISABLE_AUTO_UPDATE_CHECK=1 agent-kernel doctor
```

Other commands read cached state only. If the cache reports an available version, the router writes a concise notice to stderr.

A registry outage makes an explicit check fail with `registry-unavailable`. If a valid available-version cache already exists for the same channel and installed version, the updater preserves that target and notice while recording the failed refresh. Unrelated commands remain usable.

## Agent notifications

After a successful `update`, `init`, `compile`, `sync`, or `link` command, the router runs the offline guidance publisher.

The publisher reads the cached update state and maintains a bounded managed block in existing Agent Kernel guidance files for:

- Codex and other `AGENTS.md` consumers
- Claude Code
- Cursor
- Antigravity
- Gemini CLI

The block contains the installed version, available version, channel, current mode, trusted identities, and the exact apply command. It is removed when the cache no longer reports an available update.

The guidance publisher does not contact npm and does not create missing agent files by itself. If it finds a start marker without a matching end marker, it skips that file rather than truncating or repairing user content automatically.

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

On Windows, `.cmd` and `.bat` launchers are passed as separate arguments to `cmd.exe /d /c`. JavaScript test or configured helper paths are passed to the current Node executable. The updater does not build a shell command string and does not enable a general-purpose shell option.

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

Check, authorization, installation, verification, rollback, and final apply outcomes are distinct records.

The log does not store npm output, arbitrary command text, environment dumps, credentials, or tokens.

## JSON examples

Inspect state:

```bash
agent-kernel update status --json
```