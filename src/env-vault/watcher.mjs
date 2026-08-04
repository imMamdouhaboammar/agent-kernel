import fs from 'node:fs';
import path from 'node:path';
import { projectFilePath } from './common.mjs';
import { calculateProjectIdentity } from './identity.mjs';
import { readManifest } from './manifest.mjs';
import { vaultSyncProject } from './engine.mjs';
import { vaultRoot } from './common.mjs';

export function watchVaultProject(projectDir = '.', options = {}) {
  const identity = calculateProjectIdentity(projectDir, {
    allowPathIdentity: options.allowPathIdentity === true
  });
  const projectRoot = identity.projectRoot;
  const vaultDir = path.join(vaultRoot(), identity.fingerprint);
  const manifest = readManifest(vaultDir);
  const selected = new Set(manifest.selectedFiles);
  const parentDirectories = new Set(
    manifest.selectedFiles.map((relativePath) => path.dirname(projectFilePath(projectRoot, relativePath)))
  );
  const debounceMs = Math.max(50, Number(options.debounceMs || 250));
  const intervalMs = Math.max(1000, Number(options.intervalMs || 30000));
  const timers = new Map();
  const watchers = [];
  let closed = false;

  function syncRelative(relativePath) {
    if (closed || !selected.has(relativePath)) return;
    try {
      const result = vaultSyncProject(projectRoot, { files: [relativePath] });
      options.onSync?.(result);
    } catch (error) {
      options.onError?.(error);
    }
  }

  for (const directory of parentDirectories) {
    if (!fs.existsSync(directory)) continue;
    const watcher = fs.watch(directory, { persistent: true }, (_eventType, filename) => {
      if (!filename) return;
      const absolute = path.join(directory, String(filename));
      const relative = path.relative(projectRoot, absolute).split(path.sep).join('/');
      if (!selected.has(relative)) return;
      clearTimeout(timers.get(relative));
      timers.set(relative, setTimeout(() => {
        timers.delete(relative);
        syncRelative(relative);
      }, debounceMs));
    });
    watcher.on('error', (error) => options.onError?.(error));
    watchers.push(watcher);
  }

  const reconciliation = setInterval(() => {
    if (closed) return;
    try {
      const result = vaultSyncProject(projectRoot);
      options.onSync?.(result);
    } catch (error) {
      options.onError?.(error);
    }
  }, intervalMs);

  function close() {
    if (closed) return;
    closed = true;
    clearInterval(reconciliation);
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    for (const watcher of watchers) watcher.close();
  }

  return {
    projectRoot,
    fingerprint: identity.fingerprint,
    selectedFiles: [...selected],
    close
  };
}
