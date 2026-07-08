// test/agent-propose.mjs — Generic agent proposal helper.
//
// Invariants:
//   1. Any coding agent can create a pending proposal through a small native helper.
//   2. The helper writes to the normal proposal inbox path through the main CLI.
//   3. The helper can read proposal text from stdin.

import { execFileSync } from 'node:child_process';
import { assertContains, makeEnv, repo, runCli } from './_lib/helpers.mjs';

function runAgentPropose(env, input, ...args) {
  return execFileSync(process.execPath, [`${repo.root}/bin/agent-kernel-agent-propose.mjs`, ...args], {
    cwd: repo.root,
    env: { ...env, AGENT_KERNEL_CLI: repo.cli },
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
}

export async function run() {
  const { env } = makeEnv();
  runCli(env, 'init', '--sync');

  const text = `Always preserve the user's existing project instructions. [${Date.now()}]`;
  const out = runAgentPropose(
    env,
    text,
    '--from', 'opencode',
    '--reason', 'User wants shared memory across agents.',
    '--tags', 'shared-memory,agent-hook'
  );

  assertContains(out, 'Created pending memory proposal', 'agent proposal helper did not create a pending proposal');

  const inboxOut = runCli(env, 'inbox');
  assertContains(inboxOut, text, 'agent proposal helper did not write to the normal inbox');
  assertContains(inboxOut, 'opencode', 'agent proposal helper did not preserve the agent name');
}

export const name = 'agent-propose';
