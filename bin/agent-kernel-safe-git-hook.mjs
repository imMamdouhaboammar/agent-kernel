#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import childProcess from 'node:child_process';

const MARKER_START = '# agent-kernel:start';
const MARKER_END = '# agent-kernel:end';

function print(message = '') {
  process.stdout.write(String(message) + '\n');
}

function fail(message) {
  process.stderr.write(String(message) + '\n');
  process.exitCode = 1;
}

function exists(filePath) {
  try { fs.accessSync(filePath); return true; } catch { return false; }
}

function lstat(filePath) {
  try { return fs.lstatSync(filePath); } catch { return null; }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readText(filePath, fallback = '') {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return fallback; }
}

function uniqueSibling(filePath, label) {
  return `${filePath}.${label}-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function writeHookAtomic(hookPath, text, mode) {
  ensureDir(path.dirname(hookPath));
  const temporary = uniqueSibling(hookPath, 'tmp');
  let displaced = null;
  try {
    fs.writeFileSync(temporary, text, { encoding: 'utf8', mode });
    fs.chmodSync(temporary, mode);
    try {
      fs.renameSync(temporary, hookPath);
      return;
    } catch (error) {
      if (!exists(hookPath) || !['EEXIST', 'EPERM', 'EACCES'].includes(error?.code)) throw error;
    }

    displaced = uniqueSibling(hookPath, 'rollback');
    fs.renameSync(hookPath, displaced);
    try {
      fs.renameSync(temporary, hookPath);
      fs.rmSync(displaced, { force: true });
      displaced = null;
    } catch (error) {
      try { if (exists(displaced) && !exists(hookPath)) fs.renameSync(displaced, hookPath); } catch {}
      throw error;
    }
  } finally {
    try { fs.rmSync(temporary, { force: true }); } catch {}
    if (displaced && exists(displaced) && exists(hookPath)) {
      try { fs.rmSync(displaced, { force: true }); } catch {}
    }
  }
}

function parseArgs(argv) {
  const flags = { _: [] };
  const seen = new Set();
  let positionalOnly = false;
  for (const arg of argv) {
    if (positionalOnly) {
      flags._.push(arg);
      continue;
    }
    if (arg === '--') {
      positionalOnly = true;
      continue;
    }
    let name = null;
    if (arg === '--dry-run') name = 'dryRun';
    else if (arg === '--no-backup') name = 'noBackup';
    else if (arg === '--force') name = 'force';
    else if (arg === '--help' || arg === '-h') name = 'help';
    else if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
    else {
      flags._.push(arg);
      continue;
    }
    if (seen.has(name)) throw new Error(`Duplicate option: ${arg}`);
    seen.add(name);
    flags[name] = true;
  }
  if (flags._.length > 1) throw new Error(`Expected at most one project path, received ${flags._.length}.`);
  return flags;
}

function resolveProject(projectArg) {
  const candidate = path.resolve(projectArg || '.');
  let stat;
  try { stat = fs.statSync(candidate); } catch { throw new Error(`Project path not found: ${candidate}`); }
  if (!stat.isDirectory()) throw new Error(`Project path is not a directory: ${candidate}`);
  return fs.realpathSync(candidate);
}

function gitOutput(projectPath, args, errorMessage) {
  try {
    return childProcess.execFileSync('git', args, {
      cwd: projectPath,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    throw new Error(errorMessage);
  }
}

function gitPathCandidate(projectPath, value) {
  return path.isAbsolute(value) ? path.normalize(value) : path.resolve(projectPath, value);
}

function resolveGitPath(projectPath, value) {
  const candidate = gitPathCandidate(projectPath, value);
  const existingAncestor = (() => {
    let current = candidate;
    while (!exists(current)) {
      const parent = path.dirname(current);
      if (parent === current) return null;
      current = parent;
    }
    return current;
  })();
  if (!existingAncestor) throw new Error(`Could not resolve Git path: ${candidate}`);
  const realAncestor = fs.realpathSync(existingAncestor);
  return path.join(realAncestor, path.relative(existingAncestor, candidate));
}

function gitLocations(projectPath) {
  const root = fs.realpathSync(gitOutput(projectPath, ['rev-parse', '--show-toplevel'], `Not a Git worktree: ${projectPath}`));
  const commonRaw = gitOutput(projectPath, ['rev-parse', '--git-common-dir'], `Could not resolve Git common directory for ${projectPath}`);
  const hooksRaw = gitOutput(projectPath, ['rev-parse', '--git-path', 'hooks'], `Could not resolve Git hooks directory for ${projectPath}`);
  const hooksCandidate = gitPathCandidate(projectPath, hooksRaw);
  const hooksCandidateStat = lstat(hooksCandidate);
  if (hooksCandidateStat?.isSymbolicLink()) {
    throw new Error(`Refusing to modify through symbolic hooks directory: ${hooksCandidate}`);
  }
  if (hooksCandidateStat && !hooksCandidateStat.isDirectory()) {
    throw new Error(`Git hooks path is not a directory: ${hooksCandidate}`);
  }
  return {
    root,
    commonDir: resolveGitPath(projectPath, commonRaw),
    hooksDir: resolveGitPath(projectPath, hooksRaw)
  };
}

function validateHookTarget(hookPath) {
  const stat = lstat(hookPath);
  if (stat?.isSymbolicLink()) throw new Error(`Refusing to modify symbolic pre-commit hook: ${hookPath}`);
  if (stat && !stat.isFile()) throw new Error(`Pre-commit hook is not a regular file: ${hookPath}`);
  const hooksDir = path.dirname(hookPath);
  const hooksStat = lstat(hooksDir);
  if (hooksStat?.isSymbolicLink()) throw new Error(`Refusing to modify through symbolic hooks directory: ${hooksDir}`);
  if (hooksStat && !hooksStat.isDirectory()) throw new Error(`Git hooks path is not a directory: ${hooksDir}`);
}

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function managedBlockRegex() {
  return new RegExp(
    `(?:\\r?\\n){0,2}^[\\t ]*${escapeRegex(MARKER_START)}[\\t ]*\\r?\\n[\\s\\S]*?^[\\t ]*${escapeRegex(MARKER_END)}[\\t ]*(?:\\r?\\n){0,2}`,
    'gm'
  );
}

function countMarker(text, marker) {
  return (String(text || '').match(new RegExp(`^[\\t ]*${escapeRegex(marker)}[\\t ]*$`, 'gm')) || []).length;
}

function markerState(existing) {
  const text = String(existing || '');
  const starts = countMarker(text, MARKER_START);
  const ends = countMarker(text, MARKER_END);
  const completeBlocks = (text.match(managedBlockRegex()) || []).length;
  return { starts, ends, completeBlocks, corrupt: starts !== ends || completeBlocks !== starts };
}

function stripMarkerLines(existing) {
  const markerLine = new RegExp(`^[\\t ]*(?:${escapeRegex(MARKER_START)}|${escapeRegex(MARKER_END)})[\\t ]*\\r?\\n?`, 'gm');
  return String(existing || '').replace(markerLine, '').replace(/\n{3,}/g, '\n\n').trimEnd();
}

function stripManagedBlocks(existing) {
  return String(existing || '').replace(managedBlockRegex(), '\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}

function agentKernelBlock() {
  return `${MARKER_START}\nagent-kernel guard --staged\nstatus=$?\nif [ $status -ne 0 ]; then\n  echo "Agent Kernel blocked this commit."\n  exit $status\nfi\n${MARKER_END}\n`;
}

function mergeHook(existing, options = {}) {
  const state = markerState(existing);
  if (state.corrupt && !options.force) {
    throw new Error('Corrupt Agent Kernel markers in pre-commit. Review the hook, then rerun with --force to preserve non-marker shell code and rebuild one managed block.');
  }
  const preserved = state.corrupt ? stripMarkerLines(existing) : stripManagedBlocks(existing);
  const base = preserved.trim() ? preserved.trimEnd() : '#!/usr/bin/env sh';
  const withShebang = base.startsWith('#!') ? base : `#!/usr/bin/env sh\n${base}`;
  return {
    next: `${withShebang}\n\n${agentKernelBlock()}`,
    action: state.corrupt
      ? 'repair-corrupt-markers'
      : state.completeBlocks > 0
        ? 'replace-marked-block'
        : existing.trim()
          ? 'append-marked-block'
          : 'create'
  };
}

