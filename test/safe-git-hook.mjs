// test/safe-git-hook.mjs — Safe pre-commit hook installer companion binary.
//
// Invariants:
//   1. `agent-kernel-safe-git-hook --dry-run` prints planned actions without writing.
//   2. Existing pre-commit hook logic is preserved.
//   3. Existing pre-commit hooks get backups before write.
//   4. Re-running the installer replaces the marked block instead of duplicating it.
//   5. Invalid arguments and project paths fail without filesystem changes.
//   6. Linked Git worktrees resolve and update the repository's actual hooks path.
//   7. Complete duplicate blocks collapse and corrupt markers require explicit repair.
//   8. Existing permissions are preserved while ensuring user execute permission.
//   9. Symbolic hook targets are rejected and temporary files are cleaned up.
//  10. Git-configured custom hooks paths are respected.

import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  writeFileSync
} from 'node:fs';
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

function runSafeGitHookFailure(env, ...args) {
  try {
    runSafeGitHook(env, ...args);
    return { status: 0, stdout: '', stderr: '' };
  } catch (error) {
    return {
      status: error.status ?? 1,
      stdout: String(error.stdout || ''),
      stderr: String(error.stderr || '')
    };
  }
}

function runGit(cwd, env, ...args) {
  return execFileSync('git', args, {
    cwd,
    env,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  }).trim();
}

