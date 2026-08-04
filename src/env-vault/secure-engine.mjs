import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_MAX_FILE_BYTES,
  projectFilePath,
  vaultRoot
} from './common.mjs';
import { normalizeRequestedFiles } from './discovery.mjs';
import * as engine from './engine.mjs';
import { calculateProjectIdentity } from './identity.mjs';
import { readManifest } from './manifest.mjs';
import { readRegularFile, withVaultLock } from './storage.mjs';

function vaultContext(projectDir, options = {}) {
  const identity = calculateProjectIdentity(projectDir, {
    allowPathIdentity: options.allowPathIdentity === true
  });
  return {
    identity,
    projectRoot: identity.projectRoot,
    vaultDir: path.join(vaultRoot(), identity.fingerprint)
  };
}

function manifestPath(vaultDir) {
  return path.join(vaultDir, 'manifest.json');
}

function currentStoragePath(vaultDir, entry) {
  return path.join(vaultDir, 'files', entry.storageKey);
}

function requestedFiles(projectRoot, manifest, options = {}) {
  return normalizeRequestedFiles(projectRoot, options.files || options.file) || [...manifest.selectedFiles];
}

function pathIsAttached(manifest, projectRoot) {
  return manifest.linkedPaths.includes(projectRoot) && !manifest.detachedPaths.includes(projectRoot);
}

function blockedSync(identity, reason, dryRun = false) {
  return {
    ok: false,
    dryRun,
    fingerprint: identity.fingerprint,
    reason,
    syncedFiles: [],
    changedFiles: [],
    unchangedFiles: [],
    skippedFiles: [],
    prunedFiles: [],
    updated: false
  };
}

function assertHash(file, expected, label) {
  if (!expected || file.sha256 !== expected) {
    throw new Error(`Environment Vault integrity check failed for ${label}`);
  }
}

function revisionRecord(entry, revisionId = entry?.revision) {
  const revision = entry?.history?.find((item) => item.id === revisionId);
  if (!revision) throw new Error(`Environment Vault revision metadata is missing: ${revisionId || 'unknown'}`);
  return revision;
}

function verifyRevision(vaultDir, entry, revision, maxBytes) {
  const revisionFile = readRegularFile(
    path.join(vaultDir, 'revisions', revision.id, revision.storageKey),
    { maxBytes }
  );
  assertHash(revisionFile, revision.sha256, `revision ${revision.id}`);
  return revisionFile;
}

function verifyCurrentEntry(vaultDir, relativePath, entry, maxBytes) {
  if (!entry) throw new Error(`Environment Vault file entry is missing: ${relativePath}`);
  const current = readRegularFile(currentStoragePath(vaultDir, entry), { maxBytes });
  assertHash(current, entry.sha256, `current file ${relativePath}`);
  const revision = revisionRecord(entry);
  const historical = verifyRevision(vaultDir, entry, revision, maxBytes);
  assertHash(historical, entry.sha256, `referenced revision ${revision.id}`);
}

function integrityIssues(vaultDir, manifest, files, maxBytes) {
  const issues = [];
  for (const relativePath of files) {
    try {
      verifyCurrentEntry(vaultDir, relativePath, manifest.files[relativePath], maxBytes);
    } catch (error) {
      issues.push({
        code: 'VAULT_INTEGRITY_ERROR',
        file: relativePath,
        message: error.message
      });
    }
  }
  return issues;
}

