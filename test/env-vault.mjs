import { repo } from './_lib/helpers.mjs';
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
  git(project, ['config', 'user.email', 'env-vault@example.test']);
  git(project, ['config', 'user.name', 'Env Vault Test']);
  fs.writeFileSync(path.join(project, 'README.md'), '# fixture\n', 'utf8');
  git(project, ['add', 'README.md']);
  git(project, ['commit', '-m', 'initial']);
  if (remote) git(project, ['remote', 'add', 'origin', remote]);
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

function regularFiles(root) {
  if (!fs.existsSync(root)) return [];
  const out = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...regularFiles(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function createDirectorySymlink(target, linkPath) {
  try {
    fs.symlinkSync(target, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
    return true;
  } catch (error) {
    if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) return false;
    throw error;
  }
}

export async function run() {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-kernel-env-v2-'));
  const kernelHome = path.join(homeDir, 'custom-kernel-home');
  const fixtureRoot = path.join(homeDir, 'projects');
  fs.mkdirSync(kernelHome, { recursive: true });
  fs.mkdirSync(fixtureRoot, { recursive: true });

  await withKernelHome(kernelHome, async () => {
    const vault = await import('../dist/env-vault.mjs');
    assert.equal(typeof vault.calculateProjectIdentity, 'function', 'v2 identity API must be exported');

    const project = createGitProject(
      fixtureRoot,
      'canonical-project',
      'https://token-user:token-secret@github.com/Owner/Repo.git?source=test#fragment'
    );

    const httpsIdentity = vault.calculateProjectIdentity(project);
    assert.equal(httpsIdentity.fingerprint.length, 64, 'fingerprint must use the full SHA256 digest');
    assert.equal(httpsIdentity.canonical, 'remote:github.com/owner/repo');
    assert(!httpsIdentity.canonical.includes('token-secret'), 'canonical identity must redact credentials');

    git(project, ['remote', 'set-url', 'origin', 'git@github.com:Owner/Repo.git']);
    const sshIdentity = vault.calculateProjectIdentity(project);
    assert.equal(sshIdentity.fingerprint, httpsIdentity.fingerprint, 'SSH and HTTPS clones must share one fingerprint');

    const pathOnly = path.join(fixtureRoot, 'path-only');
    fs.mkdirSync(pathOnly, { recursive: true });
    assert.throws(
      () => vault.calculateProjectIdentity(pathOnly),
      /allow-path-identity|stable git identity/i,
      'path identity must require explicit opt-in'
    );
    const pathIdentity = vault.calculateProjectIdentity(pathOnly, { allowPathIdentity: true });
    assert.equal(pathIdentity.source, 'path');
    assert.equal(pathIdentity.fingerprint.length, 64);

    const unlinked = createGitProject(fixtureRoot, 'unlinked-project', 'git@github.com:Owner/Unlinked.git');
    fs.writeFileSync(path.join(unlinked, '.env'), 'UNLINKED_SECRET=value\n', 'utf8');
    const unlinkedSync = vault.vaultSyncProject(unlinked);
    assert.equal(unlinkedSync.ok, false, 'push must not create a vault before explicit env link');
    assert.match(unlinkedSync.reason, /not linked|env link/i);
    assert.equal(vault.vaultGetStatus(unlinked).linked, false, 'failed push must leave project unlinked');

    fs.mkdirSync(path.join(project, 'apps', 'api'), { recursive: true });
    fs.writeFileSync(path.join(project, '.env'), 'SECRET_VALUE=alpha\n', { mode: 0o644 });
    fs.writeFileSync(path.join(project, '.env.example'), 'SECRET_VALUE=example\n', 'utf8');
    fs.writeFileSync(path.join(project, 'apps', 'api', '.env.local'), 'API_TOKEN=nested\n', 'utf8');

    const linked = vault.vaultLinkProject(project);
    assert.equal(linked.ok, true);
    assert(linked.vaultDir.startsWith(kernelHome), 'vault must respect AGENT_KERNEL_HOME');
    assert.deepEqual([...linked.syncedFiles].sort(), ['.env', 'apps/api/.env.local']);

    if (process.platform !== 'win32') {
      const manifestMode = fs.statSync(path.join(linked.vaultDir, 'manifest.json')).mode & 0o777;
      assert.equal(manifestMode, 0o600, 'manifest must be owner-readable and owner-writable only');
      const stored = regularFiles(path.join(linked.vaultDir, 'files'));
      assert.equal(stored.length, 2);
      for (const file of stored) {
        assert.equal(fs.statSync(file).mode & 0o777, 0o600, `${file} must use 0600 permissions`);
      }
    }

    fs.writeFileSync(path.join(project, '.env'), 'SECRET_VALUE=beta\n', 'utf8');
    const refused = vault.vaultRestoreProject(project);
    assert.equal(refused.ok, false, 'pull must refuse a differing local file');
    assert.deepEqual(refused.conflicts.map((item) => item.file), ['.env']);
    assert.equal(fs.readFileSync(path.join(project, '.env'), 'utf8'), 'SECRET_VALUE=beta\n');

    const forced = vault.vaultRestoreProject(project, { force: true });
    assert.equal(forced.ok, true);
    assert.equal(fs.readFileSync(path.join(project, '.env'), 'utf8'), 'SECRET_VALUE=alpha\n');
    assert.equal(forced.backups.length, 1, 'forced overwrite must create a local backup');
    assert.equal(fs.readFileSync(forced.backups[0].backupPath, 'utf8'), 'SECRET_VALUE=beta\n');

    const outside = path.join(homeDir, 'outside-secret');
    fs.writeFileSync(outside, 'OUTSIDE_SECRET=value\n', 'utf8');
    const linkedPath = path.join(project, '.env.link');
    let symlinkCreated = true;
    try {
      fs.symlinkSync(outside, linkedPath, 'file');
    } catch (error) {
      if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) symlinkCreated = false;
      else throw error;
    }
    if (symlinkCreated) {
      assert.throws(
        () => vault.vaultSyncProject(project, { files: ['.env.link'] }),
        /symlink|regular file/i,
        'symlink environment files must be rejected'
      );
    }

    const outsideDirectory = path.join(homeDir, 'outside-directory');
    const linkedDirectory = path.join(project, 'linked-directory');
    fs.mkdirSync(outsideDirectory, { recursive: true });
    fs.writeFileSync(path.join(outsideDirectory, '.env.parent'), 'PARENT_ESCAPE=value\n', 'utf8');
    if (createDirectorySymlink(outsideDirectory, linkedDirectory)) {
      assert.throws(
        () => vault.vaultSyncProject(project, { files: ['linked-directory/.env.parent'] }),
        /symlink|project root|unsafe path/i,
        'environment files behind a symlinked parent must be rejected'
      );
    }

    const manifest = JSON.parse(fs.readFileSync(path.join(linked.vaultDir, 'manifest.json'), 'utf8'));
    const envEntry = manifest.files['.env'];
    const revisionPath = path.join(linked.vaultDir, 'revisions', envEntry.revision, envEntry.storageKey);
    fs.writeFileSync(revisionPath, 'TAMPERED_REVISION=value\n', 'utf8');
    fs.rmSync(path.join(project, '.env'));
    assert.throws(
      () => vault.vaultRestoreProject(project, { files: ['.env'] }),
      /integrity|sha256|hash|revision/i,
      'restore must verify the referenced revision before writing a local file'
    );
    assert.equal(fs.existsSync(path.join(project, '.env')), false, 'failed integrity check must not create a local file');

    const router = path.join(repo.root, 'bin', 'agent-kernel-router.mjs');
    let output = '';
    let exitStatus = 0;
    try {
      output = childProcess.execFileSync(
        process.execPath,
        [router, 'env', 'status', project, '--json'],
        {
          cwd: repo.root,
          env: {
            ...process.env,
            AGENT_KERNEL_HOME: kernelHome,
            HOME: homeDir,
            USERPROFILE: homeDir
          },
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe']
        }
      );
    } catch (error) {
      exitStatus = error.status ?? 1;
      output = error.stdout?.toString() ?? '';
    }
    assert.equal(exitStatus, 2, 'unhealthy vault status must exit with code 2');
    const status = JSON.parse(output);
    assert.equal(status.linked, true);
    assert.equal(status.healthy, false);
    assert(!output.includes('alpha'), 'JSON status must never contain secret values');
    assert(!output.includes('nested'), 'JSON status must never contain nested secret values');
  });
}

export const name = 'env-vault';
