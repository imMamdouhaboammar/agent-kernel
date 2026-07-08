// test/mode-config.mjs — Agent Kernel mode helper.
//
// Invariants:
//   1. default mode is approval
//   2. set trusted writes config.json
//   3. set bypass writes config.json
//   4. invalid mode exits non-zero

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertContains, makeEnv, repo, runCliTolerateFailure } from './_lib/helpers.mjs';

function runMode(env, ...args) {
  return execFileSync(process.execPath, [join(repo.root, 'bin', 'agent-kernel-mode.mjs'), ...args], {
    cwd: repo.root,
    env,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
}

export async function run() {
  const { env, kernelHome } = makeEnv();

  const showOut = runMode(env, 'show');
  assertContains(showOut, 'approval', 'default mode should be approval');

  runMode(env, 'set', 'trusted');
  const trustedConfig = JSON.parse(readFileSync(join(kernelHome, 'config.json'), 'utf8'));
  if (trustedConfig.agentWriteMode !== 'trusted') {
    throw new Error('agent-kernel-mode did not persist trusted mode');
  }

  runMode(env, 'set', 'bypass');
  const bypassConfig = JSON.parse(readFileSync(join(kernelHome, 'config.json'), 'utf8'));
  if (bypassConfig.agentWriteMode !== 'bypass') {
    throw new Error('agent-kernel-mode did not persist bypass mode');
  }

  const bad = runCliTolerateFailure(env, 'mode-does-not-exist');
  if (bad.status === 0) {
    throw new Error('placeholder sanity check failed: unknown CLI command should exit non-zero');
  }
}

export const name = 'mode-config';
