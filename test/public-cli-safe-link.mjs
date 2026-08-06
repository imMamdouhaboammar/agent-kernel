// test/public-cli-safe-link.mjs — Public `agent-kernel link` safe behavior.
//
// Invariants:
//   1. public wrapper keeps `agent-kernel link` as the user command
//   2. existing AGENTS.md content is preserved
//   3. existing CLAUDE.md content is preserved
//   4. generated Agent Kernel content is injected inside markers
//   5. repeated link runs do not duplicate marked blocks
//   6. public link repairs pre-existing duplicate marked blocks
//   7. `agent-kernel link --dry-run --hooks` writes no project files and no git hook
//   8. the published router resolves the positional project path when flags appear first

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

function runRoutedPublic(env, ...args) {
  return execFileSync(process.execPath, [join(repo.root, 'bin', 'agent-kernel-router.mjs'), ...args], {
    cwd: repo.root,
    env,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
}

function countMarkers(text) {
  return (text.match(/<!-- agent-kernel:start -->/g) || []).length;
}

function assertRoutedFlagsBeforeProject() {
  const { env, homeDir, kernelHome } = makeEnv();
  runCli(env, 'init', '--sync');
  mkdirSync(join(kernelHome, 'runtime'), { recursive: true });
  writeFileSync(
    join(kernelHome, 'runtime', 'update-status.json'),
    JSON.stringify({
      updateAvailable: true,
      currentVersion: '1.19.0',
      targetVersion: '9.9.9',
      channel: 'latest'
    })
  );

  const project = join(homeDir, 'routed-link-flags-first-project');
  mkdirSync(project, { recursive: true });
  execFileSync('git', ['init'], { cwd: project, env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  const agentsPath = join(project, 'AGENTS.md');
  writeFileSync(agentsPath, '# Existing project guidance\n');

  runRoutedPublic(env, 'link', '--dry-run', project);
  const guidance = readFileSync(agentsPath, 'utf8');
  assertContains(
    guidance,
    '<!-- agent-kernel-update:start -->',
    'link flags before the project path should refresh guidance in that project'
  );
  assertContains(
    guidance,
    '- Available: 9.9.9',
    'project update guidance should use the cached target version'
  );
}

export async function run() {
  assertRoutedFlagsBeforeProject();

  const { env, homeDir } = makeEnv();
  runCli(env, 'init', '--sync');

  const dryRunProject = join(homeDir, 'public-cli-link-dry-run-project');
  mkdirSync(dryRunProject, { recursive: true });
  execFileSync('git', ['init'], { cwd: dryRunProject, env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  const dryRunOut = runPublic(env, 'link', dryRunProject, '--dry-run', '--hooks');
  assertContains(dryRunOut, 'dry run', 'public link dry-run should identify itself');
  if (existsSync(join(dryRunProject, 'AGENTS.md'))) {
    throw new Error('public link --dry-run wrote AGENTS.md');
  }
  if (existsSync(join(dryRunProject, '.git', 'hooks', 'pre-commit'))) {
    const hookText = readFileSync(join(dryRunProject, '.git', 'hooks', 'pre-commit'), 'utf8');
    if (hookText.includes('agent-kernel guard')) {
      throw new Error('public link --dry-run --hooks installed Agent Kernel pre-commit hook');
    }
  }

  const project = join(homeDir, 'public-cli-link-project');
  mkdirSync(project, { recursive: true });
  const agentsPath = join(project, 'AGENTS.md');
  const claudePath = join(project, 'CLAUDE.md');
  writeFileSync(agentsPath, '# Local instructions\n\nDo not delete this.\n');
  writeFileSync(claudePath, '# Local Claude instructions\n\nDo not delete this Claude rule.\n');

  const out = runPublic(env, 'link', project);
  assertContains(out, 'Safe link complete', 'public agent-kernel link should use safe-link behavior');

  const linked = readFileSync(agentsPath, 'utf8');
  assertContains(linked, 'Do not delete this.', 'public link lost existing AGENTS.md content');
  assertContains(linked, '<!-- agent-kernel:start -->', 'public link did not inject Agent Kernel marker');

  const linkedClaude = readFileSync(claudePath, 'utf8');
  assertContains(linkedClaude, 'Do not delete this Claude rule.', 'public link lost existing CLAUDE.md content');
  assertContains(linkedClaude, '<!-- agent-kernel:start -->', 'public link did not inject Claude Agent Kernel marker');

  runPublic(env, 'link', project);
  const linkedAgain = readFileSync(agentsPath, 'utf8');
  const linkedClaudeAgain = readFileSync(claudePath, 'utf8');
  if (countMarkers(linkedAgain) !== 1) {
    throw new Error('public agent-kernel link duplicated Agent Kernel block');
  }
  if (countMarkers(linkedClaudeAgain) !== 1) {
    throw new Error('public agent-kernel link duplicated Claude Agent Kernel block');
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
