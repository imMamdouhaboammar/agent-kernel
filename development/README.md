# Development roadmap (canonical)

This is the canonical roadmap folder. The legacy alias `../develpment/`
(misspelled) is kept as a compatibility pointer so older agents and
tooling that already reference it continue to work.

## Contents

- `BACKLOG.md` — full backlog from `v0.1` to `v2.0`
- `EPICS.md` — backlog grouped by product epic
- `MILESTONES.md` — release targets
- `SPRINT-PLAN.md` — current sprint
- `RELEASE-GATES.md` — packaging and quality gates
- `backlog.json` — machine-readable roadmap for agents and automation

## Migration note (legacy `develpment/` folder)

The folder was originally created with a typo as `develpment/`. In
this release we added a canonical `development/` folder with the same
content and pointed `develpment/README.md` at it. Existing agents
and workflows that reference `develpment/` continue to work because
both folders contain the same files.

Future roadmap edits should land in `development/` first, then mirror
to `develpment/` if the legacy path is still expected to work.