function planSync(identity, projectRoot, vaultDir, manifest, options) {
  const selected = requestedFiles(projectRoot, manifest, options);
  const changedFiles = [];
  const unchangedFiles = [];
  const skippedFiles = [];
  const prunedFiles = [];
  const maxBytes = options.maxBytes || DEFAULT_MAX_FILE_BYTES;

  for (const relativePath of selected) {
    const localPath = projectFilePath(projectRoot, relativePath);
    if (!fs.existsSync(localPath)) {
      if (options.prune === true && manifest.files[relativePath]) prunedFiles.push(relativePath);
      else skippedFiles.push(relativePath);
      continue;
    }
    const local = readRegularFile(localPath, { maxBytes });
    const entry = manifest.files[relativePath];
    const currentExists = Boolean(entry && fs.existsSync(currentStoragePath(vaultDir, entry)));
    if (!entry || !currentExists || entry.sha256 !== local.sha256) changedFiles.push(relativePath);
    else unchangedFiles.push(relativePath);
  }

  return {
    ok: true,
    dryRun: true,
    fingerprint: identity.fingerprint,
    syncedFiles: selected.filter((item) => !skippedFiles.includes(item)),
    changedFiles,
    unchangedFiles,
    skippedFiles,
    prunedFiles,
    updated: changedFiles.length > 0 || prunedFiles.length > 0
  };
}

function planRestore(identity, projectRoot, vaultDir, manifest, selected, options) {
  const maxBytes = options.maxBytes || DEFAULT_MAX_FILE_BYTES;
  const wouldRestore = [];
  const wouldBackup = [];
  const unchangedFiles = [];
  const conflicts = [];

  for (const relativePath of selected) {
    const entry = manifest.files[relativePath];
    if (!entry) {
      conflicts.push({ file: relativePath, reason: 'MISSING_VAULT' });
      continue;
    }
    const stored = readRegularFile(currentStoragePath(vaultDir, entry), { maxBytes });
    const localPath = projectFilePath(projectRoot, relativePath);
    if (!fs.existsSync(localPath)) {
      wouldRestore.push(relativePath);
      continue;
    }
    const local = readRegularFile(localPath, { maxBytes });
    if (local.sha256 === stored.sha256) {
      unchangedFiles.push(relativePath);
      continue;
    }
    if (options.force !== true) {
      conflicts.push({
        file: relativePath,
        localSha256: local.sha256,
        vaultSha256: stored.sha256
      });
      continue;
    }
    wouldRestore.push(relativePath);
    if (options.noBackup !== true) wouldBackup.push(relativePath);
  }

  return {
    ok: conflicts.length === 0,
    dryRun: true,
    fingerprint: identity.fingerprint,
    wouldRestore,
    wouldBackup,
    unchangedFiles,
    conflicts,
    restoredFiles: [],
    backups: []
  };
}

export const vaultLinkProject = engine.vaultLinkProject;
export const vaultListProjects = engine.vaultListProjects;
export const vaultMigrateLegacyProject = engine.vaultMigrateLegacyProject;
export const vaultPurgeProject = engine.vaultPurgeProject;
export const vaultUnlinkProject = engine.vaultUnlinkProject;
export const vaultHistory = engine.vaultHistory;
export const vaultIsLinkedFile = engine.vaultIsLinkedFile;

export function vaultSyncProject(projectDir = '.', options = {}) {
  const { identity, projectRoot, vaultDir } = vaultContext(projectDir, options);
  if (!fs.existsSync(manifestPath(vaultDir))) {
    return blockedSync(
      identity,
      'Project is not linked to Environment Vault. Run agent-kernel env link first.',
      options.dryRun === true
    );
  }
  const manifest = readManifest(vaultDir);
  if (!pathIsAttached(manifest, projectRoot)) {
    return blockedSync(
      identity,
      'Project path is detached from Environment Vault. Run agent-kernel env link first.',
      options.dryRun === true
    );
  }
  if (options.dryRun === true) return planSync(identity, projectRoot, vaultDir, manifest, options);
  return engine.vaultSyncProject(projectRoot, options);
}

