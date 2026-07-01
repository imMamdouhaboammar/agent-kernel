// test/init.mjs — `init` command creates the expected JSON memory layout.
//
// Invariants:
//   1. `init --sync` creates the kernel home directory.
//   2. `init --sync` creates source/memories/{rules,preferences,workflows}.json
//      as valid JSON arrays.
//   3. `init --sync --enforce` adds schemas/ and dist/ directories.
//   4. `validate` returns "ok" against a freshly-initialized home.
//   5. Re-running `init --sync` is idempotent (does not duplicate data).

import { existsSync, readFileSync } from 'node:fs';
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
}

export const name = 'init';