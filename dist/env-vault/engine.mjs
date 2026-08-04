import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_MAX_FILE_BYTES,
  encodeStorageKey,
  ensureDirectorySecure,
  kernelHome,
  normalizeRelativePath,
  nowIso,
  ownerMode,
  projectFilePath,
  repairFileMode,
  revisionId,
  sha256,
  uniqueSorted,
  vaultRoot
} from './common.mjs';
import { discoverEnvironmentFiles, normalizeRequestedFiles } from './discovery.mjs';
import {
  calculateProjectIdentity,
  canonicalizeRemote,
  gitRemoteUrl,
  initialCommitHash
} from './identity.mjs';
import { createManifest, readManifest, writeManifest } from './manifest.mjs';
import { atomicWriteFile, readRegularFile, withVaultLock } from './storage.mjs';

function vaultDirectory(identity) {
  return path.join(vaultRoot(), identity.fingerprint);
}

function storagePath(vaultDir, storageKey) {
  return path.join(vaultDir, 'files', storageKey);
}

function revisionPath(vaultDir, revision, storageKey) {
  return path.join(vaultDir, 'revisions', revision, storageKey);
}

function ensureVaultLayout(vaultDir) {
  ensureDirectorySecure(vaultRoot());
  ensureDirectorySecure(vaultDir);
  ensureDirectorySecure(path.join(vaultDir, 'files'));
  ensureDirectorySecure(path.join(vaultDir, 'revisions'));
}

function modeLabel(mode) {
  return `0${Number(mode & 0o777).toString(8).padStart(3, '0')}`;
}

function linkPath(manifest, projectRoot) {
  manifest.linkedPaths = uniqueSorted([...(manifest.linkedPaths || []), projectRoot]);
  manifest.detachedPaths = (manifest.detachedPaths || []).filter((item) => item !== projectRoot);
  manifest.lastKnownPath = projectRoot;
}

function storeBuffer(vaultDir, manifest, relativePath, file) {
  const storageKey = encodeStorageKey(relativePath);
  const previous = manifest.files[relativePath];
  const currentPath = storagePath(vaultDir, storageKey);

  if (previous?.sha256 === file.sha256 && fs.existsSync(currentPath)) {
    repairFileMode(currentPath, 0o600);
    return { changed: false, revision: previous.revision };
  }

  const id = revisionId(file.sha256);
  atomicWriteFile(revisionPath(vaultDir, id, storageKey), file.content, { mode: 0o600 });
  atomicWriteFile(currentPath, file.content, { mode: 0o600 });
  const history = [
    ...(previous?.history || []),
    {
      id,
      sha256: file.sha256,
      sizeBytes: file.sizeBytes,
      createdAt: nowIso(),
      storageKey
    }
  ].slice(-50);

  manifest.files[relativePath] = {
    storageKey,
    sha256: file.sha256,
    sizeBytes: file.sizeBytes,
    mode: '0600',
    updatedAt: nowIso(),
    revision: id,
    history
  };
  return { changed: true, revision: id };
}

function contextFor(projectDir, options = {}) {
  const identity = calculateProjectIdentity(projectDir, {
    allowPathIdentity: options.allowPathIdentity === true
  });
  return {
    identity,
    projectRoot: identity.projectRoot,
    vaultDir: vaultDirectory(identity)
  };
}

function requestedFiles(projectRoot, manifest, options = {}) {
  const requested = normalizeRequestedFiles(projectRoot, options.files || options.file);
  return requested || [...manifest.selectedFiles];
}

function readStoredFile(vaultDir, entry, maxBytes) {
  if (!entry) throw new Error('Environment Vault file entry is missing');
  return readRegularFile(storagePath(vaultDir, entry.storageKey), { maxBytes });
}

function backupGroup() {
  return new Date().toISOString().replace(/[:.]/gu, '-');
}

