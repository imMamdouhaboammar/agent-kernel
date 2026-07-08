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
  for (const arg of argv) {
    if (arg === '--dry-run') flags.dryRun = true;
    else if (arg === '--no-backup') flags.noBackup = true;
    else if (arg === '--help' || arg === '-h') flags.help = true;
    else flags._.push(arg);
  }
  return flags;
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

function agentKernelBlock() {
  return `${MARKER_START}\nagent-kernel guard --staged\nstatus=$?\nif [ $status -ne 0 ]; then\n  echo "Agent Kernel blocked this commit."\n  exit $status\nfi\n${MARKER_END}\n`;
}

function mergeHook(existing) {
  const block = agentKernelBlock();
  const start = existing.indexOf(MARKER_START);
  const end = existing.indexOf(MARKER_END);
  if (start >= 0 && end > start) {
    const afterEnd = end + MARKER_END.length;
    return `${existing.slice(0, start)}${block}${existing.slice(afterEnd).replace(/^\n/, '')}`;
  }
  const base = existing.trim() ? existing.trimEnd() : '#!/usr/bin/env sh';
  const withShebang = base.startsWith('#!') ? base : `#!/usr/bin/env sh\n${base}`;
  return `${withShebang}\n\n${block}`;
}

function backupExisting(hookPath, root) {
  if (!exists(hookPath)) return null;
  const backupDir = path.join(root, '.agent-kernel-backups');
  ensureDir(backupDir);
  const backupPath = path.join(backupDir, `pre-commit.${Date.now()}.bak`);
  fs.copyFileSync(hookPath, backupPath);
  return backupPath;
}

function usage() {
  print(`agent-kernel-safe-git-hook\n\nUsage:\n  agent-kernel-safe-git-hook [project] [--dry-run] [--no-backup]\n\nSafely injects the Agent Kernel pre-commit block without deleting existing hook logic.\n`);
}

function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) return usage();

  const project = path.resolve(flags._[0] || '.');
  const root = gitRoot(project);
  const gitDir = path.join(root, '.git');
  if (!exists(gitDir)) {
    fail(`No .git directory found in ${root}`);
    return;
  }

  const hookPath = path.join(gitDir, 'hooks', 'pre-commit');
  const existing = readText(hookPath, '');
  const next = mergeHook(existing);
  const action = exists(hookPath)
    ? (existing.includes(MARKER_START) ? 'replace-marked-block' : 'append-marked-block')
    : 'create';

  print(flags.dryRun ? 'Agent Kernel safe git-hook dry run:' : 'Agent Kernel safe git-hook:');
  print(`- ${action}: ${path.relative(root, hookPath).replace(/\\/g, '/')}`);

  if (flags.dryRun) return;

  if (!flags.noBackup && exists(hookPath)) backupExisting(hookPath, root);
  writeText(hookPath, next);
  fs.chmodSync(hookPath, 0o755);
  print(`Safe git hook installed: ${hookPath}`);
  if (!flags.noBackup) print('Backups, when needed, were written to .agent-kernel-backups/.');
}

main();
