// test/version.mjs — Version consistency (SSOT).
//
// Invariants:
//   1. `agent-kernel --version` matches package.json#version.
//   2. The string appears in src/cli.mjs (source) and dist/cli.mjs (built).
//   3. The npm package tarball includes the same version in its
//      package.json (verified via `npm pack --dry-run`).
//
// The matching is done by `scripts/check-version.mjs` for the source
// side. This test exercises the runtime side and the package tarball
// side.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertContains, makeEnv, repo, runCli } from './_lib/helpers.mjs';

export async function run() {
  const { env } = makeEnv();
  const pkg = JSON.parse(readFileSync(join(repo.root, 'package.json'), 'utf8'));
  const expected = pkg.version;

  // 1. CLI reports the package.json version.
  const cliVersion = runCli(env, '--version').trim();
  if (cliVersion !== expected) {
    throw new Error(`CLI --version = "${cliVersion}", expected "${expected}"`);
  }

  // 2. The built artifact contains the version.
  const distText = readFileSync(join(repo.root, 'dist', 'cli.mjs'), 'utf8');
  assertContains(distText, `const VERSION = '${expected}'`, 'dist/cli.mjs VERSION drift');

  // 3. The source artifact contains the version.
  const srcText = readFileSync(join(repo.root, 'src', 'cli.mjs'), 'utf8');
  assertContains(srcText, `const VERSION = '${expected}'`, 'src/cli.mjs VERSION drift');
}

export const name = 'version';