function restoreBuffer(projectRoot, relativePath, stored, options, group) {
  const localPath = projectFilePath(projectRoot, relativePath);
  if (!fs.existsSync(localPath)) {
    atomicWriteFile(localPath, stored.content, { mode: 0o600 });
    return { restored: true, backup: null, conflict: null, unchanged: false };
  }

  const local = readRegularFile(localPath, { maxBytes: options.maxBytes });
  if (local.sha256 === stored.sha256) {
    return { restored: false, backup: null, conflict: null, unchanged: true };
  }
  if (options.force !== true) {
    return {
      restored: false,
      backup: null,
      unchanged: false,
      conflict: {
        file: relativePath,
        localSha256: local.sha256,
        vaultSha256: stored.sha256
      }
    };
  }

  let backup = null;
  if (options.noBackup !== true) {
    const backupPath = path.join(
      projectRoot,
      '.agent-kernel',
      'env-backups',
      group,
      ...normalizeRelativePath(relativePath).split('/')
    );
    atomicWriteFile(backupPath, local.content, { mode: 0o600 });
    backup = { file: relativePath, backupPath };
  }
  atomicWriteFile(localPath, stored.content, { mode: 0o600 });
  return { restored: true, backup, conflict: null, unchanged: false };
}

export function vaultLinkProject(projectDir = '.', options = {}) {
  const { identity, projectRoot, vaultDir } = contextFor(projectDir, options);
  const selectedFiles = discoverEnvironmentFiles(projectRoot, {
    include: options.include,
    exclude: options.exclude,
    maxBytes: options.maxBytes
  });
  if (!selectedFiles.length && options.allowEmpty !== true) {
    throw new Error('No eligible environment files found, pass --allow-empty to link an empty vault');
  }
  ensureVaultLayout(vaultDir);

  return withVaultLock(vaultDir, 'link', () => {
    const manifest = readManifest(vaultDir, { allowMissing: true }) || createManifest(identity);
    if (manifest.fingerprint !== identity.fingerprint) throw new Error('Environment Vault fingerprint mismatch');
    linkPath(manifest, projectRoot);
    manifest.selectedFiles = selectedFiles;

    const changedFiles = [];
    const unchangedFiles = [];
    for (const relativePath of selectedFiles) {
      const local = readRegularFile(projectFilePath(projectRoot, relativePath), {
        maxBytes: options.maxBytes || DEFAULT_MAX_FILE_BYTES
      });
      const result = storeBuffer(vaultDir, manifest, relativePath, local);
      (result.changed ? changedFiles : unchangedFiles).push(relativePath);
    }
    const written = writeManifest(vaultDir, manifest);
    return {
      ok: true,
      fingerprint: identity.fingerprint,
      canonical: identity.canonical,
      gitRemote: identity.gitRemote,
      projectRoot,
      vaultDir,
      syncedFiles: [...selectedFiles],
      changedFiles,
      unchangedFiles,
      manifest: written
    };
  });
}

export function vaultSyncProject(projectDir = '.', options = {}) {
  const { identity, projectRoot, vaultDir } = contextFor(projectDir, options);
  if (!fs.existsSync(path.join(vaultDir, 'manifest.json'))) {
    return vaultLinkProject(projectRoot, {
      ...options,
      include: options.files || options.file || options.include
    });
  }
  ensureVaultLayout(vaultDir);

  return withVaultLock(vaultDir, 'push', () => {
    const manifest = readManifest(vaultDir);
    linkPath(manifest, projectRoot);
    const selected = requestedFiles(projectRoot, manifest, options);
    const changedFiles = [];
    const unchangedFiles = [];
    const skippedFiles = [];
    const prunedFiles = [];

    for (const relativePath of selected) {
      const localPath = projectFilePath(projectRoot, relativePath);
      if (!fs.existsSync(localPath)) {
        if (options.prune === true) {
          const entry = manifest.files[relativePath];
          if (entry) fs.rmSync(storagePath(vaultDir, entry.storageKey), { force: true });
          delete manifest.files[relativePath];
          manifest.selectedFiles = manifest.selectedFiles.filter((item) => item !== relativePath);
          prunedFiles.push(relativePath);
        } else {
          skippedFiles.push(relativePath);
        }
        continue;
      }
      const local = readRegularFile(localPath, {
        maxBytes: options.maxBytes || DEFAULT_MAX_FILE_BYTES
      });
      if (!manifest.selectedFiles.includes(relativePath)) {
        manifest.selectedFiles = uniqueSorted([...manifest.selectedFiles, relativePath]);
      }
      const result = storeBuffer(vaultDir, manifest, relativePath, local);
      (result.changed ? changedFiles : unchangedFiles).push(relativePath);
    }

    writeManifest(vaultDir, manifest);
    return {
      ok: true,
      fingerprint: identity.fingerprint,
      syncedFiles: selected.filter((item) => !skippedFiles.includes(item)),
      changedFiles,
      unchangedFiles,
      skippedFiles,
      prunedFiles,
      updated: changedFiles.length > 0 || prunedFiles.length > 0
    };
  });
}

