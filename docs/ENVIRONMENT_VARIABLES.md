# Environment variables

Agent Kernel is local-first. Most users need only `AGENT_KERNEL_HOME`. The remaining variables are explicit overrides for runtime transport, agent identity, hooks, MCP, dashboards, or updates.

## Storage and identity

| Variable | Default | Purpose |
|---|---|---|
| `AGENT_KERNEL_HOME` | `~/.agent-kernel` | Select the local memory, runtime, connections, logs, reports, and generated-output home. |
| `AGENT_KERNEL_AGENT` | command-specific | Supply an agent identity to compatible hooks and helpers. |
| `AGENT_KERNEL_AGENT_ID` | command-specific | Explicit stable agent ID for runtime evidence and identity-aware operations. |

Use an isolated home for tests or experiments:

```bash
export AGENT_KERNEL_HOME="$PWD/.tmp-agent-kernel-home"
agent-kernel init --sync
```

Do not point unrelated users, machines, or concurrent automation at one writable home without an external ownership and locking design.

## Daemon

| Variable | Default | Purpose |
|---|---|---|
| `AGENT_KERNEL_DAEMON_HOST` | `127.0.0.1` | Bind host for the optional HTTP daemon. |
| `AGENT_KERNEL_DAEMON_PORT` | `3999` | Bind port. Use `0` when a test needs an ephemeral port. |
| `AGENT_KERNEL_DAEMON_ALLOW_REMOTE` | unset | Must equal `1` before a non-loopback bind is accepted. |
| `AGENT_KERNEL_DAEMON_TOKEN` | unset | Bearer token required for non-loopback mode; minimum 32 bytes. |

Secure remote example:

```bash
export AGENT_KERNEL_DAEMON_HOST=0.0.0.0
export AGENT_KERNEL_DAEMON_ALLOW_REMOTE=1
export AGENT_KERNEL_DAEMON_TOKEN="$(openssl rand -hex 32)"
agent-kernel daemon start
```

Do not commit, print, screenshot, or put the token in issue reports. Prefer a private network, VPN, or authenticated tunnel. Stop the daemon and rotate the token after temporary access.

## MCP

| Variable | Default | Purpose |
|---|---|---|
| `AGENT_KERNEL_MCP_TOOLS` | `core` | Set to `extended` to expose the broader local maintenance tool set. |
| `AGENT_KERNEL_MCP_ALLOW_APPROVE` | unset | Set to `1` with extended mode to expose explicit approval. |

Normal setup should remain in core mode. MCP publish and delete tools are never exposed.

```bash
AGENT_KERNEL_MCP_TOOLS=extended agent-kernel mcp test
```

## Architecture and hooks

| Variable | Default | Purpose |
|---|---|---|
| `AGENT_KERNEL_ARCHITECTURE_MODE` | policy mode | Override Architecture Guardian hook behavior with `review` or `strict`. |
| `AGENT_KERNEL_HOOK_STRICT` | unset | Ask compatible hooks to fail closed when their documented strict behavior is available. |
| `AGENT_KERNEL_HOOK_TIMEOUT_MS` | helper-specific | Bound a hook process duration. |
| `AGENT_KERNEL_HELPER_TIMEOUT_MS` | helper-specific | Bound compatible helper execution. |

Use strict mode only after the policy, baseline, change contract, and active exceptions have been reviewed:

```bash
AGENT_KERNEL_ARCHITECTURE_MODE=strict agent-kernel architecture check . --json
```

## Dashboard and browser launch

| Variable | Default | Purpose |
|---|---|---|
| `AGENT_KERNEL_BROWSER_BIN` | platform browser opener | Override the executable used to open a generated local dashboard. |
| `AGENT_KERNEL_BROWSER_ARGS_JSON` | `[]` | JSON array of arguments passed to the browser executable. |

Use `--no-open` in CI and headless environments instead of configuring a browser:

```bash
agent-kernel dashboard --no-open --json
```

## Updates

| Variable | Default | Purpose |
|---|---|---|
| `AGENT_KERNEL_DISABLE_AUTO_UPDATE_CHECK` | unset | Set to `1` to disable opportunistic cached update checks on selected commands. |

This variable suppresses the check and notice only. It does not change the configured release channel, trusted agents, or update approval policy.

## Provider credentials

Provider credentials are supplied through secure platform storage or process environment according to the provider adapter. Current Supabase execution can read:

```text
SUPABASE_ACCESS_TOKEN
SUPABASE_TOKEN
```

Agent Kernel does not persist these environment values or include them in provider audit output. Repository-local `.env` files are not a supported place for global provider credentials.

## Internal and test-only overrides

The following variables exist to support package tests, controlled wrappers, executable discovery, or recursion prevention. They are not a stable public integration contract:

```text
AGENT_KERNEL_BYPASS_SHIMS
AGENT_KERNEL_CLI
AGENT_KERNEL_NPM_BIN
AGENT_KERNEL_UPDATE_CLI_BIN
```

Production integrations should invoke the documented CLI and public binaries instead of relying on these variables. They may change without a compatibility guarantee.

## Security checklist

- Keep secrets out of repository configuration and generated guidance.
- Prefer `AGENT_KERNEL_HOME` isolation for automated tests.
- Do not enable remote daemon mode without a strong bearer token and private transport.
- Do not enable MCP approval by default.
- Do not use strict hooks before reviewing their policy and failure behavior.
- Treat environment values as process-scoped credentials; avoid logging the full environment.
