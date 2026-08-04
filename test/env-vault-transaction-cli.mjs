import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { repo } from './_lib/helpers.mjs';

function git(cwd, args) {
  return childProcess.execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

function createGitProject(root) {
  const project = path.join(root, 'project');
  fs.mkdirSync(project, { recursive: true });
  git(project, ['init']);
  git(project, ['config', 'user.email', 'vault-cli@example.test']);
  git(project, ['config', 'user.name', 'Vault CLI Test']);
  fs.writeFileSync(path.join(project, 'README.md'), '# fixture\n', 'utf8');
  git(project, ['add', 'README.md']);
  git(project, ['commit', '-m', 'initial']);
  git(project, ['remote', 'add', 'origin', 'git@github.com:Owner/VaultCli.git']);
  return project;
}

function runEnvCli(env, args) {
  return childProcess.spawnSync(
    process.execPath,
    [path.join(repo.root, 'bin', 'agent-kernel-router.mjs'), 'env', ...args],
    {
      cwd: repo.root,
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );
}

export async function run() {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-kernel-env-cli-'));
  const kernelHome = path.join(homeDir, '.agent-kernel-test');
  const project = createGitProject(homeDir);
  const env = {
    ...process.env,
    AGENT_KERNEL_HOME: kernelHome,
    HOME: homeDir,
    USERPROFILE: homeDir
  };
  const envFile = path.join(project, '.env');
  fs.writeFileSync(envFile, 'TOKEN=alpha\n', 'utf8');

  const dryUnlinked = runEnvCli(env, ['push', project, '--dry-run', '--json']);
  assert.equal(dryUnlinked.status, 2, 'unlinked push dry-run must fail closed');
  const dryUnlinkedJson = JSON.parse(dryUnlinked.stdout);
  assert.equal(dryUnlinkedJson.ok, false);
  assert.match(dryUnlinkedJson.reason, /env link|not linked/i);

  const humanUnlinked = runEnvCli(env, ['push', project]);
  assert.equal(humanUnlinked.status, 2);
  assert.match(humanUnlinked.stdout, /push blocked/i);
  assert.match(humanUnlinked.stdout, /env link|not linked/i);
  assert.doesNotMatch(humanUnlinked.stdout, /push complete/i);

  const previous = {
    AGENT_KERNEL_HOME: process.env.AGENT_KERNEL_HOME,
    HOME: process.env.HOME,
    USERPROFILE: process.env.USERPROFILE
  };
  process.env.AGENT_KERNEL_HOME = kernelHome;
  process.env.HOME = homeDir;
  process.env.USERPROFILE = homeDir;
  try {
    const vault = await import('../dist/env-vault.mjs');
    const { withVaultLock } = await import('../dist/env-vault/storage.mjs');
    const linked = vault.vaultLinkProject(project);

    fs.writeFileSync(envFile, 'TOKEN=beta\n', 'utf8');
    const dryPush = runEnvCli(env, ['push', project, '--dry-run', '--json']);
    assert.equal(dryPush.status, 0);
    const dryPushJson = JSON.parse(dryPush.stdout);
    assert.equal(dryPushJson.ok, true);
    assert.equal(dryPushJson.dryRun, true);
    assert.deepEqual(dryPushJson.changedFiles, ['.env']);
    assert.equal(vault.vaultGetStatus(project).diffs[0].status, 'MODIFIED_LOCAL');

    fs.rmSync(envFile);
    const dryPull = runEnvCli(env, ['pull', project, '--dry-run', '--json']);
    assert.equal(dryPull.status, 0);
    const dryPullJson = JSON.parse(dryPull.stdout);
    assert.equal(dryPullJson.ok, true);
    assert.equal(dryPullJson.dryRun, true);
    assert.deepEqual(dryPullJson.wouldRestore, ['.env']);
    assert.equal(fs.existsSync(envFile), false, 'pull dry-run must not create files');

    withVaultLock(linked.vaultDir, 'test-writer', () => {
      assert.throws(
        () => vault.vaultRestoreProject(project),
        /locked by test-writer/i,
        'restore must share the per-vault writer lock'
      );
      assert.equal(fs.existsSync(envFile), false);
    });

    const restored = vault.vaultRestoreProject(project);
    assert.equal(restored.ok, true);
    assert.equal(fs.readFileSync(envFile, 'utf8'), 'TOKEN=alpha\n');
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

export const name = 'env-vault-transaction-cli';