export function vaultRestoreProject(projectDir = '.', options = {}) {
  const { identity, projectRoot, vaultDir } = contextFor(projectDir, options);
  if (!fs.existsSync(path.join(vaultDir, 'manifest.json'))) {
    return {
      ok: false,
      fingerprint: identity.fingerprint,
      reason: `No Environment Vault found for project fingerprint: ${identity.fingerprint}`,
      restoredFiles: [],
      conflicts: [],
      backups: []
    };
  }

  const manifest = readManifest(vaultDir);
  const selected = requestedFiles(projectRoot, manifest, options);
  const restoredFiles = [];
  const unchangedFiles = [];
  const conflicts = [];
  const backups = [];
  const group = backupGroup();

  for (const relativePath of selected) {
    const entry = manifest.files[relativePath];
    if (!entry) {
      conflicts.push({ file: relativePath, reason: 'MISSING_VAULT' });
      continue;
    }
    const stored = readStoredFile(vaultDir, entry, options.maxBytes || DEFAULT_MAX_FILE_BYTES);
    const result = restoreBuffer(projectRoot, relativePath, stored, options, group);
    if (result.restored) restoredFiles.push(relativePath);
    if (result.unchanged) unchangedFiles.push(relativePath);
    if (result.conflict) conflicts.push(result.conflict);
    if (result.backup) backups.push(result.backup);
  }

  return {
    ok: conflicts.length === 0,
    fingerprint: identity.fingerprint,
    restoredFiles,
    unchangedFiles,
    conflicts,
    backups
  };
}

