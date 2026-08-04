import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const DEFAULT_MAX_FILE_BYTES = 1024 * 1024;
export const MANIFEST_VERSION = 2;

export function kernelHome() {
  return process.env.AGENT_KERNEL_HOME || path.join(os.homedir(), '.agent-kernel');
}

export function vaultRoot() {
  return path.join(kernelHome(), 'vault', 'env');
}

export function nowIso() {
  return new Date().toISOString();
}

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function ensureDirectorySecure(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') fs.chmodSync(directory, 0o700);
  return directory;
}

export function normalizeRelativePath(value) {
  const raw = String(value || '').trim().replace(/\\/g, '/');
  if (!raw || raw.includes('\0')) throw new Error('Environment file path is empty or invalid');
  if (path.posix.isAbsolute(raw) || /^[A-Za-z]:\//u.test(raw)) {
    throw new Error(`Environment file path must be relative: ${raw}`);
  }
  const normalized = path.posix.normalize(raw).replace(/^\.\//u, '');
  if (!normalized || normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
    throw new Error(`Environment file path escapes the project root: ${raw}`);
  }
  return normalized;
}

function containedRelativePath(projectRoot, absolutePath, originalValue) {
  const root = path.resolve(projectRoot);
  const absolute = path.resolve(absolutePath);
  const relative = path.relative(root, absolute);
  if (!relative || relative === '.') throw new Error('Environment file path must identify a file');
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Environment file path escapes the project root: ${originalValue}`);
  }
  return { root, absolute, relative };
}

export function assertNoSymlinkComponents(projectRoot, absolutePath) {
  const { root, absolute, relative } = containedRelativePath(projectRoot, absolutePath, absolutePath);
  let current = root;
  for (const component of relative.split(path.sep)) {
    current = path.join(current, component);
    if (!fs.existsSync(current)) break;
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) {
      throw new Error(`Refusing environment path through symlinked component: ${current}`);
    }
  }
  return absolute;
}

export function projectRelativePath(projectRoot, value) {
  const root = path.resolve(projectRoot);
  const absolute = path.isAbsolute(String(value || ''))
    ? path.resolve(String(value))
    : path.resolve(root, ...normalizeRelativePath(value).split('/'));
  const { relative } = containedRelativePath(root, absolute, value);
  assertNoSymlinkComponents(root, absolute);
  return relative.split(path.sep).join('/');
}

export function projectFilePath(projectRoot, relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  const root = path.resolve(projectRoot);
  const absolute = path.resolve(root, ...normalized.split('/'));
  containedRelativePath(root, absolute, relativePath);
  return assertNoSymlinkComponents(root, absolute);
}

export function encodeStorageKey(relativePath) {
  return Buffer.from(normalizeRelativePath(relativePath), 'utf8').toString('base64url');
}

export function decodeStorageKey(storageKey) {
  const decoded = Buffer.from(String(storageKey || ''), 'base64url').toString('utf8');
  return normalizeRelativePath(decoded);
}

export function ownerMode(filePath) {
  return fs.statSync(filePath).mode & 0o777;
}

export function repairFileMode(filePath, mode = 0o600) {
  if (process.platform !== 'win32') fs.chmodSync(filePath, mode);
}

export function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function revisionId(hash) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/gu, '').slice(0, 14);
  return `${stamp}-${String(hash).slice(0, 12)}-${crypto.randomBytes(3).toString('hex')}`;
}
