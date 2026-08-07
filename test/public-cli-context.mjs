// test/public-cli-context.mjs — Public context command smoke test.
//
// Invariants:
//   1. `agent-kernel context` works without daemon mode.
//   2. Approved memory is returned separately from pending proposals.
//   3. Pending proposals are marked as unapproved.
//   4. Context output respects the requested budget.
//   5. ContextFS exposes a safe canonical `ak://` virtual tree.
//   6. ContextFS supports progressive L0/L1/L2 reads without changing source stores.
//   7. ContextFS rejects traversal and foreign URI schemes before lookup.
//   8. ContextFS find is hierarchy-aware, project/file-aware, budgeted, and explainable.
//   9. Used ContextFS records are captured as append-only session evidence.

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertContains, makeEnv, repo, runCli } from './_lib/helpers.mjs';

const publicCli = join(repo.root, 'bin', 'agent-kernel.mjs');
const routerCli = join(repo.root, 'bin', 'agent-kernel-router.mjs');

function runPublic(env, ...args) {
  return execFileSync(process.execPath, [publicCli, ...args], {
    cwd: repo.root,
    env,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
}

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
    const stdout = runRouter(env, ...args);
    return { stdout, stderr: '', status: 0 };
  } catch (error) {
    return {
      stdout: error.stdout?.toString() ?? '',
      stderr: error.stderr?.toString() ?? '',
      status: error.status ?? 1
    };
  }
}

function assertCollection(tree, name) {
  if (!Array.isArray(tree.entries) || !tree.entries.some((entry) => entry.name === name && entry.kind === 'directory')) {
    throw new Error(`ContextFS tree missing ${name}: ${JSON.stringify(tree)}`);
  }
}

