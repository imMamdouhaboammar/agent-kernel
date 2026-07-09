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
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') flags.dryRun = true;
    else if (arg === '--force') flags.force = true;
    else if (arg === '--no-backup') flags.noBackup = true;
    else if (arg === '--help' || arg === '-h') flags.help = true;
    else flags._.push(arg);
  }
  return flags;
}

function kernelHome() {
  return process.env.AGENT_KERNEL_HOME || path.join(os.homedir(), '.agent-kernel');
}

function gitRoot(projectPath) {
  try {
    return childProcess.execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: projectPath,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return path.resolve(projectPath);
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

function stripOuterMarkers(content) {
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

function planTarget(root, relativePath, sourcePath) {
  const sourceText = readText(sourcePath);
  if (!sourceText.trim()) return null;
  const targetPath = path.join(root, relativePath);
  const existing = readText(targetPath, '');
  const generatedBlock = wrapGenerated(sourceText);
  const next = replaceMarkedBlock(existing, generatedBlock);
  const action = exists(targetPath)
    ? (hasMarkedBlock(existing) ? 'replace-marked-block' : 'append-marked-block')
    : 'create';
  return { relativePath, targetPath, sourcePath, action, existing, next };
}

function usage() {
  print(`agent-kernel-safe-link\n\nUsage:\n  agent-kernel-safe-link [project] [--dry-run] [--force] [--no-backup]\n\nReads generated files from AGENT_KERNEL_HOME/dist and safely injects marked blocks into a project.\n`);
}

function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) return usage();

  const projectArg = flags._[0] || '.';
  const root = gitRoot(path.resolve(projectArg));
  const dist = path.join(kernelHome(), 'dist');

  if (!exists(dist)) {
    fail(`Agent Kernel dist folder not found: ${dist}. Run agent-kernel init or agent-kernel compile first.`);
    return;
  }

  const targets = [
    ['AGENTS.md', path.join(dist, 'AGENTS.md')],
    ['GEMINI.md', path.join(dist, 'GEMINI.md')],
    ['.cursor/rules/00-agent-kernel.mdc', path.join(dist, 'cursor-rule.mdc')],
    ['.agents/agents.md', path.join(dist, 'antigravity-agents.md')],
    ['.agents/skills/README.md', path.join(dist, 'SKILLS.md')]
  ];

  const plans = targets.map(([relativePath, sourcePath]) => planTarget(root, relativePath, sourcePath)).filter(Boolean);
  if (!plans.length) {
    fail(`No generated Agent Kernel files were found in ${dist}. Run agent-kernel compile first.`);
    return;
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

main();
