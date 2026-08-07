# ContextFS RED State

The first implementation cycle intentionally lands the public ContextFS contract before production routing exists.

Expected failure before implementation:

- `test/public-cli-context.mjs` reaches `agent-kernel context tree ak:// --json`
- the current router does not own `context tree` as a ContextFS command
- therefore the smoke suite must fail until `bin/agent-kernel-contextfs.mjs` and routing are implemented

This file records the intended TDD boundary for the GitHub Actions run on the draft PR.