function backupExisting(hookPath, root, mode) {
  if (!exists(hookPath)) return null;
  const backupDir = path.join(root, '.agent-kernel-backups');
  ensureDir(backupDir);
  const backupPath = path.join(backupDir, `pre-commit.${Date.now()}.${Math.random().toString(16).slice(2)}.bak`);
  fs.copyFileSync(hookPath, backupPath);
  fs.chmodSync(backupPath, mode);
  return backupPath;
}

function displayPath(root, targetPath) {
  const relative = path.relative(root, targetPath).replace(/\\/g, '/');
  if (!relative.startsWith('../') && relative !== '..' && !path.isAbsolute(relative)) return relative;
  return targetPath;
}

function usage() {
  print(`agent-kernel-safe-git-hook\n\nUsage:\n  agent-kernel-safe-git-hook [project] [--dry-run] [--force] [--no-backup]\n\nSafely injects the Agent Kernel pre-commit block without deleting existing hook logic.\n\n--force repairs unmatched or nested Agent Kernel marker lines while preserving non-marker shell code.\n`);
}

function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) return usage();

  const project = resolveProject(flags._[0] || '.');
  const locations = gitLocations(project);
  const hookPath = path.join(locations.hooksDir, 'pre-commit');
  validateHookTarget(hookPath);
  const hookStat = lstat(hookPath);
  const existingMode = hookStat ? (hookStat.mode & 0o777) : 0o755;
  const desiredMode = hookStat ? (existingMode | 0o100) : 0o755;
  const existing = readText(hookPath, '');
  const merged = mergeHook(existing, flags);

  print(flags.dryRun ? 'Agent Kernel safe git-hook dry run:' : 'Agent Kernel safe git-hook:');
  print(`- ${merged.action}: ${displayPath(locations.root, hookPath)}`);

  if (flags.dryRun) return;

  if (!flags.noBackup && hookStat) backupExisting(hookPath, locations.root, existingMode);
  writeHookAtomic(hookPath, merged.next, desiredMode);
  print(`Safe git hook installed: ${hookPath}`);
  if (!flags.noBackup) print('Backups, when needed, were written to .agent-kernel-backups/.');
}

try { main(); }
catch (error) { fail(error?.message || String(error)); }
