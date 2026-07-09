// test/public-cli-runtime-doctor.mjs — Runtime diagnostics wrapper smoke test.
//
// Invariants:
//   1. `agent-kernel status --runtime --json` routes through the public wrapper.
//   2. `agent-kernel doctor --runtime --json` returns structured diagnostics.
//   3. Warnings are allowed when optional runtime integrations are not installed.
//   4. Diagnostics do not require the daemon to be running.

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { makeEnv, repo, runCli } from './_lib/helpers.mjs';

const publicCli = join(repo.root, 'bin', 'agent-kernel.mjs');

function runPublicTolerate(env, ...args) {
  const result = spawnSync(process.execPath, [publicCli, ...args], {
    cwd: repo.root,
    env,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || ''
  };
}

function parseJsonCommand(result, label) {
  if (result.status > 2) throw new Error(`${label} exited with unexpected status ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  try { return JSON.parse(result.stdout); } catch {
    throw new Error(`${label} did not return JSON\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }
}

export async function run() {
  const { env, kernelHome } = makeEnv();
  runCli(env, 'init', '--sync');

  const status = parseJsonCommand(runPublicTolerate(env, 'status', '--runtime', '--json'), 'status --runtime --json');
  if (status.home !== kernelHome) throw new Error(`runtime status reported wrong home: ${JSON.stringify(status)}`);
  if (!status.runtime || status.runtime.running !== false) throw new Error(`runtime status should work while daemon is stopped: ${JSON.stringify(status)}`);

  const doctor = parseJsonCommand(runPublicTolerate(env, 'doctor', '--runtime', '--json'), 'doctor --runtime --json');
  if (!doctor.runtime || !Array.isArray(doctor.checks)) throw new Error(`runtime doctor missing diagnostics: ${JSON.stringify(doctor)}`);
  if (!doctor.checks.some((check) => check.id === 'runtime-daemon')) throw new Error('runtime doctor missing runtime-daemon check');
  if (!doctor.checks.some((check) => check.id === 'pending-proposals')) throw new Error('runtime doctor missing pending-proposals check');
  if (!doctor.checks.some((check) => check.id === 'failure-lessons')) throw new Error('runtime doctor missing failure-lessons check');
}

export const name = 'public-cli-runtime-doctor';
