# Routed public commands

The public CLI routes selected commands to focused implementations with their own safety and compatibility boundaries.

## Routed

```text
agent-kernel update <status|check|enable|disable|channel|trust|revoke|apply>
agent-kernel architecture <command>
agent-kernel retention <command>
agent-kernel export <file>
agent-kernel import <file>
agent-kernel view [surface]
agent-kernel report <file>
agent-kernel session compact <session-id>
agent-kernel link
agent-kernel git-hook install
ak update <command>
ak link
ak git-hook install
```

The updater is routed to `bin/agent-kernel-update.mjs`. It is the only public command boundary in this feature that may query the npm registry or install a global package.

When agent-approved mode is enabled, the router may call the updater helper in check-only mode before stale `doctor`, `start`, `compile`, `sync`, or `status` operations. This interval-limited path cannot install a package and cannot fail the requested command.

After successful `update`, `init`, `compile`, `sync`, or `link` commands, the router invokes `bin/agent-kernel-update-guidance.mjs`. That helper reads local cached state only and refreshes bounded update notices in existing agent guidance files.

## Delegated

Commands without an explicit router rule delegate to `dist/cli.mjs` or an existing identity-aware helper selected by the router.

## Safety rules

- Routed commands must be covered by smoke tests.
- Only the updater helper may perform registry checks or global package installation.
- Opportunistic checks are restricted to approved lifecycle commands, stale caches, non-JSON mode, and agent-approved configuration.
- Opportunistic check failure must not fail the delegated lifecycle command.
- Cached notices are suppressed for `--json` output.
- The guidance publisher must not create missing agent files or truncate files with malformed markers.
- Agent-approved installation must authorize the caller before npm executes.