export function vaultGetStatus(projectDir = '.', options = {}) {
  let context;
  try {
    context = contextFor(projectDir, options);
  } catch (error) {
    return { linked: false, healthy: false, error: error.message, diffs: [] };
  }
  const { identity, projectRoot, vaultDir } = context;
  if (!fs.existsSync(path.join(vaultDir, 'manifest.json'))) {
    return {
      linked: false,
      healthy: true,
      fingerprint: identity.fingerprint,
      canonical: identity.canonical,
      projectName: identity.projectName,
      projectRoot,
      diffs: []
    };
  }

  let manifest;
  try {
    manifest = readManifest(vaultDir);
  } catch (error) {
    return {
      linked: true,
      healthy: false,
      fingerprint: identity.fingerprint,
      projectRoot,
      error: error.message,
      diffs: [{ file: 'manifest.json', status: 'UNHEALTHY' }]
    };
  }

  const linked = manifest.linkedPaths.includes(projectRoot) && !manifest.detachedPaths.includes(projectRoot);
  const diffs = [];
  for (const relativePath of manifest.selectedFiles) {
    const entry = manifest.files[relativePath];
    if (!entry || !fs.existsSync(storagePath(vaultDir, entry.storageKey))) {
      diffs.push({ file: relativePath, status: 'MISSING_VAULT' });
      continue;
    }
    const localPath = projectFilePath(projectRoot, relativePath);
    if (!fs.existsSync(localPath)) {
      diffs.push({ file: relativePath, status: 'MISSING_LOCAL' });
      continue;
    }
    try {
      const local = readRegularFile(localPath, { maxBytes: options.maxBytes || DEFAULT_MAX_FILE_BYTES });
      const stored = readStoredFile(vaultDir, entry, options.maxBytes || DEFAULT_MAX_FILE_BYTES);
      if (local.sha256 !== stored.sha256) {
        diffs.push({ file: relativePath, status: 'MODIFIED_LOCAL' });
      } else if (process.platform !== 'win32' && ((ownerMode(localPath) !== 0o600) || (ownerMode(storagePath(vaultDir, entry.storageKey)) !== 0o600))) {
        diffs.push({ file: relativePath, status: 'PERMISSION_DRIFT' });
      } else {
        diffs.push({ file: relativePath, status: 'IN_SYNC' });
      }
    } catch (error) {
      diffs.push({ file: relativePath, status: 'UNHEALTHY', reason: error.message });
    }
  }

  return {
    linked,
    healthy: diffs.every((item) => item.status !== 'UNHEALTHY' && item.status !== 'MISSING_VAULT'),
    fingerprint: identity.fingerprint,
    canonical: manifest.identity.canonical,
    gitRemote: identity.gitRemote,
    projectName: manifest.projectName,
    projectRoot,
    lastKnownPath: manifest.lastKnownPath,
    lastSyncedAt: manifest.updatedAt,
    vaultDir,
    diffs
  };
}

export function vaultListProjects() {
  const root = vaultRoot();
  if (!fs.existsSync(root)) return [];
  const projects = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^[a-f0-9]{64}$/u.test(entry.name)) continue;
    const vaultDir = path.join(root, entry.name);
    try {
      const manifest = readManifest(vaultDir);
      projects.push({
        fingerprint: manifest.fingerprint,
        projectName: manifest.projectName,
        canonical: manifest.identity.canonical,
        lastKnownPath: manifest.lastKnownPath,
        lastSyncedAt: manifest.updatedAt,
        linkedPaths: manifest.linkedPaths,
        files: [...manifest.selectedFiles],
        healthy: true
      });
    } catch (error) {
      projects.push({ fingerprint: entry.name, healthy: false, error: error.message });
    }
  }
  return projects.sort((a, b) => String(a.projectName || a.fingerprint).localeCompare(String(b.projectName || b.fingerprint)));
}

export function vaultUnlinkProject(projectDir = '.', options = {}) {
  const { identity, projectRoot, vaultDir } = contextFor(projectDir, options);
  if (!fs.existsSync(path.join(vaultDir, 'manifest.json'))) {
    return { ok: false, fingerprint: identity.fingerprint, reason: 'Project is not linked in Environment Vault' };
  }
  return withVaultLock(vaultDir, 'unlink', () => {
    const manifest = readManifest(vaultDir);
    manifest.linkedPaths = manifest.linkedPaths.filter((item) => item !== projectRoot);
    manifest.detachedPaths = uniqueSorted([...manifest.detachedPaths, projectRoot]);
    writeManifest(vaultDir, manifest);
    return { ok: true, fingerprint: identity.fingerprint, retained: true };
  });
}

export function vaultPurgeProject(projectDir = '.', options = {}) {
  if (options.confirm !== true) throw new Error('Environment Vault purge requires --yes');
  const { identity, vaultDir } = contextFor(projectDir, options);
  if (!fs.existsSync(vaultDir)) return { ok: false, fingerprint: identity.fingerprint, reason: 'Vault does not exist' };
  fs.rmSync(vaultDir, { recursive: true, force: true });
  return { ok: true, fingerprint: identity.fingerprint, purged: true };
}

