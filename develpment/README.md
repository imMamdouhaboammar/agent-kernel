# `develpment/` — LEGACY ALIAS

**This folder is kept for backward compatibility only.**
The canonical spelling is **`development/`** (one "p"), which is the
folder new agents and contributors should use.

## Why two folders?

The original maintainer created this folder with a typo (`develpment/`)
in `v0.0.4`. Older agents and tooling may have hard-coded this path.
To avoid breaking them, both folders ship in the repo and contain
identical content. The canonical folder is `development/`.

## See also

- `../development/README.md` — canonical roadmap with the same files
  plus the migration note.

## Migration note

If you are writing a new agent, skill, or workflow that references
this folder, use `../development/` instead.