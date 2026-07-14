#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import childProcess from 'node:child_process';

const MARKER_START = '<!-- agent-kernel:start -->';
const MARKER_END = '<!-- agent-kernel:end -->';

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

function writeText(filePath, text) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, text, 'utf8');
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
    else if (arg === '--force') name = 'force';
    else if (arg === '--no-backup') name = 'noBackup';
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

function kernelHome() {
  return process.env.AGENT_KERNEL_HOME || path.join(os.homedir(), '.agent-kernel');
}

function resolveProject(projectArg) {
  const candidate = path.resolve(projectArg || '.');
  let stat;
  try { stat = fs.statSync(candidate); } catch { throw new Error(`Project path not found: ${candidate}`); }
  if (!stat.isDirectory()) throw new Error(`Project path is not a directory: ${candidate}`);
  return fs.realpathSync(candidate);
}

function gitRoot(projectPath) {
  try {
    const discovered = childProcess.execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: projectPath,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    return fs.realpathSync(discovered);
  } catch {
    return projectPath;
  }
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function nearestExistingAncestor(filePath) {
  let current = filePath;
  while (!lstat(current)) {
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
  return current;
}

function validateTargetPath(root, targetPath, relativePath) {
  if (!isInside(root, path.resolve(targetPath))) {
    throw new Error(`Target escapes project root: ${relativePath}`);
  }
  const targetStat = lstat(targetPath);
  if (targetStat?.isSymbolicLink()) {
    throw new Error(`Refusing to modify symbolic link target: ${relativePath}`);
  }
  if (targetStat && !targetStat.isFile()) {
    throw new Error(`Target path is not a regular file: ${relativePath}`);
  }
  const ancestor = nearestExistingAncestor(path.dirname(targetPath));
  if (!ancestor) throw new Error(`Could not resolve target parent: ${relativePath}`);
  const resolvedAncestor = fs.realpathSync(ancestor);
  if (!isInside(root, resolvedAncestor)) {
    throw new Error(`Target parent resolves outside project root: ${relativePath}`);
  }
}

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function markedBlockRegex() {
  return new RegExp(
    `(?:\\r?\\n){0,2}${escapeRegex(MARKER_START)}[\\s\\S]*?${escapeRegex(MARKER_END)}(?:\\r?\\n){0,2}`,
    'g'
  );
}

function markerCount(content, marker) {
  return (String(content || '').match(new RegExp(escapeRegex(marker), 'g')) || []).length;
}

function markerState(content) {
  const text = String(content || '');
  const starts = markerCount(text, MARKER_START);
  const ends = markerCount(text, MARKER_END);
  const completeBlocks = (text.match(markedBlockRegex()) || []).length;
  return {
    starts,
    ends,
    completeBlocks,
    corrupt: starts !== ends || completeBlocks !== starts
  };
}

function stripMarkerLines(content) {
  const markerLine = new RegExp(`^[\\t ]*(?:${escapeRegex(MARKER_START)}|${escapeRegex(MARKER_END)})[\\t ]*\\r?\\n?`, 'gm');
  return String(content || '').replace(markerLine, '').replace(/\n{3,}/g, '\n\n').trimEnd();
}

function stripOuterMarkers(content) {
  // Remove a single leading start marker and a single trailing end marker from
  // the source, leaving any inner content intact. Used when wrapping a
  // generated dist file (which is itself a marked block) so we do not produce
  // nested duplicates in the project target.
  let text = String(content || '');
  text = text.replace(/^\s*<!--\s*agent-kernel:start\s*-->\s*\r?\n?/, '');
  text = text.replace(/\r?\n?\s*<!--\s*agent-kernel:end\s*-->\s*$/, '');
  return text;
}

function wrapGenerated(content) {
  const trimmed = stripOuterMarkers(content).replace(/\n{3,}/g, '\n\n').trimEnd();
  return `${MARKER_START}\n${trimmed}\n${MARKER_END}\n`;
}

function stripMarkedBlocks(existing) {
  return String(existing || '').replace(markedBlockRegex(), '\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}

function hasMarkedBlock(existing) {
  return markedBlockRegex().test(String(existing || ''));
}

function replaceMarkedBlock(existing, generatedBlock) {
  const preserved = stripMarkedBlocks(existing);
  const separator = preserved.trim() ? '\n\n' : '';
  return `${preserved}${separator}${generatedBlock}`;
}

function backupExisting(targetPath, root) {
  if (!exists(targetPath)) return null;
  const relative = path.relative(root, targetPath).replace(/\\/g, '/');
  const safeName = relative.replace(/[^a-zA-Z0-9._-]/g, '__');
  const backupDir = path.join(root, '.agent-kernel-backups');
  ensureDir(backupDir);
  const backupPath = path.join(backupDir, `${safeName}.${Date.now()}.bak`);
  fs.copyFileSync(targetPath, backupPath);
  return backupPath;
}

function planTarget(root, relativePath, sourcePath, options = {}) {
  const sourceText = readText(sourcePath);
  if (!sourceText.trim()) return null;
  const targetPath = path.join(root, relativePath);
  validateTargetPath(root, targetPath, relativePath);
  const existing = readText(targetPath, '');
  const state = markerState(existing);
  if (state.corrupt && !options.force) {
    throw new Error(`Corrupt Agent Kernel markers in ${relativePath}. Review the file, then rerun with --force to preserve its text and rebuild one managed block.`);
  }
  const mergeBase = state.corrupt ? stripMarkerLines(existing) : existing;
  const generatedBlock = wrapGenerated(sourceText);
  const next = replaceMarkedBlock(mergeBase, generatedBlock);
  const action = state.corrupt
    ? 'repair-corrupt-markers'
    : exists(targetPath)
      ? (hasMarkedBlock(existing) ? 'replace-marked-block' : 'append-marked-block')
      : 'create';
  return { relativePath, targetPath, sourcePath, action, existing, next };
}

function usage() {
  print(`agent-kernel-safe-link\n\nUsage:\n  agent-kernel-safe-link [project] [--dry-run] [--force] [--no-backup]\n\nReads generated files from AGENT_KERNEL_HOME/dist and safely injects marked blocks into a project.\n\n--force repairs unmatched or nested Agent Kernel marker lines while preserving the surrounding text.\n`);
}

function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) return usage();

  const projectArg = flags._[0] || '.';
  const root = gitRoot(resolveProject(projectArg));
  const dist = path.join(kernelHome(), 'dist');

  if (!exists(dist)) {
    throw new Error(`Agent Kernel dist folder not found: ${dist}. Run agent-kernel init or agent-kernel compile first.`);
  }

  const targets = [
    ['AGENTS.md', path.join(dist, 'AGENTS.md')],
    // CLAUDE.md inherits the shared Agent Kernel constitution so the
    // Claude Code file in the project carries the same rules as AGENTS.md.
    ['CLAUDE.md', path.join(dist, 'AGENTS.md')],
    ['GEMINI.md', path.join(dist, 'GEMINI.md')],
    ['.cursor/rules/00-agent-kernel.mdc', path.join(dist, 'cursor-rule.mdc')],
    ['.agents/agents.md', path.join(dist, 'antigravity-agents.md')],
    ['.agents/skills/README.md', path.join(dist, 'SKILLS.md')]
  ];

  const plans = targets.map(([relativePath, sourcePath]) => planTarget(root, relativePath, sourcePath, flags)).filter(Boolean);
  if (!plans.length) {
    throw new Error(`No generated Agent Kernel files were found in ${dist}. Run agent-kernel compile first.`);
  }

  print(flags.dryRun ? 'Agent Kernel safe-link dry run:' : 'Agent Kernel safe-link:');
  for (const p of plans) {
    print(`- ${p.action}: ${p.relativePath}`);
  }

  if (flags.dryRun) return;

  for (const p of plans) {
    if (!flags.noBackup && exists(p.targetPath)) {
      backupExisting(p.targetPath, root);
    }
    writeText(p.targetPath, p.next);
  }

  print(`Safe link complete: ${root}`);
  if (!flags.noBackup) print('Backups, when needed, were written to .agent-kernel-backups/.');
}

try { main(); }
catch (error) { fail(error?.message || String(error)); }
