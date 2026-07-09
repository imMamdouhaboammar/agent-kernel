// test/public-cli-daemon.mjs — Optional local daemon smoke test.
//
// Invariants:
//   1. The public wrapper routes `agent-kernel daemon` to the helper.
//   2. The daemon is stopped by default.
//   3. `daemon start` starts a local-only runtime on an ephemeral port.
//   4. `/ak/observe` stores append-only local evidence, not approved memory.
//   5. `/ak/context` responds with a compact local context payload.
//   6. `daemon stop` tears the runtime down.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertContains, makeEnv, repo, runCli } from './_lib/helpers.mjs';

const publicCli = join(repo.root, 'bin', 'agent-kernel.mjs');

function runPublic(env, ...args) {
  return execFileSync(process.execPath, [publicCli, ...args], {
    cwd: repo.root,
    env,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  const json = JSON.parse(text);
  if (!response.ok) throw new Error(`${url} failed ${response.status}: ${text}`);
  return json;
}

export async function run() {
  const { env, kernelHome } = makeEnv();
  runCli(env, 'init', '--sync');

  const stopped = JSON.parse(runPublic(env, 'daemon', 'status', '--json'));
  if (stopped.running) throw new Error(`daemon should be stopped by default: ${JSON.stringify(stopped)}`);

  try {
    const startOut = runPublic(env, 'daemon', 'start', '--port', '0');
    assertContains(startOut, 'Started Agent Kernel daemon', 'daemon start did not report success');

    const status = JSON.parse(runPublic(env, 'daemon', 'status', '--json'));
    if (!status.running || !status.port || status.host !== '127.0.0.1') {
      throw new Error(`daemon did not report local running status: ${JSON.stringify(status)}`);
    }

    const baseUrl = `http://${status.host}:${status.port}`;
    const health = await (await fetch(`${baseUrl}/ak/health`)).json();
    if (!health.ok || health.service !== 'agent-kernel-daemon') {
      throw new Error(`daemon health response invalid: ${JSON.stringify(health)}`);
    }

    const observed = await postJson(`${baseUrl}/ak/observe`, {
      sessionId: 'session_smoke',
      agentId: 'test-agent',
      type: 'command_failure',
      projectId: 'agent-kernel',
      cwd: repo.root,
      files: ['src/cli.mjs'],
      command: 'npm test',
      exitCode: 1,
      text: 'safe-link duplicated marked block'
    });
    if (!observed.ok || observed.session.observationCount !== 1) {
      throw new Error(`observe response invalid: ${JSON.stringify(observed)}`);
    }

    const sessionJsonl = join(kernelHome, 'runtime', 'sessions', 'session_smoke.jsonl');
    if (!existsSync(sessionJsonl)) throw new Error('observe did not write session JSONL evidence');
    assertContains(readFileSync(sessionJsonl, 'utf8'), 'safe-link duplicated marked block', 'observation text missing from JSONL');

    const context = await postJson(`${baseUrl}/ak/context`, {
      sessionId: 'session_smoke',
      projectId: 'agent-kernel',
      agentId: 'test-agent',
      query: 'memory changes',
      files: ['src/cli.mjs'],
      budget: 1200
    });
    if (!context || typeof context.context !== 'string' || !context.sections) {
      throw new Error(`context response invalid: ${JSON.stringify(context)}`);
    }
  } finally {
    runPublic(env, 'daemon', 'stop');
  }

  const finalStatus = JSON.parse(runPublic(env, 'daemon', 'status', '--json'));
  if (finalStatus.running) throw new Error(`daemon still running after stop: ${JSON.stringify(finalStatus)}`);
}

export const name = 'public-cli-daemon';
