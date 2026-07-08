// test/safe-link.mjs — Safe project linking companion binary.
//
// Invariants:
//   1. `agent-kernel-safe-link --dry-run` prints planned actions without writing.
//   2. Existing project files are preserved outside the Agent Kernel marked block.
//   3. Existing project files get backups before write.
//   4. Re-running safe-link replaces the marked block instead of duplicating it.
//   5. Existing duplicate Agent Kernel blocks are collapsed to one block.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertContains, makeEnv, repo, runCli } from './_lib/helpers.mjs';

function runSafeLink(env, ...args) {
  return execFileSync(process.execPath, [join(repo.root, 'bin', 'agent-kernel-safe-link.mjs'), ...args], {
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

  const project = join(homeDir, 'project-with-existing-instructions');
  mkdirSync(project, { recursive: true });
  const agentsPath = join(project, 'AGENTS.md');
  writeFileSync(agentsPath, '# Existing project instructions\n\nKeep this local rule.\n');

  const dryRunOut = runSafeLink(env, project, '--dry-run');
  assertContains(dryRunOut, 'dry run', 'safe-link dry run should identify itself');
  assertContains(dryRunOut, 'append-marked-block: AGENTS.md', 'safe-link dry run should plan an append for existing AGENTS.md');

  const before = readFileSync(agentsPath, 'utf8');
  if (before.includes('Agent Kernel Constitution')) {
    throw new Error('dry-run wrote to AGENTS.md');
  }

  const linkOut = runSafeLink(env, project);
  assertContains(linkOut, 'Safe link complete', 'safe-link did not report completion');

  const after = readFileSync(agentsPath, 'utf8');
  assertContains(after, 'Keep this local rule.', 'safe-link lost existing AGENTS.md content');
  assertContains(after, '<!-- agent-kernel:start -->', 'safe-link did not inject start marker');
  assertContains(after, 'Agent Kernel Constitution', 'safe-link did not inject generated constitution');

  const backupsDir = join(project, '.agent-kernel-backups');
  if (!existsSync(backupsDir) || readdirSync(backupsDir).length === 0) {
    throw new Error('safe-link did not create a backup for existing AGENTS.md');
  }

  runSafeLink(env, project);
  const afterSecondRun = readFileSync(agentsPath, 'utf8');
  if (countMarkers(afterSecondRun) !== 1) {
    throw new Error('safe-link duplicated the marked block on a second run');
  }

  writeFileSync(agentsPath, `${afterSecondRun}\n<!-- agent-kernel:start -->\nstale duplicate block\n<!-- agent-kernel:end -->\n`);
  runSafeLink(env, project);
  const afterDuplicateRepair = readFileSync(agentsPath, 'utf8');
  if (countMarkers(afterDuplicateRepair) !== 1) {
    throw new Error('safe-link did not collapse pre-existing duplicate marked blocks');
  }
  if (afterDuplicateRepair.includes('stale duplicate block')) {
    throw new Error('safe-link did not remove stale duplicate marked block content');
  }
}

export const name = 'safe-link';
