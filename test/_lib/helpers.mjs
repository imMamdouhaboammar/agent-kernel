// test/_lib/helpers.mjs — Shared test helpers.
//
// Goals:
//   - Each test creates its own tempdir so tests are isolated.
//   - Each test points AGENT_KERNEL_HOME and HOME at the tempdir so
//     the user's real ~/.agent-kernel is never touched.
//   - Each test runs the locally-built CLI (dist/cli.mjs) via Node.
//   - Errors include a clear message + the captured stdout/stderr.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
// testDir is test/_lib/. We need to go up two levels to reach the repo root.
const repoRoot = resolve(testDir, '..', '..');
const cliPath = join(repoRoot, 'dist', 'cli.mjs');

if (!existsSync(cliPath)) {
  throw new Error(`dist/cli.mjs missing — run 'npm run build' before 'npm test'`);
}

/**
 * Create an isolated test environment.
 * Returns { env, homeDir, kernelHome, cli }.
 *
 * env — process.env override that sets AGENT_KERNEL_HOME and HOME
 * homeDir — fresh tmpdir (used as $HOME for the subprocess)
 * kernelHome — $AGENT_KERNEL_HOME inside homeDir
 * cli — path to dist/cli.mjs
 */
export function makeEnv() {
  const homeDir = mkdtempSync(join(tmpdir(), 'agent-kernel-test-'));
  const kernelHome = join(homeDir, '.agent-kernel');
  mkdirSync(kernelHome, { recursive: true });
  return {
    cli: cliPath,
    homeDir,
    kernelHome,
    env: {
      ...process.env,
      HOME: homeDir,
      USERPROFILE: homeDir,
      AGENT_KERNEL_HOME: kernelHome
    }
  };
}

/**
 * Run the CLI with the given args inside the given env.
 * Returns stdout. Throws with a tagged message on non-zero exit.
 */
export function runCli(env, ...args) {
  try {
    return execFileSync(process.execPath, [cliPath, ...args], {
      cwd: repoRoot,
      env,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
  } catch (err) {
    const stdout = err.stdout?.toString() ?? '';
    const stderr = err.stderr?.toString() ?? '';
    throw new Error(
      `agent-kernel ${args.join(' ')} failed (exit ${err.status}):\n--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`
    );
  }
}

/**
 * Like runCli but tolerates a non-zero exit code. Returns
 * { stdout, stderr, status }. Used for commands that are expected to
 * exit with a violation (e.g. `guard --file` with a secret).
 */
export function runCliTolerateFailure(env, ...args) {
  try {
    const stdout = execFileSync(process.execPath, [cliPath, ...args], {
      cwd: repoRoot,
      env,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { stdout, stderr: '', status: 0 };
  } catch (err) {
    return {
      stdout: err.stdout?.toString() ?? '',
      stderr: err.stderr?.toString() ?? '',
      status: err.status ?? 1
    };
  }
}

/**
 * Assert that haystack contains needle. Throw with a clear message.
 */
export function assertContains(haystack, needle, message) {
  if (!haystack.includes(needle)) {
    throw new Error(
      `${message ?? 'expected output to contain needle'}\n--- needle ---\n${needle}\n--- actual ---\n${haystack}`
    );
  }
}

/**
 * Assert that haystack does NOT contain needle. Throw with a clear message.
 */
export function assertNotContains(haystack, needle, message) {
  if (haystack.includes(needle)) {
    throw new Error(
      `${message ?? 'expected output to NOT contain needle'}\n--- needle ---\n${needle}\n--- actual ---\n${haystack}`
    );
  }
}

export const repo = { root: repoRoot, testDir, cli: cliPath };