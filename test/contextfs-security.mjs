// test/contextfs-security.mjs — Security regression tests for ContextFS URI and session commit boundaries.

import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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

function assertSecretUriRejected(result, label) {
  const output = `${result.stdout}\n${result.stderr}`;
  if (result.status === 0 || !output.includes('Invalid ContextFS URI') || !output.toLowerCase().includes('secret')) {
    throw new Error(`${label} did not reject a secret-bearing ContextFS URI: ${JSON.stringify(result)}`);
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

  const secretTail = 'abcdefghijklmnopqrstuvwxyz1234567890';
  const directSecretUri = `ak://global/memory/${['sk', 'proj', secretTail].join('-')}`;
  const encodedSecretUri = `ak://global/memory/%73k-proj-${secretTail}`;
  assertSecretUriRejected(
    runRouterFailure(env, 'context', 'used', started.id, directSecretUri, '--json'),
    'Used-context direct secret parser'
  );
  assertSecretUriRejected(
    runRouterFailure(env, 'context', 'used', started.id, encodedSecretUri, '--json'),
    'Used-context encoded secret parser'
  );
  const afterSecretUriRejections = JSON.parse(runRouter(env, 'session', 'show', started.id, '--json'));
  if (afterSecretUriRejections.session.observationCount !== 0 || afterSecretUriRejections.observations.length !== 0) {
    throw new Error(`Rejected secret-bearing ContextFS URIs still wrote session evidence: ${JSON.stringify(afterSecretUriRejections)}`);
  }

  if (process.platform !== 'win32') {
    const atomicSession = JSON.parse(runRouter(env, 'session', 'start', '--agent', 'contextfs-atomic-test', '--project', repo.root, '--json'));
    const atomicRecord = join(kernelHome, 'runtime', 'sessions', `${atomicSession.id}.json`);
    chmodSync(atomicRecord, 0o400);
    const atomicUsed = JSON.parse(runRouter(
      env,
      'context', 'used', atomicSession.id, 'ak://global/memory/memory-model',
      '--reason', 'atomic replacement regression',
      '--result', 'helpful',
      '--json'
    ));
    if (atomicUsed.session.observationCount !== 1 || atomicUsed.observation.type !== 'context_used') {
      throw new Error(`ContextFS used did not atomically replace a read-only session record: ${JSON.stringify(atomicUsed)}`);
    }
  }

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

  const pendingMemoryText = 'Pending source memory must not suppress a review-first ContextFS proposal candidate.';
  const memoriesDir = join(kernelHome, 'source', 'memories');
  mkdirSync(memoriesDir, { recursive: true });
  writeFileSync(join(memoriesDir, 'contextfs-pending-source.json'), JSON.stringify([
    {
      id: 'contextfs-pending-source',
      type: 'project-note',
      scope: 'project',
      level: 'standard',
      status: 'pending',
      text: pendingMemoryText,
      createdAt: '2026-08-07T07:00:00.000Z'
    }
  ], null, 2) + '\n');
  const dedupSession = JSON.parse(runRouter(env, 'session', 'start', '--agent', 'contextfs-dedup-test', '--project', repo.root, '--json'));
  runRouter(env, 'session', 'observe', dedupSession.id, '--type', 'session_summary', '--text', pendingMemoryText, '--json');
  const dedupDryRun = JSON.parse(runRouter(env, 'context', 'commit', dedupSession.id, '--dry-run', '--json'));
  if (!dedupDryRun.diff?.adds?.some((candidate) => candidate.text === pendingMemoryText)) {
    throw new Error(`Non-approved source memory incorrectly suppressed a ContextFS proposal candidate: ${JSON.stringify(dedupDryRun)}`);
  }

  const retryLesson = 'Interrupted ContextFS commit retries must recover an already-created matching pending proposal.';
  const retrySession = JSON.parse(runRouter(env, 'session', 'start', '--agent', 'contextfs-retry-test', '--project', repo.root, '--json'));
  runRouter(env, 'session', 'observe', retrySession.id, '--type', 'session_summary', '--text', retryLesson, '--json');
  const priorProposalOutput = runCli(
    env,
    'propose',
    '--from', 'contextfs-session-commit',
    '--type', 'project-note',
    '--scope', 'project',
    '--level', 'standard',
    '--targets', 'all',
    '--tags', 'contextfs,session-commit',
    '--text', retryLesson,
    '--reason', `Candidate extracted from session ${retrySession.id}; requires explicit review before publication.`
  );
  const priorProposalId = priorProposalOutput.match(/Created pending memory proposal:\s*(\S+)/u)?.[1];
  if (!priorProposalId) throw new Error(`Could not seed interrupted ContextFS proposal state: ${priorProposalOutput}`);
  const recoveredCommit = JSON.parse(runRouter(env, 'context', 'commit', retrySession.id, '--json'));
  if (!recoveredCommit.proposals?.some((proposal) => proposal.id === priorProposalId && proposal.status === 'pending')) {
    throw new Error(`ContextFS commit retry lost an already-created pending proposal: ${JSON.stringify(recoveredCommit)}`);
  }

  const lockSession = JSON.parse(runRouter(env, 'session', 'start', '--agent', 'contextfs-lock-test', '--project', repo.root, '--json'));
  runRouter(env, 'session', 'observe', lockSession.id, '--type', 'session_summary', '--text', 'Concurrent ContextFS commits must be serialized per session.', '--json');
  const lockPath = join(kernelHome, 'runtime', 'sessions', `${lockSession.id}.context-commit.lock`);
  writeFileSync(lockPath, JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }) + '\n');
  const locked = runRouterFailure(env, 'context', 'commit', lockSession.id, '--json');
  if (locked.status === 0 || !`${locked.stdout}\n${locked.stderr}`.toLowerCase().includes('already in progress')) {
    throw new Error(`ContextFS commit ignored an active per-session lock: ${JSON.stringify(locked)}`);
  }
  rmSync(lockPath, { force: true });
  const afterLock = JSON.parse(runRouter(env, 'context', 'commit', lockSession.id, '--json'));
  if (afterLock.sessionId !== lockSession.id || afterLock.proposals?.length !== 1) {
    throw new Error(`ContextFS commit did not recover after lock release: ${JSON.stringify(afterLock)}`);
  }
}

export const name = 'contextfs-security';
