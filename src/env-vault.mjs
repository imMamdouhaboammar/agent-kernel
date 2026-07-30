import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import childProcess from 'node:child_process';

export function getVaultHome() {
  const home = os.homedir();
  return path.join(home, '.agent-kernel', 'vault', 'env-mirrors');
}

export function gitRemoteUrl(cwd) {
  try {
    const out = childProcess.execFileSync('git', ['config', '--get', 'remote.origin.url'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.trim() || null;
  } catch {
    return null;
  }
}

export function initialCommitHash(cwd) {
  try {
    const out = childProcess.execFileSync('git', ['rev-list', '--max-parents=0', 'HEAD'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.trim().split(/\s+/)[0] || null;
  } catch {
    return null;
  }
}

export function calculateProjectFingerprint(projectDir) {
  const remote = gitRemoteUrl(projectDir);
  const projectName = path.basename(path.resolve(projectDir));
  let sourceString = '';

  if (remote) {
    sourceString = remote.toLowerCase().replace(/\.git$/, '').trim();
  } else {
    const initHash = initialCommitHash(projectDir);
    if (initHash) {
      sourceString = `commit:${initHash}:${projectName}`;
    } else {
      sourceString = `path:${path.resolve(projectDir)}`;
    }
  }

  const hash = crypto.createHash('sha256').update(sourceString).digest('hex').slice(0, 16);
  return {
    fingerprint: `env_vault_${hash}`,
    gitRemote: remote,
    projectName,
    sourceString
  };
}

export function getProjectVaultDir(projectDir) {
  const { fingerprint } = calculateProjectFingerprint(projectDir);
  return path.join(getVaultHome(), fingerprint);
}

export function readVaultMetadata(vaultDir) {
  const metaPath = path.join(vaultDir, 'metadata.json');
  if (!fs.existsSync(metaPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  } catch {
    return null;
  }
}

export function writeVaultMetadata(vaultDir, meta) {
  fs.mkdirSync(vaultDir, { recursive: true, mode: 0o700 });
  const metaPath = path.join(vaultDir, 'metadata.json');
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), { encoding: 'utf8', mode: 0o600 });
}

export function fileSha256(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export function vaultLinkProject(projectDir) {
  const resolvedPath = path.resolve(projectDir || '.');
  const info = calculateProjectFingerprint(resolvedPath);
  const vaultDir = path.join(getVaultHome(), info.fingerprint);
  fs.mkdirSync(vaultDir, { recursive: true, mode: 0o700 });

  const envCandidates = ['.env', '.env.local', '.env.development', '.env.production', '.env.test'];
  const syncedFiles = [];
  const filesMeta = {};

  for (const name of envCandidates) {
    const localFile = path.join(resolvedPath, name);
    if (fs.existsSync(localFile) && fs.statSync(localFile).isFile()) {
      const content = fs.readFileSync(localFile);
      const sha = crypto.createHash('sha256').update(content).digest('hex');
      const targetInVault = path.join(vaultDir, name);
      fs.writeFileSync(targetInVault, content, { mode: 0o600 });
      syncedFiles.push(name);
      filesMeta[name] = {
        sha256: sha,
        updatedAt: new Date().toISOString(),
        sizeBytes: content.length
      };
    }
  }

  const metadata = {
    fingerprint: info.fingerprint,
    gitRemote: info.gitRemote,
    projectName: info.projectName,
    lastKnownPath: resolvedPath,
    createdAt: new Date().toISOString(),
    lastSyncedAt: new Date().toISOString(),
    files: filesMeta
  };

  writeVaultMetadata(vaultDir, metadata);
  return { ok: true, fingerprint: info.fingerprint, syncedFiles, gitRemote: info.gitRemote, vaultDir };
}

export function vaultSyncProject(projectDir) {
  const resolvedPath = path.resolve(projectDir || '.');
  const info = calculateProjectFingerprint(resolvedPath);
  const vaultDir = path.join(getVaultHome(), info.fingerprint);
  let metadata = readVaultMetadata(vaultDir);

  if (!metadata) {
    return vaultLinkProject(resolvedPath);
  }

  const envCandidates = ['.env', '.env.local', '.env.development', '.env.production', '.env.test'];
  const syncedFiles = [];
  let updated = false;

  for (const name of envCandidates) {
    const localFile = path.join(resolvedPath, name);
    if (fs.existsSync(localFile) && fs.statSync(localFile).isFile()) {
      const content = fs.readFileSync(localFile);
      const sha = crypto.createHash('sha256').update(content).digest('hex');
      const prevSha = metadata.files?.[name]?.sha256;

      if (sha !== prevSha) {
        const targetInVault = path.join(vaultDir, name);
        fs.writeFileSync(targetInVault, content, { mode: 0o600 });
        metadata.files = metadata.files || {};
        metadata.files[name] = {
          sha256: sha,
          updatedAt: new Date().toISOString(),
          sizeBytes: content.length
        };
        updated = true;
      }
      syncedFiles.push(name);
    }
  }

  if (updated) {
    metadata.lastSyncedAt = new Date().toISOString();
    metadata.lastKnownPath = resolvedPath;
    writeVaultMetadata(vaultDir, metadata);
  }

  return { ok: true, syncedFiles, updated };
}

export function vaultRestoreProject(projectDir) {
  const resolvedPath = path.resolve(projectDir || '.');
  const info = calculateProjectFingerprint(resolvedPath);
  const vaultDir = path.join(getVaultHome(), info.fingerprint);
  const metadata = readVaultMetadata(vaultDir);

  if (!metadata || !metadata.files) {
    return { ok: false, reason: 'No vault mirror found for project fingerprint: ' + info.fingerprint };
  }

  const restoredFiles = [];
  for (const [name, fileMeta] of Object.entries(metadata.files)) {
    const vaultFile = path.join(vaultDir, name);
    const localFile = path.join(resolvedPath, name);

    if (fs.existsSync(vaultFile)) {
      const content = fs.readFileSync(vaultFile);
      fs.writeFileSync(localFile, content, { mode: 0o600 });
      restoredFiles.push(name);
    }
  }

  return { ok: true, restoredFiles, fingerprint: info.fingerprint, gitRemote: metadata.gitRemote };
}

export function vaultGetStatus(projectDir) {
  const resolvedPath = path.resolve(projectDir || '.');
  const info = calculateProjectFingerprint(resolvedPath);
  const vaultDir = path.join(getVaultHome(), info.fingerprint);
  const metadata = readVaultMetadata(vaultDir);

  if (!metadata) {
    return { linked: false, fingerprint: info.fingerprint, gitRemote: info.gitRemote, projectName: info.projectName };
  }

  const diffs = [];
  const envCandidates = ['.env', '.env.local', '.env.development', '.env.production', '.env.test'];

  for (const name of envCandidates) {
    const localFile = path.join(resolvedPath, name);
    const vaultFile = path.join(vaultDir, name);
    const hasLocal = fs.existsSync(localFile);
    const hasVault = fs.existsSync(vaultFile);

    if (hasLocal && hasVault) {
      const localSha = fileSha256(localFile);
      const vaultSha = fileSha256(vaultFile);
      diffs.push({ file: name, status: localSha === vaultSha ? 'IN_SYNC' : 'MODIFIED_LOCAL' });
    } else if (hasLocal && !hasVault) {
      diffs.push({ file: name, status: 'UNSAVED_LOCAL' });
    } else if (!hasLocal && hasVault) {
      diffs.push({ file: name, status: 'MISSING_LOCAL' });
    }
  }

  return {
    linked: true,
    fingerprint: info.fingerprint,
    gitRemote: metadata.gitRemote || info.gitRemote,
    projectName: metadata.projectName || info.projectName,
    lastKnownPath: metadata.lastKnownPath,
    lastSyncedAt: metadata.lastSyncedAt,
    diffs
  };
}

export function vaultListProjects() {
  const vaultHome = getVaultHome();
  if (!fs.existsSync(vaultHome)) return [];
  const entries = fs.readdirSync(vaultHome, { withFileTypes: true });
  const projects = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const vaultDir = path.join(vaultHome, entry.name);
      const meta = readVaultMetadata(vaultDir);
      if (meta) {
        projects.push({
          fingerprint: meta.fingerprint,
          projectName: meta.projectName,
          gitRemote: meta.gitRemote,
          lastKnownPath: meta.lastKnownPath,
          lastSyncedAt: meta.lastSyncedAt,
          files: Object.keys(meta.files || {})
        });
      }
    }
  }

  return projects;
}

export function vaultUnlinkProject(projectDir) {
  const resolvedPath = path.resolve(projectDir || '.');
  const info = calculateProjectFingerprint(resolvedPath);
  const vaultDir = path.join(getVaultHome(), info.fingerprint);

  if (fs.existsSync(vaultDir)) {
    fs.rmSync(vaultDir, { recursive: true, force: true });
    return { ok: true, fingerprint: info.fingerprint };
  }

  return { ok: false, reason: 'Project is not linked in Vault.' };
}
