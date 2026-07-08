// test/safe-git-hook.mjs — Safe pre-commit hook installer companion binary.
//
// Invariants:
//   1. `agent-kernel-safe-git-hook --dry-run` prints planned actions without writing.
//   2. Existing pre-commit hook logic is preserved.
//   3. Existing pre-commit hooks get backups before write.
//   4. Re-running the installer replaces the marked block instead of duplicating it.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertContains, makeEnv, repo } from './_lib/helpers.mjs';

function runSafeGitHook(env, ...args) {
  return execFileSync(process.execPath, [join(repo.root, 'bin', 'agent-kernel-safe-git-hook.mjs'), ...args], {
    cwd: repo.root,
    env,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
}

function countMarkers(text) {
  return (text.match(/# agent-kernel:start/g) || []).length;
}

export async function run() {
  const { env, homeDir } = makeEnv();
  const project = join(homeDir, 'project-with-existing-hook');
  mkdirSync(project, { recursive: true });
  execFileSync('git', ['init'], { cwd: project, env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });

  const hookPath = join(project, '.git', 'hooks', 'pre-commit');
  writeFileSync(hookPath, '#!/usr/bin/env sh\necho "existing hook still runs"\n');

  const dryRunOut = runSafeGitHook(env, project, '--dry-run');
  assertContains(dryRunOut, 'dry run', 'safe git-hook dry run should identify itself');
  assertContains(dryRunOut, 'append-marked-block', 'safe git-hook dry run should plan an append for an existing hook');

  const before = readFileSync(hookPath, 'utf8');
  if (before.includes('agent-kernel guard --staged')) {
    throw new Error('dry-run wrote to pre-commit hook');
  }

  const installOut = runSafeGitHook(env, project);
  assertContains(installOut, 'Safe git hook installed', 'safe git-hook did not report completion');

  const after = readFileSync(hookPath, 'utf8');
  assertContains(after, 'existing hook still runs', 'safe git-hook lost existing hook logic');
  assertContains(after, '# agent-kernel:start', 'safe git-hook did not inject start marker');
  assertContains(after, 'agent-kernel guard --staged', 'safe git-hook did not inject guard command');

  const backupsDir = join(project, '.agent-kernel-backups');
  if (!existsSync(backupsDir) || readdirSync(backupsDir).length === 0) {
    throw new Error('safe git-hook did not create a backup for existing pre-commit hook');
  }

  runSafeGitHook(env, project);
  const afterSecondRun = readFileSync(hookPath, 'utf8');
  if (countMarkers(afterSecondRun) !== 1) {
    throw new Error('safe git-hook duplicated the marked block on a second run');
  }
}

export const name = 'safe-git-hook';
