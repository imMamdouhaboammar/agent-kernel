import childProcess from 'node:child_process';
import path from 'node:path';
import { sha256 } from './common.mjs';

function git(cwd, args) {
  try {
    return childProcess.execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim() || null;
  } catch {
    return null;
  }
}

export function resolveProjectRoot(projectDir = '.') {
  const resolved = path.resolve(projectDir);
  return git(resolved, ['rev-parse', '--show-toplevel']) || resolved;
}

export function gitRemoteUrl(projectDir = '.') {
  return git(resolveProjectRoot(projectDir), ['config', '--get', 'remote.origin.url']);
}

export function initialCommitHash(projectDir = '.') {
  const roots = git(resolveProjectRoot(projectDir), ['rev-list', '--max-parents=0', 'HEAD']);
  return roots ? roots.split(/\s+/u)[0] : null;
}

function cleanRepositoryPath(value) {
  return String(value || '')
    .replace(/^\/+|\/+$/gu, '')
    .replace(/\.git$/iu, '')
    .replace(/\/+$/gu, '')
    .toLowerCase();
}

export function canonicalizeRemote(remote) {
  const raw = String(remote || '').trim();
  if (!raw) throw new Error('Git remote origin is empty');

  if (!raw.includes('://') && !/^[A-Za-z]:[\\/]/u.test(raw)) {
    const scp = raw.match(/^(?:[^@\s/:]+@)?([^\s/:]+):(.+)$/u);
    if (scp) {
      const host = scp[1].toLowerCase();
      const repositoryPath = cleanRepositoryPath(scp[2].split(/[?#]/u)[0]);
      if (!repositoryPath) throw new Error('Git remote origin has no repository path');
      return `remote:${host}/${repositoryPath}`;
    }
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('Git remote origin is not a supported URL');
  }

  const host = parsed.hostname.toLowerCase();
  const repositoryPath = cleanRepositoryPath(parsed.pathname);
  if (!host || !repositoryPath) throw new Error('Git remote origin has no stable host and repository path');
  return `remote:${host}/${repositoryPath}`;
}

export function calculateProjectIdentity(projectDir = '.', options = {}) {
  const projectRoot = resolveProjectRoot(projectDir);
  const projectName = path.basename(projectRoot);
  const gitRemote = gitRemoteUrl(projectRoot);

  if (gitRemote) {
    try {
      const canonical = canonicalizeRemote(gitRemote);
      return {
        fingerprint: sha256(canonical),
        source: 'remote',
        canonical,
        gitRemote,
        projectName,
        projectRoot
      };
    } catch {
      // A malformed remote is not allowed to leak credentials into identity data
    }
  }

  const initialCommit = initialCommitHash(projectRoot);
  if (initialCommit) {
    const canonical = `commit:${initialCommit.toLowerCase()}`;
    return {
      fingerprint: sha256(canonical),
      source: 'commit',
      canonical,
      gitRemote: null,
      projectName,
      projectRoot
    };
  }

  if (options.allowPathIdentity === true) {
    const canonical = `path:${path.resolve(projectRoot)}`;
    return {
      fingerprint: sha256(canonical),
      source: 'path',
      canonical,
      gitRemote: null,
      projectName,
      projectRoot
    };
  }

  throw new Error('Project has no stable Git identity, commit once or pass --allow-path-identity');
}

export function calculateProjectFingerprint(projectDir = '.', options = {}) {
  const identity = calculateProjectIdentity(projectDir, options);
  return {
    fingerprint: identity.fingerprint,
    gitRemote: identity.gitRemote,
    projectName: identity.projectName,
    sourceString: identity.canonical,
    canonical: identity.canonical,
    source: identity.source,
    projectRoot: identity.projectRoot
  };
}