export async function run() {
  const { env, kernelHome } = makeEnv();
  runCli(env, 'init', '--sync');

  const approved = JSON.parse(runPublic(env, 'context', '--query', 'Memory changes', '--budget', '300', '--json'));
  if (!Array.isArray(approved.sections.approvedRules) || approved.sections.approvedRules.length === 0) {
    throw new Error(`context did not return approved memory: ${JSON.stringify(approved)}`);
  }
  if (approved.context.length > 300) throw new Error(`context exceeded budget: ${approved.context.length}`);

  const marker = `Context helper pending marker ${Date.now()}`;
  runCli(env, 'propose', '--from', 'test-agent', '--type', 'rule', '--text', marker, '--reason', 'context smoke');

  const pending = JSON.parse(runPublic(env, 'context', '--query', marker, '--json'));
  if (!Array.isArray(pending.sections.pendingProposals) || pending.sections.pendingProposals.length !== 1) {
    throw new Error(`context did not return matching pending proposal: ${JSON.stringify(pending)}`);
  }
  if (pending.sections.pendingProposals[0].approved !== false || pending.sections.pendingProposals[0].status !== 'pending') {
    throw new Error(`pending proposal was not marked unapproved: ${JSON.stringify(pending.sections.pendingProposals[0])}`);
  }
  assertContains(pending.context, '[PENDING, UNAPPROVED]', 'context did not mark pending proposal as unapproved');

  const root = JSON.parse(runRouter(env, 'context', 'tree', 'ak://', '--json'));
  if (root.uri !== 'ak://') throw new Error(`ContextFS root was not canonical: ${JSON.stringify(root)}`);
  for (const name of ['projects', 'global', 'agents', 'skills', 'policies']) assertCollection(root, name);

  const globalTree = JSON.parse(runRouter(env, 'context', 'tree', 'ak://global/', '--depth', '2', '--json'));
  if (globalTree.uri !== 'ak://global/') throw new Error(`ContextFS global URI was not canonical: ${JSON.stringify(globalTree)}`);
  assertCollection(globalTree, 'memory');
  assertCollection(globalTree, 'failures');
  assertCollection(globalTree, 'episodes');
  assertCollection(globalTree, 'sessions');

  const memoryTree = JSON.parse(runRouter(env, 'context', 'tree', 'ak://global/memory/', '--json'));
  const readable = memoryTree.entries?.find((entry) => entry.kind === 'record');
  if (!readable?.uri?.startsWith('ak://global/memory/')) {
    throw new Error(`ContextFS did not expose a readable global memory record: ${JSON.stringify(memoryTree)}`);
  }

  const l0 = JSON.parse(runRouter(env, 'context', 'read', readable.uri, '--level', '0', '--json'));
  if (l0.level !== 0 || typeof l0.abstract !== 'string' || !l0.abstract.trim()) {
    throw new Error(`ContextFS L0 read contract failed: ${JSON.stringify(l0)}`);
  }
  if ('details' in l0) throw new Error(`ContextFS L0 unexpectedly included L2 details: ${JSON.stringify(l0)}`);

  const l1 = JSON.parse(runRouter(env, 'context', 'read', readable.uri, '--level', '1', '--json'));
  if (l1.level !== 1 || typeof l1.overview !== 'object' || l1.overview === null) {
    throw new Error(`ContextFS L1 read contract failed: ${JSON.stringify(l1)}`);
  }
  if ('details' in l1) throw new Error(`ContextFS L1 unexpectedly included L2 details: ${JSON.stringify(l1)}`);

  const l2 = JSON.parse(runRouter(env, 'context', 'read', readable.uri, '--level', '2', '--json'));
  if (l2.level !== 2 || typeof l2.details !== 'object' || l2.details === null) {
    throw new Error(`ContextFS L2 read contract failed: ${JSON.stringify(l2)}`);
  }

  for (const unsafe of [
    'ak://global/../source/',
    'ak://global/%2e%2e/source/',
    'ak://global/%2E%2E/source/',
    'ak://global/memory\\escape/',
    'file:///tmp/agent-kernel',
    'https://example.com/context'
  ]) {
    const rejected = runRouterFailure(env, 'context', 'tree', unsafe, '--json');
    if (rejected.status === 0) throw new Error(`ContextFS accepted unsafe URI ${unsafe}: ${rejected.stdout}`);
    assertContains(`${rejected.stdout}\n${rejected.stderr}`, 'Invalid ContextFS URI', `ContextFS rejection was not actionable for ${unsafe}`);
  }

  const failureDir = join(kernelHome, 'source', 'failures');
  mkdirSync(failureDir, { recursive: true });
  writeFileSync(join(failureDir, 'failure-lessons.json'), JSON.stringify([
    {
      id: 'contextfs-file-locality',
      type: 'failure',
      status: 'approved',
      projectId: 'contextfs-project',
      title: 'ContextFS file locality marker',
      rootCause: 'A context lookup ignored the file being edited.',
      fix: 'Prefer records tied to the requested file before unrelated records.',
      files: ['src/contextfs-demo.mjs'],
      commands: ['npm test'],
      tags: ['contextfs', 'retrieval'],
      occurrences: 3,
      updatedAt: '2026-08-07T06:00:00.000Z'
    },
    {
      id: 'contextfs-unrelated',
      type: 'failure',
      status: 'approved',
      projectId: 'other-project',
      title: 'ContextFS file locality marker unrelated copy',
      rootCause: 'Different project and different file.',
      files: ['src/unrelated.mjs'],
      updatedAt: '2026-08-07T06:00:00.000Z'
    }
  ], null, 2) + '\n');

  const found = JSON.parse(runRouter(
    env,
    'context', 'find', 'ContextFS file locality marker',
    '--under', 'ak://global/',
    '--project-id', 'contextfs-project',
    '--file', 'src/contextfs-demo.mjs',
    '--budget', '900',
    '--limit', '4',
    '--trace',
    '--json'
  ));
  if (found.query !== 'ContextFS file locality marker' || found.under !== 'ak://global/') {
    throw new Error(`ContextFS find did not preserve query/scope: ${JSON.stringify(found)}`);
  }
  if (!Array.isArray(found.results) || found.results.length === 0) {
    throw new Error(`ContextFS find returned no results: ${JSON.stringify(found)}`);
  }
  if (found.results[0].uri !== 'ak://global/failures/contextfs-file-locality') {
    throw new Error(`ContextFS file/project locality did not rank the expected record first: ${JSON.stringify(found.results)}`);
  }
  if (found.results.some((result) => !result.uri.startsWith('ak://global/'))) {
    throw new Error(`ContextFS find escaped requested hierarchy: ${JSON.stringify(found.results)}`);
  }
  if (found.results.some((result) => 'details' in result)) {
    throw new Error(`ContextFS find loaded L2 details without opt-in: ${JSON.stringify(found.results)}`);
  }
  if (found.results[0].level !== 1 || typeof found.results[0].overview !== 'object') {
    throw new Error(`ContextFS did not promote strongest result to L1: ${JSON.stringify(found.results[0])}`);
  }
  if (Number(found.budgetUsed) > 900) throw new Error(`ContextFS find exceeded budget: ${JSON.stringify(found)}`);
  if (!Array.isArray(found.trace) || !found.trace.some((step) => step.stage === 'collection' && step.collection === 'failures')) {
    throw new Error(`ContextFS trace did not expose collection descent: ${JSON.stringify(found.trace)}`);
  }
  if (!found.trace.some((step) => step.stage === 'candidate' && step.uri === 'ak://global/failures/contextfs-file-locality' && step.decision === 'include')) {
    throw new Error(`ContextFS trace did not expose candidate inclusion: ${JSON.stringify(found.trace)}`);
  }

  const started = JSON.parse(runRouter(env, 'session', 'start', '--agent', 'contextfs-test-agent', '--project', repo.root, '--json'));
  const used = JSON.parse(runRouter(
    env,
    'context', 'used', started.id, readable.uri,
    '--reason', 'pre-edit context check',
    '--result', 'helpful',
    '--json'
  ));
  if (used.observation?.type !== 'context_used' || used.observation?.contextUri !== readable.uri) {
    throw new Error(`ContextFS used-context observation was invalid: ${JSON.stringify(used)}`);
  }
  if (used.observation?.metadata?.reason !== 'pre-edit context check' || used.observation?.metadata?.result !== 'helpful') {
    throw new Error(`ContextFS used-context metadata was invalid: ${JSON.stringify(used)}`);
  }
  const shown = JSON.parse(runRouter(env, 'session', 'show', started.id, '--json'));
  const captured = shown.observations.find((observation) => observation.type === 'context_used' && observation.contextUri === readable.uri);
  if (!captured) throw new Error(`Session did not retain ContextFS usage evidence: ${JSON.stringify(shown)}`);
  if (shown.session.observationCount !== shown.observations.length || shown.session.observationCount < 1) {
    throw new Error(`ContextFS usage did not update session observation count: ${JSON.stringify(shown.session)}`);
  }

  const badSession = runRouterFailure(env, 'context', 'used', '../config', readable.uri, '--json');
  if (badSession.status === 0 || !`${badSession.stdout}\n${badSession.stderr}`.includes('Invalid session ID')) {
    throw new Error(`ContextFS used accepted unsafe session id: ${JSON.stringify(badSession)}`);
  }
}

export const name = 'public-cli-context';
