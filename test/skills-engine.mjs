import { runCli, makeEnv, assertContains, repo } from './_lib/helpers.mjs';

export async function run() {
  const { env, homeDir } = makeEnv();

  // 1. List skills
  const listOut = runCli(env, 'skills', 'list');
  assertContains(listOut, 'agent-kernel-ops');

  // 2. Inspect skill
  const inspectOut = runCli(env, 'skills', 'inspect', 'agent-kernel-ops');
  assertContains(inspectOut, 'Agent Kernel Universal Operations Guide');

  // 3. Sync skills to agent directories
  const syncOut = runCli(env, 'skills', 'sync');
  assertContains(syncOut, 'Successfully synchronized');
}

export const name = 'skills-engine';
