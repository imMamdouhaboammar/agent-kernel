import { runCli, makeEnv, assertContains } from './_lib/helpers.mjs';

export async function run() {
  const { env } = makeEnv();

  // 1. Generate Playbook
  const genOut = runCli(env, 'evolve', 'generate', '--title', 'Deploy Next.js to Vercel', '--topic', 'deployment');
  assertContains(genOut, 'Generated Playbook');

  // 2. List Playbooks
  const listOut = runCli(env, 'evolve', 'list');
  assertContains(listOut, 'Deploy Next.js to Vercel');

  // 3. Install Self-Evolve Hooks
  const hooksOut = runCli(env, 'evolve', 'hooks');
  assertContains(hooksOut, 'Installed Self-Evolve Hooks');
}

export const name = 'self-evolve-engine';
