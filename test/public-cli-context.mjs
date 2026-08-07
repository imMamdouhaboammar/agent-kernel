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

import { execFileSync } from 'node:child_process';
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
  const { env } = makeEnv();
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
}

export const name = 'public-cli-context';
