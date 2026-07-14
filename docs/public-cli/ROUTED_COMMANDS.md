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

After successful `update`, `init`, `compile`, `sync`, or `link` commands, the router invokes `bin/agent-kernel-update-guidance.mjs`. That helper reads local cached state only and refreshes bounded update notices in existing agent guidance files.

## Delegated

Commands without an explicit router rule delegate to `dist/cli.mjs` or an existing identity-aware helper selected by the router.

## Safety rules

- Routed commands must be covered by smoke tests.
- Normal commands must not make updater registry requests.
- Cached notices are suppressed for `--json` output.
- The guidance publisher must not create agent files that do not already exist.
- Agent-approved installation must authorize the caller before npm executes.
