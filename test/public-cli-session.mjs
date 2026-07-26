// test/public-cli-session.mjs — Public session command smoke test.
//
// Invariants:
//   1. `agent-kernel session start` creates a local session JSON record.
//   2. Session commands work without the daemon running.
//   3. Unknown/custom agent IDs are accepted.
//   4. `list`, `show`, and `end` expose the session state.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeEnv, repo, runCli } from './_lib/helpers.mjs';

const publicCli = join(repo.root, 'bin', 'agent-kernel.mjs');

function runPublic(env, ...args) {
  return execFileSync(process.execPath, [publicCli, ...args], {
    cwd: repo.root,
    env,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
}

function runPublicFailure(env, ...args) {
  try {
    runPublic(env, ...args);
    return { status: 0, stderr: '' };
  } catch (error) {
    return { status: error.status || 1, stderr: String(error.stderr || '') };
  }
}

export async function run() {
  const { env, kernelHome } = makeEnv();
  runCli(env, 'init', '--sync');

  const runtimeConfig = join(kernelHome, 'runtime', 'config.json');
  mkdirSync(join(kernelHome, 'runtime'), { recursive: true });
  writeFileSync(runtimeConfig, JSON.stringify({ sentinel: 'preserve-me' }, null, 2) + '\n');
  const traversal = runPublicFailure(env, 'session', 'end', '../config', '--json');
  if (traversal.status === 0 || !traversal.stderr.includes('Invalid session ID')) {
    throw new Error(`session command accepted a path-like ID: ${JSON.stringify(traversal)}`);
  }
  if (!readFileSync(runtimeConfig, 'utf8').includes('preserve-me')) {
    throw new Error('session command wrote outside the sessions directory');
  }

  const started = JSON.parse(runPublic(env, 'session', 'start', '--agent', 'custom-agent', '--project', repo.root, '--json'));
  if (!started.id || started.status !== 'active' || started.agentId !== 'custom-agent') {
    throw new Error(`session start returned invalid payload: ${JSON.stringify(started)}`);
  }

  const sessionPath = join(kernelHome, 'runtime', 'sessions', `${started.id}.json`);
  if (!existsSync(sessionPath)) throw new Error(`session file was not created: ${sessionPath}`);

  const listed = JSON.parse(runPublic(env, 'session', 'list', '--json'));
  if (!listed.sessions.some((session) => session.id === started.id)) {
    throw new Error(`session list did not include started session: ${JSON.stringify(listed)}`);
  }

  const shown = JSON.parse(runPublic(env, 'session', 'show', started.id, '--json'));
  if (shown.session.id !== started.id || !Array.isArray(shown.observations)) {
    throw new Error(`session show returned invalid payload: ${JSON.stringify(shown)}`);
  }

  const ended = JSON.parse(runPublic(env, 'session', 'end', started.id, '--json'));
  if (ended.status !== 'completed' || ended.endedAt === null) {
    throw new Error(`session end did not complete the session: ${JSON.stringify(ended)}`);
  }
}

export const name = 'public-cli-session';
