# `src/adapters/` — PLACEHOLDER (planned, not implemented)

This folder is **reserved for future per-agent adapter modules** that
will isolate the per-target differences in instruction-file generation
(Claude Code vs Cursor vs Antigravity etc.).

**Today**, all adapter logic lives inline in `src/cli.mjs` as part of
the `compile` command. Adding files to this folder has no runtime
effect — they are not imported by `src/cli.mjs`.

See [`docs/ARCHITECTURE_NOW.md`](../../docs/ARCHITECTURE_NOW.md) for the
full current architecture and the planned modularization target.

When the modularization lands (tracked in
[`development/BACKLOG.md`](../../development/BACKLOG.md)) this folder
will receive files like `src/adapters/claude.mjs`, `src/adapters/cursor.mjs`, etc.
Until then, treat this folder as documentation-only.

**Do not** add real code here expecting it to be picked up — it
will not be.