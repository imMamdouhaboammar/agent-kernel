// test/safe-link.mjs — Safe project linking companion binary.
//
// Invariants:
//   1. `agent-kernel-safe-link --dry-run` prints planned actions without writing.
//   2. Existing project files are preserved outside the Agent Kernel marked block.
//   3. Existing project files get backups before write.
//   4. Re-running safe-link replaces the marked block instead of duplicating it.
//   5. Existing duplicate Agent Kernel blocks are collapsed to one block.
//   6. Claude guidance is linked safely through CLAUDE.md.
//   7. Unknown or duplicate options and ambiguous project paths fail without writes.
//   8. Corrupt marker layouts fail closed unless explicit `--force` repair is used.

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

function runSafeLinkFailure(env, ...args) {
  try {
    runSafeLink(env, ...args);
    return { status: 0, stdout: '', stderr: '' };
  } catch (error) {
    return {
      status: error.status ?? 1,
      stdout: String(error.stdout || ''),
      stderr: String(error.stderr || '')
    };
  }
}

function assertFailure(result, message) {
  if (result.status === 0) throw new Error(message);
}

function countMarkers(text) {
  return (text.match(/<!-- agent-kernel:start -->/g) || []).length;
}

export async function run() {
  const { env, homeDir } = makeEnv();
  runCli(env, 'init', '--sync');

  const unknownOption = runSafeLinkFailure(env, '--unknown-option');
  assertFailure(unknownOption, 'safe-link accepted an unknown option');
  assertContains(unknownOption.stderr, 'Unknown option: --unknown-option', 'unknown option error was not actionable');
  if (unknownOption.stderr.includes(' at ')) throw new Error('unknown option printed a stack trace');

  const duplicateOption = runSafeLinkFailure(env, '--dry-run', '--dry-run');
  assertFailure(duplicateOption, 'safe-link accepted a duplicate option');
  assertContains(duplicateOption.stderr, 'Duplicate option: --dry-run', 'duplicate option error was not actionable');

  const ambiguousProject = runSafeLinkFailure(env, homeDir, join(homeDir, 'second-project'));
  assertFailure(ambiguousProject, 'safe-link accepted multiple project paths');
  assertContains(ambiguousProject.stderr, 'Expected at most one project path', 'multiple project path error was not actionable');

  const missingProject = join(homeDir, 'missing-project');
  const missingResult = runSafeLinkFailure(env, missingProject);
  assertFailure(missingResult, 'safe-link created or accepted a missing project path');
  assertContains(missingResult.stderr, 'Project path not found', 'missing project error was not actionable');
  if (existsSync(missingProject)) throw new Error('safe-link created a missing project directory before failing');

  const fileProject = join(homeDir, 'project-file.txt');
  writeFileSync(fileProject, 'not a directory');
  const fileResult = runSafeLinkFailure(env, fileProject);
  assertFailure(fileResult, 'safe-link accepted a regular file as a project path');
  assertContains(fileResult.stderr, 'Project path is not a directory', 'file project error was not actionable');

  const project = join(homeDir, 'project-with-existing-instructions');
  mkdirSync(project, { recursive: true });
  const agentsPath = join(project, 'AGENTS.md');
  const claudePath = join(project, 'CLAUDE.md');
  writeFileSync(agentsPath, '# Existing project instructions\n\nKeep this local rule.\n');
  writeFileSync(claudePath, '# Existing Claude instructions\n\nKeep this Claude rule.\n');

  const dryRunOut = runSafeLink(env, project, '--dry-run');
  assertContains(dryRunOut, 'dry run', 'safe-link dry run should identify itself');
  assertContains(dryRunOut, 'append-marked-block: AGENTS.md', 'safe-link dry run should plan an append for existing AGENTS.md');
  assertContains(dryRunOut, 'append-marked-block: CLAUDE.md', 'safe-link dry run should plan an append for existing CLAUDE.md');

  const before = readFileSync(agentsPath, 'utf8');
  const claudeBefore = readFileSync(claudePath, 'utf8');
  if (before.includes('Agent Kernel Constitution')) {
    throw new Error('dry-run wrote to AGENTS.md');
  }
  if (claudeBefore.includes('Agent Kernel Constitution')) {
    throw new Error('dry-run wrote to CLAUDE.md');
  }

  const linkOut = runSafeLink(env, project);
  assertContains(linkOut, 'Safe link complete', 'safe-link did not report completion');

  const after = readFileSync(agentsPath, 'utf8');
  assertContains(after, 'Keep this local rule.', 'safe-link lost existing AGENTS.md content');
  assertContains(after, '<!-- agent-kernel:start -->', 'safe-link did not inject start marker');
  assertContains(after, 'Agent Kernel Constitution', 'safe-link did not inject generated constitution');

  const claudeAfter = readFileSync(claudePath, 'utf8');
  assertContains(claudeAfter, 'Keep this Claude rule.', 'safe-link lost existing CLAUDE.md content');
  assertContains(claudeAfter, '<!-- agent-kernel:start -->', 'safe-link did not inject Claude start marker');
  assertContains(claudeAfter, 'Agent Kernel Constitution', 'safe-link did not inject generated Claude guidance');

  const backupsDir = join(project, '.agent-kernel-backups');
  if (!existsSync(backupsDir) || readdirSync(backupsDir).length === 0) {
    throw new Error('safe-link did not create a backup for existing guidance files');
  }

  runSafeLink(env, project);
  const afterSecondRun = readFileSync(agentsPath, 'utf8');
  const claudeAfterSecondRun = readFileSync(claudePath, 'utf8');
  if (countMarkers(afterSecondRun) !== 1) {
    throw new Error('safe-link duplicated the marked block on a second run');
  }
  if (countMarkers(claudeAfterSecondRun) !== 1) {
    throw new Error('safe-link duplicated the Claude marked block on a second run');
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

  const corruptText = '# Hand-written instructions\n\nKeep this line.\n\n<!-- agent-kernel:start -->\nstale unclosed generated text\n';
  writeFileSync(agentsPath, corruptText);
  const corruptResult = runSafeLinkFailure(env, project);
  assertFailure(corruptResult, 'safe-link accepted corrupt markers without --force');
  assertContains(corruptResult.stderr, 'Corrupt Agent Kernel markers in AGENTS.md', 'corrupt marker error was not actionable');
  if (readFileSync(agentsPath, 'utf8') !== corruptText) throw new Error('safe-link changed a corrupt file before explicit force repair');

  const forcePreview = runSafeLink(env, project, '--force', '--dry-run');
  assertContains(forcePreview, 'repair-corrupt-markers: AGENTS.md', 'force dry-run did not report marker repair');
  if (readFileSync(agentsPath, 'utf8') !== corruptText) throw new Error('force dry-run changed a corrupt file');

  runSafeLink(env, project, '--force');
  const repairedCorrupt = readFileSync(agentsPath, 'utf8');
  assertContains(repairedCorrupt, 'Keep this line.', 'force repair lost hand-written content');
  assertContains(repairedCorrupt, 'stale unclosed generated text', 'force repair removed non-marker text without review');
  if (countMarkers(repairedCorrupt) !== 1) throw new Error('force repair did not rebuild exactly one managed block');
}

export const name = 'safe-link';
