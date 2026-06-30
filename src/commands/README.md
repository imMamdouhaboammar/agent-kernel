# `src/commands/` — PLACEHOLDER (planned, not implemented)

This folder is **reserved for future per-command modules** that will
extract each top-level CLI command (`init`, `memory`, `episode`,
`guard`, `mcp`, etc.) into its own file.

**Today**, all commands are dispatched from a single function inside
`src/cli.mjs`. Adding files to this folder has no runtime effect — they
are not imported by `src/cli.mjs`.

See [`docs/ARCHITECTURE_NOW.md`](../../docs/ARCHITECTURE_NOW.md) for the
full current architecture and the planned modularization target.

When the modularization lands (tracked in
[`development/BACKLOG.md`](../../development/BACKLOG.md)) this folder
will receive files like `src/commands/init.mjs`,
`src/commands/memory.mjs`, etc. Until then, treat this folder as
documentation-only.

**Do not** add real command modules here expecting them to be picked
up — they will not be.