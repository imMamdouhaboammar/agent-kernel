# ContextFS RED State

This document records the historical RED state captured on 2026-08-07 before ContextFS production routing landed.

At that point, the expected failure was:

- `test/public-cli-context.mjs` reached `agent-kernel context tree ak:// --json`
- the router did not yet own `context tree` as a ContextFS command
- the smoke suite therefore failed until `bin/agent-kernel-contextfs.mjs` and routing were implemented

The current branch no longer has that missing-routing state. The file is retained only as TDD evidence for the original implementation cycle.
