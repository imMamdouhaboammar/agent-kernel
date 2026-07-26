# Project Connection and Provider Isolation

`agent-kernel project connect` connects a repository to the global Agent Kernel runtime without copying credentials, duplicating the runtime, or replacing user-owned instructions.

## Model

```text
project repository
  .agent-kernel/project.toml
  .agent-kernel/policy.toml
  managed instruction blocks
          |
          | Project Context Broker
          v
~/.agent-kernel/
  connections/registry.toml
  connections/active-session.json
  connections/approvals.json
  logs/project-audit.jsonl
  source/...
```

The project owns reviewed identifiers, environments, capability flags, provider profiles, and target metadata. The global home owns connection registry state, active context, approvals, audit events, memory, and credentials through the supported secure backend.

## Connect

Preview first:

```bash
agent-kernel project connect --dry-run
```

Apply safe defaults:

```bash
agent-kernel project connect --yes
agent-kernel project status --json
agent-kernel project doctor
```

One-off execution without global install:

```bash
npx -y @mamdouh-aboammar/agent-kernel project connect --dry-run
bunx @mamdouh-aboammar/agent-kernel project connect --dry-run
```

A global install is preferred when generated package scripts or hooks need a stable executable path.

## Connect options

```text
--path <dir>       explicit project root
--agents <list>    comma-separated adapter list or all
--no-agent-files   do not write managed agent instruction blocks
--no-scripts       do not add kernel package scripts
--yes              accept safe defaults non-interactively
--json             structured output
--quiet            suppress non-error human output
--dry-run          plan without mutation
```

When package scripts are enabled, Agent Kernel adds managed commands such as:

```json
{
  "kernel:status": "agent-kernel project status",
  "kernel:doctor": "agent-kernel project doctor",
  "kernel:connect": "agent-kernel project connect",
  "kernel:disconnect": "agent-kernel project disconnect"
}
```

## Status, repair, and disconnect

```bash
agent-kernel project status --json
agent-kernel project doctor
agent-kernel project doctor --fix
agent-kernel project reconnect
agent-kernel project disconnect --dry-run
agent-kernel project disconnect --keep-manifest
agent-kernel project disconnect --remove-manifest
```

Disconnect removes managed registry entries, scripts, and instruction blocks conservatively. `--remove-manifest` is the explicit destructive option for the local `.agent-kernel` connection directory.

## Lower-level project commands

```bash
agent-kernel project init
agent-kernel project register
agent-kernel project inspect
agent-kernel project verify
agent-kernel projects discover [path]
agent-kernel projects inventory
```

Use the high-level `project connect` flow unless a recovery or advanced setup requires lower-level control.

## Validated context

`context enter` and `context switch` validate that:

- the project ID matches the current manifest
- the requested environment exists in the manifest
- repository identity and root are consistent
- risk metadata is known

```bash
agent-kernel context enter my-project development --json
agent-kernel context switch my-project staging --json
agent-kernel context current --json
```

The active context is stored in `~/.agent-kernel/connections/active-session.json`. It is local runtime state, not a repository file.

## Audit

```bash
agent-kernel audit list --limit 50
agent-kernel audit list --limit 10 --json
```

Audit reads are scoped to the current project manifest. Malformed unrelated lines are counted and skipped instead of being returned as valid evidence.

Audit output is sanitized. Provider tokens, service-account material, and caller environment values are not recorded.

## Agent and provider profiles

Agent identity trust and provider credential profiles are separate concepts.

Agent registry:

```bash
agent-kernel agent list --json
agent-kernel agent add codex --trust propose-only --surface cli
```

Provider profile management:

```bash
agent-kernel auth add supabase --profile work
agent-kernel auth list
agent-kernel auth remove supabase work
```

Provider profile names are validated as bounded identifiers before keychain lookup or configuration-path use.

Persistent provider credentials are available only through a supported secure platform backend. The current persistent backend is macOS Keychain. Unsupported platforms fail closed instead of writing unrecoverable credential references.

Supabase can also read `SUPABASE_ACCESS_TOKEN` or `SUPABASE_TOKEN` from the current process. Agent Kernel does not persist or log those values.

## Provider execution

Supabase:

```bash
agent-kernel provider supabase exec -- db pull
agent-kernel provider supabase exec -- db push
```

GCloud:

```bash
agent-kernel provider gcloud exec -- run services list
agent-kernel provider gcloud exec -- run deploy <service>
```

The broker removes caller attempts to override manifest-bound targets. Supabase receives the reviewed project reference. GCloud receives the reviewed project, region, and configuration profile. Account, impersonation, billing project, and configuration overrides are removed.

Provider executable discovery ignores invalid or non-executable path entries. Windows batch delegation is restricted to validated Supabase and GCloud launchers through the trusted system command processor path; general `shell: true` execution is not used.

## Production approvals

Sensitive operations in a production-risk environment require a short-lived matching approval.

```bash
agent-kernel approvals request \
  --provider supabase \
  --operation db-push \
  --reason "Migration reviewed in change window"

agent-kernel approvals list --status pending --json
agent-kernel approvals approve <approval-id> --ttl-minutes 15
```

Deny or revoke:

```bash
agent-kernel approvals deny <approval-id> --reason "Change window closed"
agent-kernel approvals revoke <approval-id> --reason "Deployment cancelled"
```

Supported production approval operations include:

```text
supabase:db-push
supabase:migration
gcloud:run
gcloud:deploy
```

Approval properties:

- scoped to project, environment, provider, and normalized operation
- TTL from 1 to 60 minutes
- consumed atomically by the first matching command
- cannot authorize another project, account, region, or operation
- malformed state fails closed
- requests and state changes are audited

State transitions:

```text
pending -> approved -> consumed
       \-> denied
approved -> revoked
approved -> expired
```

## Read-only and unknown operations

Explicitly recognized Supabase read-only operations include `db pull`, `db dump`, `db lint`, and `migration list`.

Unknown Supabase operations are classified as sensitive, not read-only. This prevents an unrecognized write command from bypassing production approval.

## Safety guarantees

- global runtime and memory are not copied into the project
- project instructions are updated through managed blocks
- registry and approval writes are lock-protected and atomic
- worktree repository identity is supported
- credentials are not stored in project manifests
- provider targets are manifest-bound
- unknown routed subcommands fail nonzero
- project and profile identifiers are validated before local path use
- audit events are project-scoped and redacted

## Recovery checklist

```bash
agent-kernel project status --json
agent-kernel project doctor
agent-kernel project doctor --fix
agent-kernel context current --json
agent-kernel audit list --limit 20 --json
```

If state remains inconsistent, run `project disconnect --dry-run`, inspect the plan, then reconnect. Do not manually delete global connection state unless the user is performing a reviewed recovery.

## Related references

- `COMMAND_REFERENCE.md`
- `ENVIRONMENT_VARIABLES.md`
- `INSTALL_AND_AGENT_SETUP.md`
- `SECURE_RUNTIME_AND_RELEASES.md`
- `TROUBLESHOOTING.md`
