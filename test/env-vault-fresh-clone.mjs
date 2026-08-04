import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function git(cwd, args) {
  return childProcess.execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

function createGitProject(root, name, remote) {
  const project = path.join(root, name);
  fs.mkdirSync(project, { recursive: true });
  git(project, ['init']);
  git(project, ['config', 'user.email', 'fresh-clone@example.test']);
  git(project, ['config', 'user.name', 'Fresh Clone Test']);
  fs.writeFileSync(path.join(project, 'README.md'), '# fixture\n', 'utf8');
  git(project, ['add', 'README.md']);
  git(project, ['commit', '-m', 'initial']);
  git(project, ['remote', 'add', 'origin', remote]);
  return project;
}

async function withKernelHome(kernelHome, fn) {
  const previous = {
    AGENT_KERNEL_HOME: process.env.AGENT_KERNEL_HOME,
    HOME: process.env.HOME,
    USERPROFILE: process.env.USERPROFILE
  };
  process.env.AGENT_KERNEL_HOME = kernelHome;
  process.env.HOME = path.dirname(kernelHome);
  process.env.USERPROFILE = path.dirname(kernelHome);
  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

export async function run() {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-kernel-env-fresh-clone-'));
  const kernelHome = path.join(homeDir, '.agent-kernel-test');
  const projects = path.join(homeDir, 'projects');
  fs.mkdirSync(projects, { recursive: true });

  await withKernelHome(kernelHome, async () => {
    const vault = await import('../dist/env-vault.mjs');
    const source = createGitProject(projects, 'source', 'git@github.com:Owner/FreshClone.git');
    fs.mkdirSync(path.join(source, 'apps', 'api'), { recursive: true });
    fs.writeFileSync(path.join(source, '.env'), 'ROOT_SECRET=source\n', 'utf8');
    fs.writeFileSync(path.join(source, 'apps', 'api', '.env.local'), 'API_SECRET=source\n', 'utf8');
    vault.vaultLinkProject(source);

    const clone = createGitProject(projects, 'fresh-clone', 'https://github.com/owner/freshclone.git');
    const before = vault.vaultGetStatus(clone);
    assert.equal(before.linked, true, 'matching stable identity must be eligible for automatic restore');
    assert.deepEqual(
      before.diffs.filter((item) => item.status === 'MISSING_LOCAL').map((item) => item.file).sort(),
      ['.env', 'apps/api/.env.local']
    );

    const restored = vault.vaultRestoreProject(clone);
    assert.equal(restored.ok, true);
    assert.deepEqual([...restored.restoredFiles].sort(), ['.env', 'apps/api/.env.local']);
    assert.equal(fs.readFileSync(path.join(clone, '.env'), 'utf8'), 'ROOT_SECRET=source\n');
    assert.equal(fs.readFileSync(path.join(clone, 'apps', 'api', '.env.local'), 'utf8'), 'API_SECRET=source\n');

    const after = vault.vaultGetStatus(clone);
    assert.equal(after.linked, true);
    assert(after.diffs.every((item) => item.status === 'IN_SYNC'));

    const unlinked = vault.vaultUnlinkProject(clone);
    assert.equal(unlinked.ok, true);
    const detached = vault.vaultGetStatus(clone);
    assert.equal(detached.linked, false, 'explicit unlink must override identity-based restore eligibility');
    const sync = vault.vaultSyncProject(clone);
    assert.equal(sync.ok, false, 'detached paths must not auto-sync');
  });
}

export const name = 'env-vault-fresh-clone';
