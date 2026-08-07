// test/contextfs-security.mjs — Security regression tests for ContextFS URI and session commit boundaries.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { makeEnv, repo, runCli } from './_lib/helpers.mjs';

const routerCli = join(repo.root, 'bin', 'agent-kernel-router.mjs');

function runRouter(env, ...args) {
  return execFileSync(process.execPath, [routerCli, ...args], {
    cwd: repo.root,
    env,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
}

function runRouterFailure(env, ...args) {
  try {
    return { status: 0, stdout: runRouter(env, ...args), stderr: '' };
  } catch (error) {
    return {
      status: error.status ?? 1,
      stdout: error.stdout?.toString() ?? '',
      stderr: error.stderr?.toString() ?? ''
    };
  }
}

function directoryText(dir) {
  if (!existsSync(dir)) return '';
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => readFileSync(join(dir, name), 'utf8'))
    .join('\n');
}

function assertControlCharacterRejected(result, label) {
  const output = `${result.stdout}\n${result.stderr}`;
  if (result.status === 0 || !output.includes('Invalid ContextFS URI') || !output.includes('control characters')) {
    throw new Error(`${label} did not reject encoded control characters before lookup: ${JSON.stringify(result)}`);
  }
}

export async function run() {
  const { env, kernelHome } = makeEnv();
  runCli(env, 'init', '--sync');

  assertControlCharacterRejected(
    runRouterFailure(env, 'context', 'tree', 'ak://global/mem%0Aory/', '--json'),
    'Global ContextFS parser'
  );

  const started = JSON.parse(runRouter(env, 'session', 'start', '--agent', 'contextfs-security-test', '--project', repo.root, '--json'));
  assertControlCharacterRejected(
    runRouterFailure(env, 'context', 'used', started.id, 'ak://global/memory/bad%0Aid', '--json'),
    'Used-context parser'
  );

  const rawSecret = ['sk', 'ABCDEFGHIJKLMNOPQRSTUVWX123456'].join('-');
  const secretKey = ['OPENAI', 'API', 'KEY'].join('_');
  const sensitiveSummary = `Never persist accidental credentials. Observed ${secretKey}=${JSON.stringify(rawSecret)} while debugging.`;
  runRouter(env, 'session', 'observe', started.id, '--type', 'session_summary', '--text', sensitiveSummary, '--json');

  const dryRaw = runRouter(env, 'context', 'commit', started.id, '--dry-run', '--json');
  if (dryRaw.includes(rawSecret)) {
    throw new Error(`ContextFS commit dry-run exposed a session secret: ${dryRaw}`);
  }
  if (!dryRaw.includes('[REDACTED_SECRET]')) {
    throw new Error(`ContextFS commit dry-run did not preserve an explicit redaction marker: ${dryRaw}`);
  }

  const committedRaw = runRouter(env, 'context', 'commit', started.id, '--json');
  if (committedRaw.includes(rawSecret)) {
    throw new Error(`ContextFS commit output exposed a session secret: ${committedRaw}`);
  }

  const metadataPath = join(kernelHome, 'runtime', 'sessions', `${started.id}.context-commit.json`);
  const metadata = readFileSync(metadataPath, 'utf8');
  if (metadata.includes(rawSecret)) throw new Error('ContextFS commit metadata persisted a raw session secret');
  if (!metadata.includes('[REDACTED_SECRET]')) throw new Error('ContextFS commit metadata lost the secret redaction marker');

  const pending = directoryText(join(kernelHome, 'inbox', 'pending'));
  if (pending.includes(rawSecret)) throw new Error('ContextFS session commit copied a raw secret into the pending inbox');
  if (!pending.includes('[REDACTED_SECRET]')) throw new Error('ContextFS pending proposal did not retain a visible redaction marker');
}

export const name = 'contextfs-security';