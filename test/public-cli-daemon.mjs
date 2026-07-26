// test/public-cli-daemon.mjs — Optional local daemon smoke test.
//
// Invariants:
//   1. The public wrapper routes `agent-kernel daemon` to the helper.
//   2. The daemon is stopped by default.
//   3. `daemon start` starts a local-only runtime on an ephemeral port.
//   4. `/ak/observe` stores append-only local evidence, not approved memory.
//   5. `/ak/context` responds with a compact local context payload.
//   6. `daemon status` reports uptime, active sessions, and last observation.
//   7. `daemon stop` tears the runtime down.

import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertContains, makeEnv, repo, runCli } from './_lib/helpers.mjs';

const publicCli = join(repo.root, 'bin', 'agent-kernel.mjs');
const daemonCli = join(repo.root, 'bin', 'agent-kernel-daemon.mjs');

function runPublic(env, ...args) {
  return execFileSync(process.execPath, [publicCli, ...args], {
    cwd: repo.root,
    env,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
}

function waitForExit(child, timeoutMs = 1200) {
  return new Promise((resolve) => {
    let stderr = '';
    let settled = false;
    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk) => { stderr += chunk; });
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ...result, stderr });
    };
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      finish({ exited: false, code: null, signal: 'SIGTERM' });
    }, timeoutMs);
    child.once('error', (error) => finish({ exited: true, code: null, signal: null, error }));
    child.once('exit', (code, signal) => finish({ exited: true, code, signal }));
  });
}

async function postJsonResponse(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });
  const text = await response.text();
  return { response, text, json: JSON.parse(text) };
}

async function postJson(url, body) {
  const result = await postJsonResponse(url, body);
  if (!result.response.ok) throw new Error(`${url} failed ${result.response.status}: ${result.text}`);
  return result.json;
}

export async function run() {
  const { env, kernelHome } = makeEnv();
  runCli(env, 'init', '--sync');

  const remoteWithoutTokenChild = spawn(process.execPath, [daemonCli, '_serve', '--host', '0.0.0.0', '--port', '0'], {
    cwd: repo.root,
    env: { ...env, AGENT_KERNEL_DAEMON_ALLOW_REMOTE: '1', AGENT_KERNEL_DAEMON_TOKEN: '' },
    stdio: ['ignore', 'ignore', 'pipe']
  });
  const remoteWithoutToken = await waitForExit(remoteWithoutTokenChild);
  if (!remoteWithoutToken.exited || remoteWithoutToken.code === 0 || !remoteWithoutToken.stderr.includes('AGENT_KERNEL_DAEMON_TOKEN')) {
    throw new Error(`remote daemon did not fail closed without a token: ${remoteWithoutToken.stderr}`);
  }

  const remoteEnv = {
    ...env,
    AGENT_KERNEL_DAEMON_ALLOW_REMOTE: '1',
    AGENT_KERNEL_DAEMON_TOKEN: 'remote-test-token-0123456789abcdef'
  };
  try {
    runPublic(remoteEnv, 'daemon', 'start', '--host', '0.0.0.0', '--port', '0');
    const remoteStatus = JSON.parse(runPublic(remoteEnv, 'daemon', 'status', '--json'));
    if (remoteStatus.authentication !== 'bearer' || 'token' in remoteStatus) {
      throw new Error(`remote daemon status exposed invalid authentication metadata: ${JSON.stringify(remoteStatus)}`);
    }
    const remoteUrl = `http://127.0.0.1:${remoteStatus.port}/ak/health`;
    const unauthorized = await fetch(remoteUrl);
    if (unauthorized.status !== 401 || !unauthorized.headers.get('www-authenticate')?.startsWith('Bearer')) {
      throw new Error(`remote daemon accepted an unauthenticated request: ${unauthorized.status}`);
    }
    const authorized = await fetch(remoteUrl, {
      headers: { authorization: `Bearer ${remoteEnv.AGENT_KERNEL_DAEMON_TOKEN}` }
    });
    if (!authorized.ok || !(await authorized.json()).ok) throw new Error('remote daemon rejected its configured bearer token');
    if (authorized.headers.get('cache-control') !== 'no-store' || authorized.headers.get('x-content-type-options') !== 'nosniff') {
      throw new Error('remote daemon response omitted security headers');
    }
  } finally {
    try { runPublic(remoteEnv, 'daemon', 'stop'); } catch {}
  }

  const stopped = JSON.parse(runPublic(env, 'daemon', 'status', '--json'));
  if (stopped.running) throw new Error(`daemon should be stopped by default: ${JSON.stringify(stopped)}`);

  try {
    const startOut = runPublic(env, 'daemon', 'start', '--port', '0');
    assertContains(startOut, 'Started Agent Kernel daemon', 'daemon start did not report success');

    const status = JSON.parse(runPublic(env, 'daemon', 'status', '--json'));
    if (!status.running || !status.port || status.host !== '127.0.0.1') {
      throw new Error(`daemon did not report local running status: ${JSON.stringify(status)}`);
    }
    if (typeof status.uptimeMs !== 'number' || typeof status.activeSessions !== 'number' || typeof status.sessionCount !== 'number') {
      throw new Error(`daemon status did not include runtime metrics: ${JSON.stringify(status)}`);
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

    const escapedConfigPath = join(kernelHome, 'runtime', 'config.json');
    const traversal = await postJsonResponse(`${baseUrl}/ak/observe`, {
      sessionId: '../config',
      agentId: 'test-agent',
      type: 'command_failure',
      projectId: 'agent-kernel',
      cwd: repo.root,
      text: 'must not escape session storage'
    });
    if (traversal.response.status !== 400 || traversal.json.error !== 'invalid sessionId') {
      throw new Error(`daemon accepted a path-like session id: ${traversal.text}`);
    }
    if (existsSync(escapedConfigPath)) throw new Error('daemon wrote outside the sessions directory');

    const oversized = await postJsonResponse(`${baseUrl}/ak/context`, JSON.stringify({
      query: 'x'.repeat(1024 * 1024 + 1)
    }));
    if (oversized.response.status !== 413 || oversized.json.error !== 'request body too large') {
      throw new Error(`daemon did not reject an oversized request: ${oversized.text}`);
    }

    const observedStatus = JSON.parse(runPublic(env, 'daemon', 'status', '--json'));
    if (observedStatus.activeSessions !== 1 || observedStatus.sessionCount !== 1 || !observedStatus.lastObservationAt) {
      throw new Error(`daemon status did not reflect observed session: ${JSON.stringify(observedStatus)}`);
    }

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