export function vaultRestoreProject(projectDir = '.', options = {}) {
  const { identity, projectRoot, vaultDir } = vaultContext(projectDir, options);
  if (!fs.existsSync(manifestPath(vaultDir))) return engine.vaultRestoreProject(projectRoot, options);

  if (options.dryRun === true) {
    const manifest = readManifest(vaultDir);
    const selected = requestedFiles(projectRoot, manifest, options);
    const maxBytes = options.maxBytes || DEFAULT_MAX_FILE_BYTES;
    const issues = integrityIssues(vaultDir, manifest, selected, maxBytes);
    if (issues.length) throw new Error(issues.map((issue) => issue.message).join('; '));
    return planRestore(identity, projectRoot, vaultDir, manifest, selected, options);
  }

  let selected = [];
  const maxBytes = options.maxBytes || DEFAULT_MAX_FILE_BYTES;
  const result = withVaultLock(vaultDir, 'pull', () => {
    const manifest = readManifest(vaultDir);
    selected = requestedFiles(projectRoot, manifest, options);
    const issues = integrityIssues(vaultDir, manifest, selected, maxBytes);
    if (issues.length) throw new Error(issues.map((issue) => issue.message).join('; '));
    return engine.vaultRestoreProject(projectRoot, { ...options, files: selected });
  });
  if (result.ok) engine.vaultSyncProject(projectRoot, { files: selected, maxBytes });
  return result;
}

export function vaultRestoreRevision(projectDir = '.', options = {}) {
  const { projectRoot, vaultDir } = vaultContext(projectDir, options);
  return withVaultLock(vaultDir, 'restore-revision', () => {
    const manifest = readManifest(vaultDir);
    const file = normalizeRequestedFiles(projectRoot, options.file)?.[0];
    if (!file) throw new Error('Revision restore requires --file');
    if (!options.revision) throw new Error('Revision restore requires --revision');
    const entry = manifest.files[file];
    const revision = revisionRecord(entry, options.revision);
    verifyRevision(vaultDir, entry, revision, options.maxBytes || DEFAULT_MAX_FILE_BYTES);
    return engine.vaultRestoreRevision(projectRoot, options);
  });
}

export function vaultGetStatus(projectDir = '.', options = {}) {
  const status = engine.vaultGetStatus(projectDir, options);
  if (!status.fingerprint || !status.vaultDir || !fs.existsSync(manifestPath(status.vaultDir))) return status;
  try {
    const manifest = readManifest(status.vaultDir);
    const effectiveStatus = {
      ...status,
      linked: !manifest.detachedPaths.includes(status.projectRoot)
    };
    const issues = integrityIssues(
      status.vaultDir,
      manifest,
      manifest.selectedFiles,
      options.maxBytes || DEFAULT_MAX_FILE_BYTES
    );
    if (!issues.length) return effectiveStatus;
    return {
      ...effectiveStatus,
      healthy: false,
      diffs: [
        ...(effectiveStatus.diffs || []),
        ...issues.map((issue) => ({ file: issue.file, status: 'UNHEALTHY', reason: issue.message }))
      ]
    };
  } catch (error) {
    return {
      ...status,
      healthy: false,
      error: error.message,
      diffs: [...(status.diffs || []), { file: 'manifest.json', status: 'UNHEALTHY', reason: error.message }]
    };
  }
}

export function vaultDoctor(projectDir = '.', options = {}) {
  const result = engine.vaultDoctor(projectDir, options);
  if (!result.fingerprint) return result;
  try {
    const { vaultDir } = vaultContext(projectDir, options);
    if (!fs.existsSync(manifestPath(vaultDir))) return result;
    const manifest = readManifest(vaultDir);
    const issues = integrityIssues(
      vaultDir,
      manifest,
      manifest.selectedFiles,
      options.maxBytes || DEFAULT_MAX_FILE_BYTES
    );
    return {
      ...result,
      ok: result.ok && issues.length === 0,
      issues: [...(result.issues || []), ...issues]
    };
  } catch (error) {
    return {
      ...result,
      ok: false,
      issues: [...(result.issues || []), { code: 'VAULT_INTEGRITY_ERROR', message: error.message }]
    };
  }
}