export function vaultDoctor(projectDir = '.', options = {}) {
  const { identity, projectRoot, vaultDir } = contextFor(projectDir, options);
  const issues = [];
  const repairs = [];
  if (!fs.existsSync(vaultDir)) {
    return { ok: false, fingerprint: identity.fingerprint, issues: [{ code: 'MISSING_VAULT', message: 'Vault does not exist' }], repairs };
  }

  let manifest;
  try {
    manifest = readManifest(vaultDir);
  } catch (error) {
    return { ok: false, fingerprint: identity.fingerprint, issues: [{ code: 'INVALID_MANIFEST', message: error.message }], repairs };
  }

  if (process.platform !== 'win32') {
    for (const directory of [vaultRoot(), vaultDir, path.join(vaultDir, 'files'), path.join(vaultDir, 'revisions')]) {
      if (fs.existsSync(directory) && ownerMode(directory) !== 0o700) {
        issues.push({ code: 'DIRECTORY_PERMISSION_DRIFT', path: directory });
        if (options.repairPermissions === true) {
          fs.chmodSync(directory, 0o700);
          repairs.push({ code: 'DIRECTORY_PERMISSION_REPAIRED', path: directory });
        }
      }
    }
    const protectedFiles = [path.join(vaultDir, 'manifest.json')];
    for (const relativePath of manifest.selectedFiles) {
      const entry = manifest.files[relativePath];
      if (entry) protectedFiles.push(storagePath(vaultDir, entry.storageKey));
    }
    for (const file of protectedFiles) {
      if (fs.existsSync(file) && ownerMode(file) !== 0o600) {
        issues.push({ code: 'FILE_PERMISSION_DRIFT', path: file });
        if (options.repairPermissions === true) {
          fs.chmodSync(file, 0o600);
          repairs.push({ code: 'FILE_PERMISSION_REPAIRED', path: file });
        }
      }
    }
  }

  for (const relativePath of manifest.selectedFiles) {
    const entry = manifest.files[relativePath];
    if (!entry || !fs.existsSync(storagePath(vaultDir, entry.storageKey))) {
      issues.push({ code: 'MISSING_VAULT_FILE', file: relativePath });
    }
  }

  const remainingIssues = options.repairPermissions === true
    ? issues.filter((issue) => !['DIRECTORY_PERMISSION_DRIFT', 'FILE_PERMISSION_DRIFT'].includes(issue.code))
    : issues;
  return {
    ok: remainingIssues.length === 0,
    fingerprint: identity.fingerprint,
    projectRoot,
    issues,
    repairs
  };
}

export function vaultHistory(projectDir = '.', options = {}) {
  const { projectRoot, vaultDir } = contextFor(projectDir, options);
  const manifest = readManifest(vaultDir);
  const files = requestedFiles(projectRoot, manifest, options);
  return files.map((file) => ({
    file,
    revisions: [...(manifest.files[file]?.history || [])].reverse()
  }));
}

export function vaultRestoreRevision(projectDir = '.', options = {}) {
  const file = normalizeRequestedFiles(path.resolve(projectDir), options.file)?.[0];
  if (!file) throw new Error('Revision restore requires --file');
  if (!options.revision) throw new Error('Revision restore requires --revision');
  const { projectRoot, vaultDir } = contextFor(projectDir, options);
  const manifest = readManifest(vaultDir);
  const entry = manifest.files[file];
  const revision = entry?.history?.find((item) => item.id === options.revision);
  if (!revision) throw new Error(`Revision not found for ${file}: ${options.revision}`);
  const stored = readRegularFile(revisionPath(vaultDir, revision.id, revision.storageKey), {
    maxBytes: options.maxBytes || DEFAULT_MAX_FILE_BYTES
  });
  const result = restoreBuffer(projectRoot, file, stored, options, backupGroup());
  return {
    ok: !result.conflict,
    restoredFiles: result.restored ? [file] : [],
    unchangedFiles: result.unchanged ? [file] : [],
    conflicts: result.conflict ? [result.conflict] : [],
    backups: result.backup ? [result.backup] : [],
    revision: revision.id
  };
}

