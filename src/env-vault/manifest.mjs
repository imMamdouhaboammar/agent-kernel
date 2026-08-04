import fs from 'node:fs';
import path from 'node:path';
import {
  MANIFEST_VERSION,
  normalizeRelativePath,
  nowIso,
  uniqueSorted
} from './common.mjs';
import { atomicWriteJson, readRegularFile } from './storage.mjs';

const HASH_PATTERN = /^[a-f0-9]{64}$/u;
const REVISION_PATTERN = /^[A-Za-z0-9-]{8,96}$/u;

export function manifestPath(vaultDir) {
  return path.join(vaultDir, 'manifest.json');
}

function validateHistory(history, file) {
  if (!Array.isArray(history)) throw new Error(`Vault manifest history is invalid for ${file}`);
  return history.map((revision) => {
    if (!revision || typeof revision !== 'object') throw new Error(`Vault manifest revision is invalid for ${file}`);
    if (!REVISION_PATTERN.test(String(revision.id || ''))) throw new Error(`Vault manifest revision ID is invalid for ${file}`);
    if (!HASH_PATTERN.test(String(revision.sha256 || ''))) throw new Error(`Vault manifest revision hash is invalid for ${file}`);
    return {
      id: revision.id,
      sha256: revision.sha256,
      sizeBytes: Number(revision.sizeBytes || 0),
      createdAt: String(revision.createdAt || ''),
      storageKey: String(revision.storageKey || '')
    };
  });
}

export function validateManifest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Vault manifest must be an object');
  if (input.version !== MANIFEST_VERSION) throw new Error(`Unsupported Environment Vault manifest version: ${input.version}`);
  if (!HASH_PATTERN.test(String(input.fingerprint || ''))) throw new Error('Vault manifest fingerprint is invalid');
  if (!input.identity || !['remote', 'commit', 'path'].includes(input.identity.source)) {
    throw new Error('Vault manifest identity is invalid');
  }
  if (typeof input.identity.canonical !== 'string' || !input.identity.canonical) {
    throw new Error('Vault manifest canonical identity is invalid');
  }

  const selectedFiles = uniqueSorted((input.selectedFiles || []).map(normalizeRelativePath));
  const fileEntries = input.files && typeof input.files === 'object' && !Array.isArray(input.files)
    ? input.files
    : {};
  const files = {};
  const normalizedKeys = new Set();

  for (const [rawPath, rawEntry] of Object.entries(fileEntries)) {
    const file = normalizeRelativePath(rawPath);
    if (normalizedKeys.has(file)) throw new Error(`Vault manifest contains duplicate file path: ${file}`);
    normalizedKeys.add(file);
    if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) {
      throw new Error(`Vault manifest file entry is invalid for ${file}`);
    }
    if (!HASH_PATTERN.test(String(rawEntry.sha256 || ''))) throw new Error(`Vault manifest hash is invalid for ${file}`);
    if (typeof rawEntry.storageKey !== 'string' || !rawEntry.storageKey) {
      throw new Error(`Vault manifest storage key is invalid for ${file}`);
    }
    files[file] = {
      storageKey: rawEntry.storageKey,
      sha256: rawEntry.sha256,
      sizeBytes: Number(rawEntry.sizeBytes || 0),
      mode: String(rawEntry.mode || '0600'),
      updatedAt: String(rawEntry.updatedAt || ''),
      revision: String(rawEntry.revision || ''),
      history: validateHistory(rawEntry.history || [], file)
    };
  }

  return {
    version: MANIFEST_VERSION,
    fingerprint: input.fingerprint,
    identity: {
      source: input.identity.source,
      canonical: input.identity.canonical
    },
    projectName: String(input.projectName || ''),
    lastKnownPath: String(input.lastKnownPath || ''),
    createdAt: String(input.createdAt || ''),
    updatedAt: String(input.updatedAt || ''),
    linkedPaths: uniqueSorted((input.linkedPaths || []).map(String)),
    detachedPaths: uniqueSorted((input.detachedPaths || []).map(String)),
    selectedFiles,
    files
  };
}

export function createManifest(identity) {
  const timestamp = nowIso();
  return {
    version: MANIFEST_VERSION,
    fingerprint: identity.fingerprint,
    identity: {
      source: identity.source,
      canonical: identity.canonical
    },
    projectName: identity.projectName,
    lastKnownPath: identity.projectRoot,
    createdAt: timestamp,
    updatedAt: timestamp,
    linkedPaths: [identity.projectRoot],
    detachedPaths: [],
    selectedFiles: [],
    files: {}
  };
}

export function readManifest(vaultDir, options = {}) {
  const file = manifestPath(vaultDir);
  if (!fs.existsSync(file)) {
    if (options.allowMissing === true) return null;
    throw new Error('No Environment Vault manifest found for this project');
  }
  let parsed;
  try {
    parsed = JSON.parse(readRegularFile(file, { maxBytes: 2 * 1024 * 1024 }).content.toString('utf8'));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('Environment Vault manifest is corrupt JSON');
    throw error;
  }
  return validateManifest(parsed);
}

export function writeManifest(vaultDir, manifest) {
  const validated = validateManifest(manifest);
  validated.updatedAt = nowIso();
  atomicWriteJson(manifestPath(vaultDir), validated);
  return validated;
}
