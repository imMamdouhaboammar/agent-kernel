# Routed public commands

The public CLI routes selected commands to focused implementations with their own safety and compatibility boundaries.

## Routed

```text
agent-kernel update <status|check|enable|disable|channel|trust|revoke|apply>
agent-kernel architecture <command>
agent-kernel dashboard [--out file.html] [--project path] [--no-open|--open] [--json]
agent-kernel retention <command>
agent-kernel export <file>
agent-kernel import <file>
agent-kernel view [surface]
agent-kernel report <file>
agent-kernel session compact <session-id>
agent-kernel project <connect|status|doctor|reconnect|disconnect>
agent-kernel auth <add|remove|list>
agent-kernel provider <supabase|gcloud> exec -- <arguments>
agent-kernel approvals <request|list|approve|deny|revoke>
agent-kernel audit <list|tail>
agent-kernel context <enter|switch|current>
agent-kernel link
agent-kernel git-hook install
ak dashboard <options>
ak update <command>
ak link
ak git-hook install
```

The dashboard is routed to `bin/agent-kernel-dashboard.mjs`, which delegates to focused modules under `bin/dashboard/`. It reads known local stores, creates one sanitized static HTML snapshot, writes it atomically, and may open it through the operating system browser. Browser JavaScript is limited to filtering and copying rendered text; it cannot mutate Agent Kernel state.

The updater is routed to `bin/agent-kernel-update.mjs`. It is the only public command boundary that may query the npm registry or install a global package.

Project connection, provider, approval, audit, context, and auth families route through `bin/agent-kernel-project-broker-platform.mjs` before the broker implementation loads. The platform wrapper rejects persistent credential mutations on systems without a configured secure backend, sanitizes Windows provider discovery, installs an allowlisted synchronous command boundary for `supabase` and `gcloud` batch launchers, awaits the delegated broker entry point, and restores the process API after completion.

When agent-approved mode is enabled, the router may call the updater helper in check-only mode before stale `doctor`, `start`, `compile`, `sync`, or `status` operations. This interval-limited path cannot install a package and cannot fail the requested command.

After successful `update`, `init`, `compile`, `sync`, or `link` commands, the router invokes `bin/agent-kernel-update-guidance.mjs`. That helper reads local cached state only and refreshes bounded update notices in existing agent guidance files.

## Delegated

Commands without an explicit router rule delegate to `dist/cli.mjs` or an existing identity-aware helper selected by the router.

## Safety rules

- Routed commands must be covered by smoke tests.
- Dashboard generation is local-only, read-only, redacted, HTML-escaped, CSP-restricted, and atomic.
- Dashboard output rejects symbolic or non-regular targets and symbolic existing parent directories.
- Dashboard browser opening uses argument arrays without a shell and does not invalidate a generated file when opening fails.
- Only the updater helper may perform registry checks or global package installation.
- Opportunistic checks are restricted to approved lifecycle commands, stale caches, non-JSON mode, and agent-approved configuration.
- Opportunistic check failure must not fail the delegated lifecycle command.
- Cached notices are suppressed for `--json` output.
- The guidance publisher must not create missing agent files or truncate files with malformed markers.
- Agent-approved installation must authorize the caller before npm executes.
- Persistent project credentials are supported only when a secure platform backend is configured. The current persistent backend is macOS Keychain; other platforms fail closed and may use non-persistent provider environment credentials.
- Windows `.cmd` and `.bat` provider launchers must be absolute regular files with an allowlisted basename and must execute through the validated `%SystemRoot%\\System32\\cmd.exe` path. General `shell: true` execution is prohibited.
