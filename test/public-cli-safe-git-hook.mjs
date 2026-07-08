// test/public-cli-safe-git-hook.mjs — Public `agent-kernel git-hook install` safe behavior.
//
// Invariants:
//   1. public wrapper keeps `agent-kernel git-hook install` as the user command
//   2. existing pre-commit logic is preserved
//   3. Agent Kernel block is injected with markers
//   4. repeated installs do not duplicate the block

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertContains, makeEnv, repo } from './_lib/helpers.mjs';

function runPublic(env, ...args) {
  return execFileSync(process.execPath, [join(repo.root, 'bin', 'agent-kernel.mjs'), ...args], {
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
  const project = join(homeDir, 'public-cli-git-hook-project');
  mkdirSync(project, { recursive: true });
  execFileSync('git', ['init'], { cwd: project, env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });

  const hookPath = join(project, '.git', 'hooks', 'pre-commit');
  writeFileSync(hookPath, '#!/usr/bin/env sh\necho "existing pre-commit"\n');

  const out = runPublic(env, 'git-hook', 'install', project);
  assertContains(out, 'Safe git hook installed', 'public git-hook install should use safe installer');

  const hook = readFileSync(hookPath, 'utf8');
  assertContains(hook, 'existing pre-commit', 'public git-hook install lost existing hook logic');
  assertContains(hook, '# agent-kernel:start', 'public git-hook install did not inject marker');

  runPublic(env, 'git-hook', 'install', project);
  const hookAgain = readFileSync(hookPath, 'utf8');
  if (countMarkers(hookAgain) !== 1) {
    throw new Error('public git-hook install duplicated Agent Kernel block');
  }
}

export const name = 'public-cli-safe-git-hook';
