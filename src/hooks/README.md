# `src/hooks/` — PLACEHOLDER (planned, not implemented)

This folder is **reserved for future Claude hook scripts** that will
be installed by `agent-kernel enforce install`. Today, the hook
scripts are emitted at install time as small standalone shell files
inside `~/.claude/hooks/agent-kernel/`, generated from inline
templates in `src/cli.mjs`.

**Today**, no hook source files live in this folder. Adding files
here has no runtime effect because the installer reads its templates
from `src/cli.mjs`, not from `src/hooks/`.

See [`docs/ARCHITECTURE_NOW.md`](../../docs/ARCHITECTURE_NOW.md) for the
full current architecture and the planned modularization target.

When the modularization lands (tracked in
[`development/BACKLOG.md`](../../development/BACKLOG.md)) this folder
will receive files like `src/hooks/pre-tool.sh`,
`src/hooks/post-tool.sh`, etc. Until then, treat this folder as
documentation-only.

**Do not** add real hook scripts here expecting them to be installed —
they will not be.