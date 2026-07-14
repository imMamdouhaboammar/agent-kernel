# Agent-Approved Updater Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a secure, configurable CLI updater that trusted AI agents can invoke after one-time user authorization and that surfaces cached update notices across connected agent guidance.

**Architecture:** Route the `update` command family to a focused helper binary. Keep registry access and installation isolated in that helper, persist additive configuration and cache data under `AGENT_KERNEL_HOME`, and let the compiler consume only cached status so normal CLI behavior remains offline-friendly.

**Tech Stack:** Node.js ESM, built-in `fs`, `path`, `os`, `child_process`, and `readline`; npm registry CLI; repository smoke-test harness; GitHub Actions.

## Global Constraints

- Package name is fixed to `@mamdouh-aboammar/agent-kernel`.
- Node.js support remains `>=18.18.0`.
- No new runtime dependency.
- Agent-approved mode is disabled by default.
- Default update channel is `latest`.
- Trust changes require interactive confirmation or `--yes`.
- Apply requires an explicit trusted agent identity.
- Normal commands never make blocking registry requests.
- No daemon, release, publish, version bump, or merge is part of this work.

---

## File structure

- Create `bin/agent-kernel-update.mjs`: update configuration, registry lookup, cache, authorization, installation, verification, rollback, and audit.
- Modify `bin/agent-kernel-router.mjs`: route `update` and print cached notices for non-update commands.
- Create `test/public-cli-update.mjs`: fake npm integration and behavioral smoke coverage.
- Modify `test/smoke.mjs`: register the updater test module.
- Modify `src/cli.mjs`: add update defaults, cache reading, and generated guidance notices.
- Regenerate `dist/cli.mjs` through the repository build process only.
- Create `docs/UPDATES.md`: user and agent updater runbook.
- Modify `README.md`, `docs/README.md`, `docs/ARCHITECTURE_NOW.md`, and `docs/public-cli/ROUTED_COMMANDS.md`.

### Task 1: Commit the failing public CLI tests

**Files:**
- Create: `test/public-cli-update.mjs`
- Modify: `test/smoke.mjs`

**Interfaces:**
- Consumes: public executable `bin/agent-kernel-router.mjs`, isolated `AGENT_KERNEL_HOME`, injected `AGENT_KERNEL_NPM_BIN`.
- Produces: `run()` smoke module that proves the full expected command contract.

- [ ] **Step 1: Write a fake npm executable in the test fixture**

The fixture records argument arrays to a JSONL file and returns configured versions for `view`, succeeds or fails `install`, and exposes deterministic behavior through environment variables.

- [ ] **Step 2: Add failing assertions for status and governance**

Assert that:

```js
const status = JSON.parse(runPublic(env, 'update', 'status', '--json'));
assert.equal(status.mode, 'disabled');
assert.equal(status.channel, 'latest');
assert.deepEqual(status.trustedAgents, []);
```

Then assert `enable`, `channel`, `trust`, `revoke`, and `disable` reject non-interactive changes without `--yes` and persist validated changes with `--yes`.

- [ ] **Step 3: Add failing assertions for check and cache behavior**

Use `FAKE_NPM_VIEW_VERSION=1.10.0` and assert `update check --json` reports `updateAvailable: true`, writes `runtime/update-status.json`, reuses a fresh cache, and calls fake npm again only with `--force`.

- [ ] **Step 4: Add failing assertions for authorization and apply**

Enable `claude,codex`, deny `cursor`, accept `--agent claude` and `AGENT_KERNEL_AGENT_ID=codex`, verify install arguments contain the exact resolved version, verify rollback occurs after a simulated version mismatch, and assert audit records omit injected secret-shaped text.

- [ ] **Step 5: Add failing assertions for generated notifications and router notice**

After writing an available-update cache, run `compile`, assert the generated constitution includes the update section, and assert a normal routed command prints a concise cached notice to stderr without invoking fake npm.

- [ ] **Step 6: Wire the test into the smoke orchestrator**

Add:

```js
import { run as runPublicCliUpdate } from './public-cli-update.mjs';
```

and:

```js
['public-cli-update', runPublicCliUpdate],
```

- [ ] **Step 7: Commit and verify RED through GitHub Actions**

Commit message:

```text
test(update): define agent-approved updater contract
```

Expected CI result: smoke fails because `agent-kernel update` is not routed or implemented.

### Task 2: Implement the focused updater helper

**Files:**
- Create: `bin/agent-kernel-update.mjs`

**Interfaces:**
- Consumes: `process.argv`, `AGENT_KERNEL_HOME`, `AGENT_KERNEL_NPM_BIN`, package version from repository `package.json`.
- Produces: human and JSON command responses for the complete `update` family.

- [ ] **Step 1: Add immutable constants and safe parsers**

Implement:

```js
const PACKAGE_NAME = '@mamdouh-aboammar/agent-kernel';
const DEFAULT_UPDATES = Object.freeze({
  mode: 'disabled',
  channel: 'latest',
  trustedAgents: [],
  checkIntervalHours: 24
});
```

Add exact semver comparison, safe dist-tag validation, agent identity normalization, and a parser supporting `--flag value` and `--flag=value`.

- [ ] **Step 2: Add atomic state persistence**

Read existing config without destroying unrelated keys. Merge `updates` defaults on read. Write config and cache through a sibling temporary file followed by rename. Ignore malformed cache on status reads.

