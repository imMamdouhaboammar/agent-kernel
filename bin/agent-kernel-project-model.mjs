import childProcess from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function kernelHome() {
  return process.env.AGENT_KERNEL_HOME || path.join(os.homedir(), '.agent-kernel');
}

function nowIso() {
  return new Date().toISOString();
}

function registryPath() {
  return path.join(kernelHome(), 'source', 'projects', 'projects.json');
}

function markerPath(root) {
  return path.join(root, '.agent-kernel', 'project.json');
}

function readJson(filePath, fallback) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return fallback; }
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', 'utf8');
  fs.renameSync(temporary, filePath);
}

function git(root, args) {
  try {
    return childProcess.execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return '';
  }
}

export function projectRoot(input = '.') {
  const resolved = path.resolve(input);
  return git(resolved, ['rev-parse', '--show-toplevel']) || resolved;
}

function sanitizeRemote(value) {
  let remote = String(value || '').trim();
  if (!remote) return '';
  remote = remote.replace(/^git@([^:]+):/, 'ssh://$1/');
  try {
    const parsed = new URL(remote);
    return `${parsed.hostname}${parsed.pathname}`.replace(/\.git$/, '').replace(/^\/+|\/+$/g, '');
  } catch {
    return remote.replace(/^[^@]+@/, '').replace(/\.git$/, '').replace(/^\/+|\/+$/g, '');
  }
}

function slug(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
}

function packageName(root) {
  const pkg = readJson(path.join(root, 'package.json'), {});
  return slug(String(pkg.name || '').split('/').at(-1));
}

function fingerprint(root, remote) {
  const firstCommit = git(root, ['rev-list', '--max-parents=0', 'HEAD']).split(/\r?\n/)[0] || '';
  const basis = remote || firstCommit || packageName(root) || path.basename(root);
  return crypto.createHash('sha256').update(basis).digest('hex').slice(0, 16);
}

function derivedId(root, remote) {
  const remoteName = slug(remote.split('/').at(-1));
  return remoteName || packageName(root) || slug(path.basename(root)) || `project-${fingerprint(root, remote).slice(0, 8)}`;
}

export function loadProjectRegistry() {
  const value = readJson(registryPath(), { version: 1, updatedAt: null, projects: [] });
  return {
    version: 1,
    updatedAt: value?.updatedAt || null,
    projects: Array.isArray(value?.projects) ? value.projects : []
  };
}

export function saveProjectRegistry(registry) {
  registry.version = 1;
  registry.updatedAt = nowIso();
  writeJsonAtomic(registryPath(), registry);
}

export function identifyProject(input = '.', options = {}) {
  const root = projectRoot(input);
  const marker = readJson(markerPath(root), null);
  const rawRemote = git(root, ['config', '--get', 'remote.origin.url']);
  const remote = sanitizeRemote(rawRemote);
  const registry = loadProjectRegistry();
  const fp = fingerprint(root, remote);
  const existing = registry.projects.find((item) =>
    item.projectId === marker?.projectId ||
    (remote && item.repoRemote === remote) ||
    item.fingerprint === fp
  );
  const timestamp = nowIso();
  const projectId = slug(options.projectId || marker?.projectId || existing?.projectId || derivedId(root, remote));
  const record = {
    projectId,
    name: String(options.name || marker?.name || existing?.name || path.basename(root)),
    root,
    repoRemote: remote || existing?.repoRemote || '',
    fingerprint: fp,
    createdAt: existing?.createdAt || marker?.createdAt || timestamp,
    updatedAt: timestamp
  };
  const index = registry.projects.findIndex((item) => item.projectId === projectId || item.fingerprint === fp || (remote && item.repoRemote === remote));
  if (index >= 0) registry.projects[index] = record;
  else registry.projects.push(record);
  registry.projects.sort((a, b) => a.projectId.localeCompare(b.projectId));
  saveProjectRegistry(registry);
  writeJsonAtomic(markerPath(root), {
    version: 1,
    projectId: record.projectId,
    name: record.name,
    repoRemote: record.repoRemote,
    fingerprint: record.fingerprint,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  });
  return record;
}

export function setProjectId(input, projectId) {
  const wanted = slug(projectId);
  if (!wanted) throw new Error('Project ID is required.');
  return identifyProject(input, { projectId: wanted });
}

export function findProject(value) {
  const wanted = String(value || '').trim();
  const registry = loadProjectRegistry();
  return registry.projects.find((item) => item.projectId === wanted || path.resolve(item.root) === path.resolve(wanted)) || null;
}

export function projectRegistryFilePath() {
  return registryPath();
}

export function projectMarkerFilePath(root) {
  return markerPath(projectRoot(root));
}
