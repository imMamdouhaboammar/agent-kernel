# `src/core/` — PLACEHOLDER (planned, not implemented)

This folder is **reserved for future core utility modules** that will
extract the underlying domain logic: path helpers, JSON I/O,
memory-store CRUD, episode archive/index, policy pack arrays, compile
pipeline, guard scanner, MCP tool registry.

**Today**, all core logic lives inline in `src/cli.mjs`. Adding files
to this folder has no runtime effect — they are not imported by
`src/cli.mjs`.

See [`docs/ARCHITECTURE_NOW.md`](../../docs/ARCHITECTURE_NOW.md) for the
full current architecture and the planned modularization target.

When the modularization lands (tracked in
[`development/BACKLOG.md`](../../development/BACKLOG.md)) this folder
will receive files like `src/core/paths.mjs`, `src/core/memory-store.mjs`,
etc. Until then, treat this folder as documentation-only.

**Do not** add real utility modules here expecting them to be picked
up — they will not be.