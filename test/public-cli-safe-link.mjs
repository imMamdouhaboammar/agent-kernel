// test/public-cli-safe-link.mjs — Public `agent-kernel link` safe behavior.
//
// Invariants:
//   1. public wrapper keeps `agent-kernel link` as the user command
//   2. existing AGENTS.md content is preserved
//   3. generated Agent Kernel content is injected inside markers
//   4. repeated link runs do not duplicate marked blocks
//   5. public link repairs pre-existing duplicate marked blocks

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertContains, makeEnv, repo, runCli } from './_lib/helpers.mjs';

function runPublic(env, ...args) {
  return execFileSync(process.execPath, [join(repo.root, 'bin', 'agent-kernel.mjs'), ...args], {
    cwd: repo.root,
    env,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
}

function countMarkers(text) {
  return (text.match(/<!-- agent-kernel:start -->/g) || []).length;
}

export async function run() {
  const { env, homeDir } = makeEnv();
  runCli(env, 'init', '--sync');

  const project = join(homeDir, 'public-cli-link-project');
  mkdirSync(project, { recursive: true });
  const agentsPath = join(project, 'AGENTS.md');
  writeFileSync(agentsPath, '# Local instructions\n\nDo not delete this.\n');

  const out = runPublic(env, 'link', project);
  assertContains(out, 'Safe link complete', 'public agent-kernel link should use safe-link behavior');

  const linked = readFileSync(agentsPath, 'utf8');
  assertContains(linked, 'Do not delete this.', 'public link lost existing AGENTS.md content');
  assertContains(linked, '<!-- agent-kernel:start -->', 'public link did not inject Agent Kernel marker');

  runPublic(env, 'link', project);
  const linkedAgain = readFileSync(agentsPath, 'utf8');
  if (countMarkers(linkedAgain) !== 1) {
    throw new Error('public agent-kernel link duplicated Agent Kernel block');
  }

  writeFileSync(agentsPath, `${linkedAgain}\n<!-- agent-kernel:start -->\nstale duplicate block\n<!-- agent-kernel:end -->\n`);
  runPublic(env, 'link', project);
  const repaired = readFileSync(agentsPath, 'utf8');
  if (countMarkers(repaired) !== 1) {
    throw new Error('public agent-kernel link did not collapse duplicate Agent Kernel blocks');
  }
  if (repaired.includes('stale duplicate block')) {
    throw new Error('public agent-kernel link did not remove stale duplicate block content');
  }
}

export const name = 'public-cli-safe-link';