function countMarkers(text) {
  return (text.match(/^# agent-kernel:start$/gm) || []).length;
}

function assertFailure(result, message) {
  if (result.status === 0) throw new Error(message);
}

function trySymlink(target, linkPath) {
  try {
    symlinkSync(target, linkPath, 'file');
    return true;
  } catch (error) {
    if (error?.code === 'EPERM' || error?.code === 'EACCES' || error?.code === 'ENOSYS') return false;
    throw error;
  }
}

function modeOf(filePath) {
  return lstatSync(filePath).mode & 0o777;
}

function temporaryArtifacts(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => name.includes('.tmp-') || name.includes('.rollback-'));
}

export async function run() {
  const { env, homeDir } = makeEnv();

  const unknown = runSafeGitHookFailure(env, '--unknown');
  assertFailure(unknown, 'safe git-hook accepted an unknown option');
  assertContains(unknown.stderr, 'Unknown option: --unknown', 'unknown option error was not actionable');
  if (unknown.stderr.includes(' at ')) throw new Error('unknown option printed a stack trace');

  const duplicate = runSafeGitHookFailure(env, '--dry-run', '--dry-run');
  assertFailure(duplicate, 'safe git-hook accepted a duplicate option');
  assertContains(duplicate.stderr, 'Duplicate option: --dry-run', 'duplicate option error was not actionable');

  const multipleProjects = runSafeGitHookFailure(env, homeDir, join(homeDir, 'other'));
  assertFailure(multipleProjects, 'safe git-hook accepted multiple project paths');
  assertContains(multipleProjects.stderr, 'Expected at most one project path', 'multiple project path error was not actionable');

  const missingProject = join(homeDir, 'missing-project');
  const missing = runSafeGitHookFailure(env, missingProject);
  assertFailure(missing, 'safe git-hook accepted a missing project path');
  assertContains(missing.stderr, 'Project path not found', 'missing project error was not actionable');
  if (existsSync(missingProject)) throw new Error('safe git-hook created a missing project directory');

  const regularFile = join(homeDir, 'not-a-project.txt');
  writeFileSync(regularFile, 'file');
  const fileProject = runSafeGitHookFailure(env, regularFile);
  assertFailure(fileProject, 'safe git-hook accepted a regular file as a project');
  assertContains(fileProject.stderr, 'Project path is not a directory', 'regular file project error was not actionable');

  const nonGitProject = join(homeDir, 'not-a-git-project');
  mkdirSync(nonGitProject, { recursive: true });
  const nonGit = runSafeGitHookFailure(env, nonGitProject);
  assertFailure(nonGit, 'safe git-hook accepted a non-Git directory');
  assertContains(nonGit.stderr, 'Not a Git worktree', 'non-Git project error was not actionable');

  const project = join(homeDir, 'project-with-existing-hook');
  mkdirSync(project, { recursive: true });
  runGit(project, env, 'init');

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

  const duplicateBlock = `${afterSecondRun}\n# agent-kernel:start\necho stale duplicate\n# agent-kernel:end\n`;
  writeFileSync(hookPath, duplicateBlock);
  runSafeGitHook(env, project);
  const collapsed = readFileSync(hookPath, 'utf8');
  if (countMarkers(collapsed) !== 1 || collapsed.includes('stale duplicate')) {
    throw new Error('safe git-hook did not collapse duplicate complete managed blocks');
  }

  const corruptHook = '#!/usr/bin/env sh\necho "keep user hook"\n# agent-kernel:start\necho "stale unmatched text"\n';
  writeFileSync(hookPath, corruptHook);
  const corrupt = runSafeGitHookFailure(env, project);
  assertFailure(corrupt, 'safe git-hook accepted corrupt markers without --force');
  assertContains(corrupt.stderr, 'Corrupt Agent Kernel markers in pre-commit', 'corrupt marker error was not actionable');
  if (readFileSync(hookPath, 'utf8') !== corruptHook) throw new Error('corrupt marker failure changed the hook');

  const forcePreview = runSafeGitHook(env, project, '--force', '--dry-run');
  assertContains(forcePreview, 'repair-corrupt-markers', 'force dry-run did not report repair');
  if (readFileSync(hookPath, 'utf8') !== corruptHook) throw new Error('force dry-run changed the hook');

  runSafeGitHook(env, project, '--force');
  const repaired = readFileSync(hookPath, 'utf8');
  assertContains(repaired, 'keep user hook', 'force repair lost user shell code');
  assertContains(repaired, 'stale unmatched text', 'force repair removed non-marker text without review');
  if (countMarkers(repaired) !== 1) throw new Error('force repair did not create exactly one managed block');

  writeFileSync(hookPath, '#!/usr/bin/env sh\necho mode-test\n');
  chmodSync(hookPath, 0o600);
  const backupsBeforeMode = new Set(readdirSync(backupsDir));
  runSafeGitHook(env, project);
  if (modeOf(hookPath) !== 0o700) {
    throw new Error(`safe git-hook did not preserve permissions and add user execute: ${modeOf(hookPath).toString(8)}`);
  }
  const newBackups = readdirSync(backupsDir).filter((name) => !backupsBeforeMode.has(name));
  if (newBackups.length !== 1 || modeOf(join(backupsDir, newBackups[0])) !== 0o600) {
    throw new Error('safe git-hook backup did not preserve the original hook mode');
  }
  if (temporaryArtifacts(join(project, '.git', 'hooks')).length) {
    throw new Error('safe git-hook left temporary or rollback files after success');
  }

  const backupCountBeforeNoBackup = readdirSync(backupsDir).length;
  runSafeGitHook(env, project, '--no-backup');
  if (readdirSync(backupsDir).length !== backupCountBeforeNoBackup) {
    throw new Error('safe git-hook created a persistent backup despite --no-backup');
  }

  runGit(project, env, 'config', 'user.name', 'Agent Kernel Test');
  runGit(project, env, 'config', 'user.email', 'agent-kernel-test@example.invalid');
  writeFileSync(join(project, 'README.md'), '# fixture\n');
  runGit(project, env, 'add', 'README.md');
  runGit(project, env, 'commit', '-m', 'test: initialize worktree fixture');
  const linkedWorktree = join(homeDir, 'linked-worktree');
  runGit(project, env, 'worktree', 'add', '-b', 'linked-fixture', linkedWorktree);

  const worktreeDryRun = runSafeGitHook(env, linkedWorktree, '--dry-run');
  assertContains(worktreeDryRun, 'pre-commit', 'worktree dry-run did not resolve the hooks path');
  runSafeGitHook(env, linkedWorktree);
  const worktreeHook = readFileSync(hookPath, 'utf8');
  if (countMarkers(worktreeHook) !== 1) {
    throw new Error('worktree install did not update the shared repository hook idempotently');
  }

  const customHooksDir = join(project, '.githooks');
  mkdirSync(customHooksDir, { recursive: true });
  runGit(project, env, 'config', 'core.hooksPath', '.githooks');
  const customHookPath = join(customHooksDir, 'pre-commit');
  writeFileSync(customHookPath, '#!/usr/bin/env sh\necho custom-path\n');
  runSafeGitHook(env, project);
  const customHook = readFileSync(customHookPath, 'utf8');
  assertContains(customHook, 'custom-path', 'custom hooks path lost existing logic');
  assertContains(customHook, 'agent-kernel guard --staged', 'custom hooks path did not receive Agent Kernel block');

  const symlinkProject = join(homeDir, 'symlink-hook-project');
  mkdirSync(symlinkProject, { recursive: true });
  runGit(symlinkProject, env, 'init');
  const outsideHook = join(homeDir, 'outside-pre-commit');
  writeFileSync(outsideHook, '#!/usr/bin/env sh\necho outside\n');
  const symlinkHook = join(symlinkProject, '.git', 'hooks', 'pre-commit');
  if (trySymlink(outsideHook, symlinkHook)) {
    const symlinkResult = runSafeGitHookFailure(env, symlinkProject);
    assertFailure(symlinkResult, 'safe git-hook followed a symbolic pre-commit hook');
    assertContains(symlinkResult.stderr, 'Refusing to modify symbolic pre-commit hook', 'symlink hook error was not actionable');
    if (readFileSync(outsideHook, 'utf8') !== '#!/usr/bin/env sh\necho outside\n') {
      throw new Error('safe git-hook modified the symbolic hook target');
    }
  }
}

export const name = 'safe-git-hook';
