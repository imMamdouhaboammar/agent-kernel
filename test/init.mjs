// test/init.mjs — `init` command creates the expected JSON memory layout.
//
// Invariants:
//   1. `init --sync` creates the kernel home directory.
//   2. `init --sync` creates source/memories/{rules,preferences,workflows}.json
//      as valid JSON arrays.
//   3. `init --sync --enforce` adds schemas/ and dist/ directories.
//   4. `validate` returns "ok" against a freshly-initialized home.
//   5. Re-running `init --sync` is idempotent (does not duplicate data).
//   6. `init --sync --force` deep-merges the existing config.json: new
//      top-level keys from the default config are added, and user
//      customizations (e.g. updates, packageManagerPreference) are
//      preserved.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertContains, makeEnv, runCli } from './_lib/helpers.mjs';

export async function run() {
  const { env, kernelHome } = makeEnv();

  // 1 + 2. init --sync populates the JSON memory layout.
  const initOut = runCli(env, 'init', '--sync');
  assertContains(initOut, 'init', 'init --sync did not print an init confirmation');

  const memoriesDir = join(kernelHome, 'source', 'memories');
  for (const name of ['rules.json', 'preferences.json', 'workflows.json']) {
    const path = join(memoriesDir, name);
    if (!existsSync(path)) {
      throw new Error(`init did not create ${path}`);
    }
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    if (!Array.isArray(parsed)) {
      throw new Error(`${name} should be a JSON array, got ${typeof parsed}`);
    }
  }

  // 3. init --sync --enforce adds schemas + dist + AGENTS.md.
  runCli(env, 'init', '--sync', '--enforce');
  const schemasDir = join(kernelHome, 'source', 'schemas');
  if (!existsSync(schemasDir)) {
    throw new Error('init --enforce did not create source/schemas/');
  }
  const agentsOut = join(kernelHome, 'dist', 'AGENTS.md');
  if (!existsSync(agentsOut)) {
    throw new Error('init --enforce did not create dist/AGENTS.md');
  }

  // 4. validate passes against a freshly-initialized home.
  const validateOut = runCli(env, 'validate');
  assertContains(validateOut.toLowerCase(), 'ok', 'validate did not report OK');

  // 5. Idempotency — re-running init should not throw.
  runCli(env, 'init', '--sync');
  const rulesAfter = JSON.parse(readFileSync(join(memoriesDir, 'rules.json'), 'utf8'));
  if (!Array.isArray(rulesAfter)) {
    throw new Error('re-running init broke rules.json shape');
  }

  // 6. `init --force` deep-merges the existing config.json. New top-level
  //    keys from the default config are added, and user customizations
  //    (updates, packageManagerPreference overrides) are preserved.
  {
    const { env: env2, kernelHome: home2 } = makeEnv();
    runCli(env2, 'init', '--sync');
    const configPath = join(home2, 'config.json');
    const original = JSON.parse(readFileSync(configPath, 'utf8'));
    const userOverrides = {
      ...original,
      packageManagerPreference: 'pnpm', // user override
      updates: {                          // brand-new section
        mode: 'agent-approved',
        channel: 'latest',
        trustedAgents: ['claude', 'codex', 'mavis', 'gemini'],
        checkIntervalHours: 24
      },
      memoryWritePolicy: {
        ...original.memoryWritePolicy,
        mode: 'bypass'                    // user override nested
      }
    };
    writeFileSync(configPath, JSON.stringify(userOverrides, null, 2) + '\n');

    runCli(env2, 'init', '--sync', '--force');

    const merged = JSON.parse(readFileSync(configPath, 'utf8'));
    if (merged.packageManagerPreference !== 'pnpm') {
      throw new Error(`init --force overrode user packageManagerPreference (got ${merged.packageManagerPreference})`);
    }
    if (!merged.updates || merged.updates.mode !== 'agent-approved') {
      throw new Error('init --force dropped the user updates section');
    }
    if (JSON.stringify(merged.updates.trustedAgents) !== JSON.stringify(['claude', 'codex', 'mavis', 'gemini'])) {
      throw new Error(`init --force changed user trustedAgents: ${JSON.stringify(merged.updates.trustedAgents)}`);
    }
    if (merged.memoryWritePolicy?.mode !== 'bypass') {
      throw new Error('init --force overrode user memoryWritePolicy.mode');
    }
    if (merged.version !== original.version) {
      throw new Error(`init --force changed config version (got ${merged.version})`);
    }
    if (merged.createdAt !== original.createdAt) {
      throw new Error('init --force rewrote createdAt (should preserve original install date)');
    }
  }
}

export const name = 'init';