export function vaultIsLinkedFile(projectDir = '.', filePath, options = {}) {
  try {
    const { projectRoot, vaultDir } = contextFor(projectDir, options);
    const manifest = readManifest(vaultDir);
    if (!manifest.linkedPaths.includes(projectRoot) || manifest.detachedPaths.includes(projectRoot)) return false;
    const relative = normalizeRequestedFiles(projectRoot, [filePath])?.[0];
    return Boolean(relative && manifest.selectedFiles.includes(relative));
  } catch {
    return false;
  }
}

function legacyCanonicalSource(projectRoot) {
  const remote = gitRemoteUrl(projectRoot);
  if (remote) return remote.toLowerCase().replace(/\.git$/u, '').trim();
  const commit = initialCommitHash(projectRoot);
  if (commit) return `commit:${commit}:${path.basename(projectRoot)}`;
  return `path:${path.resolve(projectRoot)}`;
}

function findLegacyVault(identity) {
  const legacyRoot = path.join(kernelHome(), 'vault', 'env-mirrors');
  if (!fs.existsSync(legacyRoot)) return null;
  const directName = `env_vault_${sha256(legacyCanonicalSource(identity.projectRoot)).slice(0, 16)}`;
  const direct = path.join(legacyRoot, directName);
  if (fs.existsSync(path.join(direct, 'metadata.json'))) return direct;

  for (const entry of fs.readdirSync(legacyRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(legacyRoot, entry.name);
    try {
      const metadata = JSON.parse(fs.readFileSync(path.join(candidate, 'metadata.json'), 'utf8'));
      if (metadata.gitRemote && canonicalizeRemote(metadata.gitRemote) === identity.canonical) return candidate;
    } catch {
      // Ignore malformed legacy entries and continue searching
    }
  }
  return null;
}

export function vaultMigrateLegacyProject(projectDir = '.', options = {}) {
  const { identity, projectRoot, vaultDir } = contextFor(projectDir, options);
  if (fs.existsSync(path.join(vaultDir, 'manifest.json'))) {
    return { ok: true, migrated: false, reason: 'Project already uses Environment Vault v2', vaultDir };
  }
  const legacyDir = findLegacyVault(identity);
  if (!legacyDir) return { ok: false, migrated: false, reason: 'No matching legacy Environment Vault found' };

  const metadata = JSON.parse(fs.readFileSync(path.join(legacyDir, 'metadata.json'), 'utf8'));
  const selectedFiles = uniqueSorted(Object.keys(metadata.files || {}).map(normalizeRelativePath));
  ensureVaultLayout(vaultDir);
  const backupDir = path.join(kernelHome(), 'vault', 'legacy-backups', `${path.basename(legacyDir)}-${backupGroup()}`);
  ensureDirectorySecure(path.dirname(backupDir));
  fs.cpSync(legacyDir, backupDir, { recursive: true, errorOnExist: true });
  if (process.platform !== 'win32') {
    fs.chmodSync(backupDir, 0o700);
    for (const file of selectedFiles) {
      const copied = path.join(backupDir, ...file.split('/'));
      if (fs.existsSync(copied)) fs.chmodSync(copied, 0o600);
    }
  }

  return withVaultLock(vaultDir, 'migrate', () => {
    const manifest = createManifest(identity);
    manifest.selectedFiles = selectedFiles;
    linkPath(manifest, projectRoot);
    const migratedFiles = [];
    for (const relativePath of selectedFiles) {
      const source = path.join(legacyDir, ...relativePath.split('/'));
      if (!fs.existsSync(source)) continue;
      const file = readRegularFile(source, { maxBytes: options.maxBytes || DEFAULT_MAX_FILE_BYTES });
      storeBuffer(vaultDir, manifest, relativePath, file);
      migratedFiles.push(relativePath);
    }
    writeManifest(vaultDir, manifest);
    return { ok: true, migrated: true, migratedFiles, legacyDir, backupDir, vaultDir };
  });
}