- [ ] **Step 3: Add governance confirmation**

Implement `requireConfirmation(action, flags)` so `--yes` permits a change, an interactive TTY prompts once, and non-interactive execution fails safely. JSON output must not skip this check.

- [ ] **Step 4: Add registry check and cache policy**

Execute:

```js
execFileSync(npmBin, [
  'view',
  `${PACKAGE_NAME}@${channel}`,
  'version',
  '--json'
], options);
```

Parse JSON string or array output, compare versions, and persist the schema from the design. Reuse cache while it is fresh unless `--force` is present.

- [ ] **Step 5: Add agent authorization and apply transaction**

Authorize mode and allowlist before executing npm. Install the exact target version with `npm install --global`. Verify using the resolved public CLI executable, run `doctor`, then `compile` and `sync`. On verification failure, attempt one install of the previous version and report rollback status.

- [ ] **Step 6: Add bounded audit records**

Append only normalized fields to `logs/updates.jsonl`. Convert failures to fixed categories such as `registry-unavailable`, `unauthorized-agent`, `install-failed`, `verification-failed`, and `rollback-failed`.

- [ ] **Step 7: Commit the helper**

Commit message:

```text
feat(update): add trusted self-update helper
```

### Task 3: Route update commands and expose cached notices

**Files:**
- Modify: `bin/agent-kernel-router.mjs`

**Interfaces:**
- Consumes: `runtime/update-status.json` and `config.json` under `AGENT_KERNEL_HOME`.
- Produces: routing to the updater helper and a non-blocking stderr notice for other commands.

- [ ] **Step 1: Add updater routing**

Resolve `agent-kernel-update.mjs` beside the router and select it when `command === 'update'`.

- [ ] **Step 2: Add safe cached notice reading**

Before spawning a non-update target, read cache with guarded JSON parsing. Print only when `updateAvailable === true`:

```text
Agent Kernel update available: <current> -> <target>. Run: agent-kernel update status
```

Do not print for JSON-sensitive commands when `--json` is present. Never invoke npm from the router.

- [ ] **Step 3: Commit routing**

Commit message:

```text
feat(cli): route updater and surface cached notices
```

### Task 4: Publish update context to connected agents

**Files:**
- Modify: `src/cli.mjs`
- Modify through build only: `dist/cli.mjs`

**Interfaces:**
- Consumes: update config and cache under the kernel home.
- Produces: generated guidance section for all connected agents.

- [ ] **Step 1: Extend default configuration additively**

Add the `updates` default object without replacing existing user config.

- [ ] **Step 2: Read and render cached update context**

Add a pure renderer returning an empty string when no update is available and a bounded Markdown section when available. Include current version, target version, channel, mode, trusted agents, and the apply command.

- [ ] **Step 3: Insert the renderer into generated files**

Include the section in `renderAgentsMd`, `renderClaudeMd`, `renderCursorRule`, `renderAntigravityAgents`, and `renderGeminiMd`. Compilation must remain offline.

- [ ] **Step 4: Build generated runtime**

Run:

```text
npm run build
```

Expected result: `dist/cli.mjs` is regenerated from `src/cli.mjs`.

- [ ] **Step 5: Commit compiler integration**

Commit message:

```text
feat(agents): publish cached update guidance
```

### Task 5: Complete updater documentation

**Files:**
- Create: `docs/UPDATES.md`
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/ARCHITECTURE_NOW.md`
- Modify: `docs/public-cli/ROUTED_COMMANDS.md`

**Interfaces:**
- Consumes: final command behavior.
- Produces: discoverable operational and architecture documentation.

- [ ] **Step 1: Write the updater runbook**

Document activation, channel selection, trust management, agent invocation, JSON mode, cache behavior, audit path, rollback semantics, offline behavior, and troubleshooting.

- [ ] **Step 2: Add README quick-start commands**

Add a compact example showing:

```text
agent-kernel update enable --agents claude,codex
agent-kernel update check
agent-kernel update apply --agent claude
```

- [ ] **Step 3: Update docs navigation and architecture**

Link `UPDATES.md`, register `update` as a routed command, and document that the helper is the only network and global-install boundary.

- [ ] **Step 4: Commit documentation**

Commit message:

```text
docs(update): document trusted updater workflow
```

### Task 6: Verify, review, and open the pull request

**Files:**
- Review all changed files.

**Interfaces:**
- Produces: evidence-backed PR ready for independent review.

- [ ] **Step 1: Run repository checks through GitHub Actions**

Required checks:

```text
npm run build
npm test
npm run lint
npm run typecheck
npm run size
```

Use the exact branch head workflow results as validation evidence.

- [ ] **Step 2: Review the compare diff**

Confirm no version bump, release metadata, secrets, daemon, unrelated refactor, hand-edited generated drift, or default-branch write is present.

- [ ] **Step 3: Confirm remote drift**

Compare the branch with the current `master`. If `master` advanced into a conflicting area, refresh safely before opening the PR.

- [ ] **Step 4: Open a focused PR**

Use the repository PR template and include objective, evidence, file changes, architecture and API impact, exact validation, CI state, risks, rollback behavior, independent verification, and commit list.

- [ ] **Step 5: Do not merge**

Leave the PR open for independent review and full-environment verification.
