// test/public-cli-context.mjs — Public context command smoke test.
//
// Invariants:
//   1. `agent-kernel context` works without daemon mode.
//   2. Approved memory is returned separately from pending proposals.
//   3. Pending proposals are marked as unapproved.
//   4. Context output respects the requested budget.

import { execFileSync } from 'node:child_process';
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
}

export const name = 'public-cli-context';
