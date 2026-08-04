import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  DEFAULT_MAX_FILE_BYTES,
  ensureDirectorySecure,
  repairFileMode,
  sha256
} from './common.mjs';

export function readRegularFile(filePath, options = {}) {
  const maxBytes = Number(options.maxBytes || DEFAULT_MAX_FILE_BYTES);
  const stat = fs.lstatSync(filePath);
  if (stat.isSymbolicLink()) throw new Error(`Refusing symlink environment file: ${filePath}`);
  if (!stat.isFile()) throw new Error(`Environment path is not a regular file: ${filePath}`);
  if (stat.size > maxBytes) throw new Error(`Environment file exceeds ${maxBytes} bytes: ${filePath}`);

  const flags = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0);
  const descriptor = fs.openSync(filePath, flags);
  try {
    const opened = fs.fstatSync(descriptor);
    if (!opened.isFile()) throw new Error(`Environment path is not a regular file: ${filePath}`);
    if (opened.size > maxBytes) throw new Error(`Environment file exceeds ${maxBytes} bytes: ${filePath}`);
    const content = fs.readFileSync(descriptor);
    return {
      content,
      sha256: sha256(content),
      sizeBytes: content.length,
      mode: opened.mode & 0o777
    };
  } finally {
    fs.closeSync(descriptor);
  }
}

function syncDirectory(directory) {
  if (process.platform === 'win32') return;
  let descriptor;
  try {
    descriptor = fs.openSync(directory, fs.constants.O_RDONLY);
    fs.fsyncSync(descriptor);
  } catch {
    // Some filesystems do not permit directory fsync
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

export function atomicWriteFile(targetPath, content, options = {}) {
  const mode = Number(options.mode || 0o600);
  const directory = ensureDirectorySecure(path.dirname(targetPath));

  if (fs.existsSync(targetPath)) {
    const current = fs.lstatSync(targetPath);
    if (current.isSymbolicLink()) throw new Error(`Refusing to replace symlink: ${targetPath}`);
    if (!current.isFile()) throw new Error(`Refusing to replace non-regular file: ${targetPath}`);
  }

  const temporary = path.join(
    directory,
    `.${path.basename(targetPath)}.tmp-${process.pid}-${crypto.randomBytes(6).toString('hex')}`
  );
  let descriptor;
  try {
    descriptor = fs.openSync(
      temporary,
      fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY,
      mode
    );
    fs.writeFileSync(descriptor, content);
    fs.fsyncSync(descriptor);
    if (process.platform !== 'win32') fs.fchmodSync(descriptor, mode);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporary, targetPath);
    repairFileMode(targetPath, mode);
    syncDirectory(directory);
    return targetPath;
  } catch (error) {
    if (descriptor !== undefined) {
      try { fs.closeSync(descriptor); } catch {}
    }
    try { fs.rmSync(temporary, { force: true }); } catch {}
    throw error;
  }
}

export function atomicWriteJson(targetPath, value) {
  return atomicWriteFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code !== 'ESRCH';
  }
}

function readLock(lockPath) {
  try {
    return JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  } catch {
    return null;
  }
}

export function withVaultLock(vaultDir, command, fn, options = {}) {
  ensureDirectorySecure(vaultDir);
  const lockPath = path.join(vaultDir, '.lock');
  const timeoutMs = Number(options.timeoutMs || 5 * 60 * 1000);
  const nonce = crypto.randomBytes(12).toString('hex');
  const payload = {
    pid: process.pid,
    host: os.hostname(),
    command: String(command || 'unknown'),
    createdAt: new Date().toISOString(),
    nonce
  };

  const acquire = () => {
    try {
      const descriptor = fs.openSync(lockPath, 'wx', 0o600);
      fs.writeFileSync(descriptor, `${JSON.stringify(payload)}\n`);
      fs.fsyncSync(descriptor);
      if (process.platform !== 'win32') fs.fchmodSync(descriptor, 0o600);
      fs.closeSync(descriptor);
      return;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const existing = readLock(lockPath);
      const createdAt = Date.parse(existing?.createdAt || '');
      const stale = Number.isFinite(createdAt) && Date.now() - createdAt > timeoutMs;
      const sameHost = existing?.host === os.hostname();
      if (stale && sameHost && !processIsAlive(Number(existing?.pid))) {
        fs.rmSync(lockPath, { force: true });
        return acquire();
      }
      throw new Error(`Environment Vault is locked by ${existing?.command || 'another process'}`);
    }
  };

  acquire();
  try {
    return fn();
  } finally {
    const existing = readLock(lockPath);
    if (existing?.nonce === nonce) fs.rmSync(lockPath, { force: true });
  }
}
