// test/wrapper-routing.mjs — Public `agent-kernel` wrapper routing.
//
// Invariants:
//   1. `agent-kernel link` routes to safe-link behavior.
//   2. `agent-kernel git-hook install` routes to safe git-hook behavior.
//   3. Non-routed commands delegate to the main dist CLI.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertContains, makeEnv, repo, runCli } from './_lib/helpers.mjs';

const wrapper = join(repo.root, 'bin', 'agent-kernel.mjs');

function runWrapper(env, cwd, ...args) {
  return execFileSync(process.execPath, [wrapper, ...args], {
    cwd,
    env,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
}

export async function run() {
  const { env, homeDir } = makeEnv();
  runCli(env, 'init', '--sync');

  const versionOut = runWrapper(env, repo.root, '--version');
  const cliVersion = runCli(env, '--version').trim();
  assertContains(versionOut.trim(), cliVersion, 'wrapper should delegate --version to dist CLI');

  const project = join(homeDir, 'wrapper-routing-project');
  mkdirSync(project, { recursive: true });
  writeFileSync(join(project, 'AGENTS.md'), '# Local instructions\n');
  execFileSync('git', ['init'], { cwd: project, env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });

  const linkOut = runWrapper(env, project, 'link', project);
  assertContains(linkOut, 'Safe link complete', 'agent-kernel link should route to safe-link');
  const agents = readFileSync(join(project, 'AGENTS.md'), 'utf8');
  assertContains(agents, 'Local instructions', 'wrapper-routed link should preserve local AGENTS.md');
  assertContains(agents, '<!-- agent-kernel:start -->', 'wrapper-routed link should add marked block');

  const hookOut = runWrapper(env, project, 'git-hook', 'install', project);
  assertContains(hookOut, 'Safe git hook installed', 'agent-kernel git-hook install should route to safe git hook');
  if (!existsSync(join(project, '.git', 'hooks', 'pre-commit'))) {
    throw new Error('wrapper-routed git-hook install did not create pre-commit hook');
  }
}

export const name = 'wrapper-routing';
