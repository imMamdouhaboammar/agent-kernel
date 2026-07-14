// test/cli-status-json.mjs — JSON output support for status / inbox / doctor.
//
// Invariants:
//   1. `status --json` returns a valid JSON envelope on stdout.
//   2. `inbox --json` returns a valid JSON envelope on stdout.
//   3. `doctor --json` returns a valid JSON envelope on stdout.
//   4. `doctor` (without --json, on a non-attention install) returns exit 0.
//   5. `doctor --json` (on a non-attention install) returns exit 0 and ok=true.
//   6. `doctor` (on an install with missing Claude settings) returns exit 1
//      and a non-OK status. The same install with --json returns exit 1 and
//      ok=false.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeEnv, repo, runCli, runCliTolerateFailure } from './_lib/helpers.mjs';

function parseStdoutAsJson(stdout) {
  try {
    return JSON.parse(stdout);
  } catch (e) {
    throw new Error(`output is not valid JSON: ${stdout}`);
  }
}

function seedClaudeAndCodexGlobals(homeDir) {
  // Create minimal Claude + Codex globals so doctor reports OK.
  const claudeDir = join(homeDir, '.claude');
  const codexDir = join(homeDir, '.codex');
  mkdirSync(claudeDir, { recursive: true });
  mkdirSync(codexDir, { recursive: true });
  writeFileSync(join(claudeDir, 'CLAUDE.md'), '# Claude\n');
  writeFileSync(join(codexDir, 'AGENTS.md'), '# Codex\n');
  writeFileSync(join(claudeDir, 'settings.json'), JSON.stringify({ hooks: { SessionStart: [] } }, null, 2));
}

export async function run() {
  const { env, kernelHome, homeDir } = makeEnv();
  seedClaudeAndCodexGlobals(homeDir);
  runCli(env, 'init', '--sync');

  // 1. status --json
  const statusJson = runCli(env, 'status', '--json');
  const statusPayload = parseStdoutAsJson(statusJson);
  for (const key of ['ok', 'version', 'home', 'approvedRules', 'pendingProposals', 'dist']) {
    if (!(key in statusPayload)) {
      throw new Error(`status --json missing key: ${key} in ${JSON.stringify(statusPayload)}`);
    }
  }
  if (statusPayload.ok !== true) {
    throw new Error(`status --json ok should be true: ${JSON.stringify(statusPayload)}`);
  }

  // 2. inbox --json
  const inboxJson = runCli(env, 'inbox', '--json');
  const inboxPayload = parseStdoutAsJson(inboxJson);
  for (const key of ['ok', 'count', 'items']) {
    if (!(key in inboxPayload)) {
      throw new Error(`inbox --json missing key: ${key} in ${JSON.stringify(inboxPayload)}`);
    }
  }
  if (inboxPayload.ok !== true) {
    throw new Error(`inbox --json ok should be true: ${JSON.stringify(inboxPayload)}`);
  }
  if (!Array.isArray(inboxPayload.items)) {
    throw new Error(`inbox --json items should be an array: ${JSON.stringify(inboxPayload)}`);
  }

  // 3. doctor --json (on a fully-populated install with Claude/Codex globals)
  const doctorJson = runCli(env, 'doctor', '--json');
  const doctorPayload = parseStdoutAsJson(doctorJson);
  for (const key of ['ok', 'version', 'status', 'home', 'checks']) {
    if (!(key in doctorPayload)) {
      throw new Error(`doctor --json missing key: ${key} in ${JSON.stringify(doctorPayload)}`);
    }
  }
  if (!/^\d+\.\d+\.\d+$/.test(doctorPayload.version)) {
    throw new Error(`doctor --json version unexpected: ${doctorPayload.version}`);
  }
  if (!Array.isArray(doctorPayload.checks)) {
    throw new Error(`doctor --json checks should be an array: ${JSON.stringify(doctorPayload)}`);
  }
  if (doctorPayload.ok !== true) {
    throw new Error(`healthy install doctor --json should report ok=true, got: ${JSON.stringify(doctorPayload)}`);
  }
  if (doctorPayload.status !== 'OK') {
    throw new Error(`healthy install doctor --json status should be "OK", got: ${doctorPayload.status}`);
  }

  // 4. doctor on an install with missing Claude settings → exit 1, ok=false.
  //    We construct a fresh sandbox with an empty HOME and AGENT_KERNEL_HOME,
  //    run init, then check that doctor exits non-zero because Claude/Codex
  //    globals are missing.
  {
    const freshDir = mkdtempSync(join(tmpdir(), 'ak-doctor-attention-'));
    const homeDir = join(freshDir, 'home');
    const kHome = join(homeDir, '.agent-kernel');
    mkdirSync(homeDir, { recursive: true });
    mkdirSync(kHome, { recursive: true });
    const env = {
      ...process.env,
      HOME: homeDir,
      USERPROFILE: homeDir,
      AGENT_KERNEL_HOME: kHome
    };
    execFileSync(process.execPath, [join(repo.root, 'dist', 'cli.mjs'), 'init', '--sync'], { env, encoding: 'utf8' });
    // Sanity: Claude settings.json must be missing in this fresh sandbox
    // (init --sync creates .claude/CLAUDE.md and .codex/AGENTS.md, but not
    // settings.json or hooks/ — those are created by `enforce install`).
    if (existsSync(join(homeDir, '.claude', 'settings.json'))) {
      throw new Error('sandbox unexpectedly has ~/.claude/settings.json');
    }
    // doctor should return non-zero (ATTENTION REQUIRED)
    const attention = runCliTolerateFailure(env, 'doctor');
    if (attention.status === 0) {
      throw new Error(`fresh-install doctor should exit non-zero on missing Claude settings, got rc=0 stdout=${attention.stdout}`);
    }
    if (!attention.stdout.includes('ATTENTION REQUIRED')) {
      throw new Error(`fresh-install doctor should report ATTENTION REQUIRED, got: ${attention.stdout}`);
    }
    // doctor --json should also exit non-zero with ok=false
    const attentionJson = runCliTolerateFailure(env, 'doctor', '--json');
    if (attentionJson.status === 0) {
      throw new Error(`fresh-install doctor --json should exit non-zero, got rc=0 stdout=${attentionJson.stdout}`);
    }
    let payload;
    try { payload = JSON.parse(attentionJson.stdout); } catch (e) { throw new Error(`doctor --json output is not valid JSON: ${attentionJson.stdout}`); }
    if (payload.ok !== false) {
      throw new Error(`fresh-install doctor --json ok should be false, got: ${JSON.stringify(payload)}`);
    }
    if (payload.status !== 'ATTENTION REQUIRED') {
      throw new Error(`fresh-install doctor --json status should be ATTENTION REQUIRED, got: ${JSON.stringify(payload)}`);
    }
    // Cleanup
    rmSync(freshDir, { recursive: true, force: true });
  }
}

export const name = 'cli-status-json';
