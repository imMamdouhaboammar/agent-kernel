import { runCli, makeEnv, assertContains, assertNotContains, repo } from './_lib/helpers.mjs';
import { writeFileSync, readFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert';

export async function run() {
  const { env, homeDir } = makeEnv();
  const testProject = join(homeDir, 'my-secret-app');
  mkdirSync(testProject, { recursive: true });

  // Init git repo
  execFileSync('git', ['init'], { cwd: testProject });
  execFileSync('git', ['config', 'remote.origin.url', 'https://github.com/imMamdouhaboammar/my-secret-app.git'], { cwd: testProject });
  execFileSync('git', ['commit', '--allow-empty', '-m', 'initial commit'], { cwd: testProject });

  // Write .env
  writeFileSync(join(testProject, '.env'), 'DATABASE_URL="postgres://user:pass@localhost:5432/db"\nSECRET_KEY="super-secret"\n');

  // 1. Link project
  const linkOut = runCli(env, 'env', 'link', testProject);
  assertContains(linkOut, 'Linked project to Env Vault');

  // 2. Status
  const statusOut = runCli(env, 'env', 'status', testProject);
  assertContains(statusOut, 'Linked: YES');
  assertContains(statusOut, 'https://github.com/imMamdouhaboammar/my-secret-app.git');

  // 3. Remove local .env
  rmSync(join(testProject, '.env'));

  // 4. Restore manually via CLI (pull)
  const restoreOut = runCli(env, 'env', 'pull', testProject);
  assertContains(restoreOut, 'Restored .env');
  const restoredContent = readFileSync(join(testProject, '.env'), 'utf8');
  assertContains(restoredContent, 'super-secret');

  // 5. Test Auto-Restore on SessionStart
  rmSync(join(testProject, '.env'));
  assert(!existsSync(join(testProject, '.env')), 'Local .env should be deleted before SessionStart test');

  const sessionInput = JSON.stringify({ cwd: testProject, hook_event: 'SessionStart' });
  const sessionStartOut = execFileSync(process.execPath, [join(repo.root, 'dist', 'cli.mjs'), 'hook', 'session-start'], {
    cwd: repo.root,
    env,
    input: sessionInput,
    encoding: 'utf8'
  });
  assertContains(sessionStartOut, 'Automatically restored missing environment files from vault');
  assert(existsSync(join(testProject, '.env')), 'Auto-restore failed on SessionStart');

  // 6. Test Auto-Sync on PostToolUse
  writeFileSync(join(testProject, '.env'), 'DATABASE_URL="postgres://newuser:newpass@localhost:5432/db"\nSECRET_KEY="super-secret-updated"\n');
  const postInput = JSON.stringify({ cwd: testProject, tool_name: 'Write', tool_input: { path: '.env' } });
  execFileSync(process.execPath, [join(repo.root, 'dist', 'cli.mjs'), 'hook', 'post-tool-use'], {
    cwd: repo.root,
    env,
    input: postInput,
    encoding: 'utf8'
  });

  const statusAfterEdit = runCli(env, 'env', 'status', testProject);
  assertContains(statusAfterEdit, 'IN_SYNC');

  // 7. Test env list
  const listOut = runCli(env, 'env', 'list');
  assertContains(listOut, 'my-secret-app');
  assertContains(listOut, 'https://github.com/imMamdouhaboammar/my-secret-app.git');

  // 8. Test env unlink
  const unlinkOut = runCli(env, 'env', 'unlink', testProject);
  assertContains(unlinkOut, 'Unlinked project from Env Vault');

  const statusAfterUnlink = runCli(env, 'env', 'status', testProject);
  assertContains(statusAfterUnlink, 'Linked: NO');
}

export const name = 'env-vault';
