#!/usr/bin/env node
import childProcess from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.resolve(here, '..', 'dist', 'cli.mjs');
const safeLinkPath = path.resolve(here, 'agent-kernel-safe-link.mjs');
const safeGitHookPath = path.resolve(here, 'agent-kernel-safe-git-hook.mjs');
const failurePath = path.resolve(here, 'agent-kernel-failure.mjs');
const daemonPath = path.resolve(here, 'agent-kernel-daemon.mjs');
const runtimeDoctorPath = path.resolve(here, 'agent-kernel-runtime-doctor.mjs');
const sessionPath = path.resolve(here, 'agent-kernel-session.mjs');
const contextPath = path.resolve(here, 'agent-kernel-context.mjs');
const fileContextPath = path.resolve(here, 'agent-kernel-file-context.mjs');
const fileRecordsPath = path.resolve(here, 'agent-kernel-file-records.mjs');
const episodeFileRecordsPath = path.resolve(here, 'agent-kernel-episode-file-records.mjs');

const DEFAULT_DENY_WRITE_PATHS = [
  '.env',
  '.env.*',
  '**/secrets/**',
  '**/*service-account*.json',
  '.git/**',
  'node_modules/**'
];

const SECRET_PATTERNS = [
  /OPENAI_API_KEY\s*=\s*["'][^"']+["']/gi,
  /ANTHROPIC_API_KEY\s*=\s*["'][^"']+["']/gi,
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*["'][^"']+["']/gi,
  /AIza[0-9A-Za-z\-_]{35}/g,
  /sk-[A-Za-z0-9]{20,}/g,
  /ghp_[A-Za-z0-9]{20,}/g,
  /xox[abposr]-[A-Za-z0-9-]{10,}/g
];

function kernelHome() {
  return process.env.AGENT_KERNEL_HOME || path.join(os.homedir(), '.agent-kernel');
}

function exists(filePath) {
  try { fs.accessSync(filePath); return true; } catch { return false; }
}

function readText(filePath, fallback = '') {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return fallback; }
}

function writeText(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text, 'utf8');
}

function readJson(filePath, fallback) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return fallback; }
}

function writeJson(filePath, value) {
  writeText(filePath, JSON.stringify(value, null, 2) + '\n');
}

function runNode(scriptPath, args, options = {}) {
  const result = childProcess.spawnSync(process.execPath, [scriptPath, ...args], {
    stdio: options.input === undefined ? 'inherit' : ['pipe', 'inherit', 'inherit'],
    input: options.input,
    env: process.env,
    cwd: process.cwd()
  });
  if (typeof result.status === 'number') process.exit(result.status);
  if (result.error) {
    process.stderr.write(`${result.error.message}\n`);
    process.exit(1);
  }
  process.exit(0);
}

function runNodeNoExit(scriptPath, args, options = {}) {
  return childProcess.spawnSync(process.execPath, [scriptPath, ...args], {
    stdio: options.input === undefined ? 'inherit' : ['pipe', 'inherit', 'inherit'],
    input: options.input,
    env: process.env,
    cwd: process.cwd()
  });
}

function splitLinkArgs(args) {
  const linkArgs = [];
  let installHooks = false;
  let dryRun = false;
  let noBackup = false;
  for (const arg of args) {
    if (arg === '--hooks' || arg === '--enforce') {
      installHooks = true;
      continue;
    }
    if (arg === '--dry-run') dryRun = true;
    if (arg === '--no-backup') noBackup = true;
    linkArgs.push(arg);
  }
  return { linkArgs, installHooks, dryRun, noBackup };
}

function hasFileFlags(args) {
  return args.some((arg) => arg === '--file' || arg === '--files' || arg.startsWith('--file=') || arg.startsWith('--files='));
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

function fileMatches(pattern, file) {
  if (!pattern.includes('*')) return file === pattern || file.endsWith('/' + pattern);
  const escaped = pattern.split('**').join('__DOUBLESTAR__')
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '[^/]*')
    .split('__DOUBLESTAR__').join('.*');
  return new RegExp(`^${escaped}$`).test(file);
}

function protectedPathViolation(filePath, cwd = process.cwd()) {
  if (!filePath) return null;
  const root = gitRoot(cwd);
  const resolved = path.resolve(cwd, filePath);
  const rel = path.relative(root, resolved).replace(/\\/g, '/');
  if (rel === '..' || rel.startsWith('../') || path.isAbsolute(rel)) {
    return `Blocked write outside project root: ${resolved}`;
  }
  for (const pattern of DEFAULT_DENY_WRITE_PATHS) {
    if (fileMatches(pattern, rel)) return `Blocked write to protected path: ${rel}`;
  }
  return null;
}

function stagedFiles(root) {
  try {
    const out = childProcess.execFileSync('git', ['diff', '--cached', '--name-only'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    return out ? out.split('\n').map((f) => path.join(root, f)) : [];
  } catch {
    return [];
  }
}

function fileArgFromGuardArgs(args) {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--file') return args[i + 1] || '';
    if (arg.startsWith('--file=')) return arg.slice('--file='.length);
  }
  return '';
}

function enforceGuardPathPolicy(args) {
  const root = gitRoot(process.cwd());
  const files = args.includes('--staged')
    ? stagedFiles(root)
    : (fileArgFromGuardArgs(args) ? [path.resolve(process.cwd(), fileArgFromGuardArgs(args))] : []);
  const violations = [];
  for (const file of files) {
    const msg = protectedPathViolation(file, root);
    if (msg) violations.push({ file, msg });
  }
  if (!violations.length) return false;
  process.stdout.write('Agent Kernel Guard blocked violations:\n');
  for (const v of violations) process.stdout.write(`- ${path.relative(root, v.file).replace(/\\/g, '/')}: protected-path: ${v.msg}\n`);
  process.exit(2);
}

function hookDeny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason
    }
  }));
}

function handleHook(command, subcommand, rest) {
  if (subcommand !== 'pre-tool-use') return runNode(cliPath, [command, subcommand, ...rest]);
  const input = (() => { try { return fs.readFileSync(0, 'utf8') || '{}'; } catch { return '{}'; } })();
  let payload = {};
  try { payload = JSON.parse(input); } catch { payload = {}; }
  const cwd = payload.cwd || process.cwd();
  const toolInput = payload.tool_input || payload.toolInput || {};
  const filePath = toolInput.file_path || toolInput.path || toolInput.filename;
  const msg = protectedPathViolation(filePath, cwd);
  if (msg) return hookDeny(msg);
  runNode(cliPath, [command, subcommand, ...rest], { input });
}

function redactSecretsInText(text) {
  let out = String(text || '');
  for (const pattern of SECRET_PATTERNS) out = out.replace(pattern, '[REDACTED_SECRET]');
  return out;
}

function redactObject(value) {
  if (typeof value === 'string') return redactSecretsInText(value);
  if (Array.isArray(value)) return value.map(redactObject);
  if (value && typeof value === 'object') {
    const next = {};
    for (const [key, item] of Object.entries(value)) next[key] = redactObject(item);
    return next;
  }
  return value;
}

function redactEpisodeArchive() {
  const archiveDir = path.join(kernelHome(), 'episodes', 'archive');
  if (!exists(archiveDir)) return;
  for (const name of fs.readdirSync(archiveDir)) {
    if (!name.endsWith('.json')) continue;
    const full = path.join(archiveDir, name);
    const before = readText(full, '');
    const parsed = readJson(full, null);
    if (!parsed) continue;
    const redacted = redactObject(parsed);
    const after = JSON.stringify(redacted, null, 2) + '\n';
    if (after !== before) writeText(full, after);
  }
}

function handleEpisode(args) {
  const result = runNodeNoExit(cliPath, ['episode', ...args]);
  redactEpisodeArchive();
  if (typeof result.status === 'number') process.exit(result.status);
  if (result.error) {
    process.stderr.write(`${result.error.message}\n`);
    process.exit(1);
  }
  process.exit(0);
}

function handleStart(args) {
  const [agent, projectArg = '.'] = args;
  if (!agent) return runNode(cliPath, ['start', ...args]);
  const project = path.resolve(projectArg);
  if (!exists(project)) {
    process.stderr.write(`Project not found: ${project}\n`);
    process.exit(1);
  }
  const commandMap = { claude: 'claude', codex: 'codex', cursor: 'cursor', antigravity: 'antigravity', gemini: 'gemini' };
  const bin = commandMap[agent];
  if (!bin) {
    process.stderr.write(`Unsupported agent: ${agent}\n`);
    process.exit(1);
  }
  const linkResult = childProcess.spawnSync(process.execPath, [safeLinkPath, project], {
    stdio: 'inherit',
    env: process.env,
    cwd: process.cwd()
  });
  if (linkResult.status !== 0) process.exit(linkResult.status ?? 1);
  const spawnArgs = agent === 'cursor' || agent === 'antigravity' ? [project] : [];
  process.stdout.write(`Starting ${agent} in ${project}\n`);
  const child = childProcess.spawn(bin, spawnArgs, { cwd: project, stdio: 'inherit' });
  child.on('exit', (code) => process.exit(code ?? 0));
  child.on('error', (err) => {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  });
}

function main() {
  const args = process.argv.slice(2);
  const [command, subcommand, ...rest] = args;

  if (command === 'link') {
    const { linkArgs, installHooks, dryRun, noBackup } = splitLinkArgs(args.slice(1));
    const linkResult = childProcess.spawnSync(process.execPath, [safeLinkPath, ...linkArgs], {
      stdio: 'inherit',
      env: process.env,
      cwd: process.cwd()
    });
    if (linkResult.status !== 0) process.exit(linkResult.status ?? 1);
    if (installHooks) {
      const hookArgs = linkArgs.filter((arg) => !arg.startsWith('--'));
      if (dryRun) hookArgs.push('--dry-run');
      if (noBackup) hookArgs.push('--no-backup');
      runNode(safeGitHookPath, hookArgs);
    }
    process.exit(0);
  }

  if (command === 'doctor' && args.includes('--runtime')) {
    runNode(runtimeDoctorPath, ['doctor', ...args.slice(1).filter((arg) => arg !== '--runtime')]);
  }

  if (command === 'status' && args.includes('--runtime')) {
    runNode(runtimeDoctorPath, ['status', ...args.slice(1).filter((arg) => arg !== '--runtime')]);
  }

  if (command === 'guard') {
    enforceGuardPathPolicy(args.slice(1));
    runNode(cliPath, args);
  }

  if (command === 'hook') {
    return handleHook(command, subcommand, rest);
  }

  if ((command === 'remember' || command === 'propose' || command === 'memory' || command === 'compile') && hasFileFlags(args.slice(1))) {
    runNode(fileRecordsPath, args);
  }

  if (command === 'episode') {
    if (hasFileFlags(args.slice(1)) || subcommand === 'reindex') runNode(episodeFileRecordsPath, args.slice(1));
    return handleEpisode(args.slice(1));
  }

  if (command === 'start') {
    return handleStart(args.slice(1));
  }

  if (command === 'daemon') {
    runNode(daemonPath, args.slice(1));
  }

  if (command === 'session') {
    if ((subcommand === 'observe' || subcommand === 'observations') && hasFileFlags(args.slice(2))) runNode(fileRecordsPath, args);
    runNode(sessionPath, args.slice(1));
  }

  const brokerPath = path.resolve(here, 'agent-kernel-project-broker.mjs');
  const brokerCommands = ['project', 'projects', 'auth', 'env', 'provider', 'gates', 'approvals', 'audit'];
  if (brokerCommands.includes(command)) {
    runNode(brokerPath, args);
  }

  if (command === 'context') {
    if (['enter', 'current', 'verify', 'doctor', 'switch'].includes(subcommand)) {
      runNode(brokerPath, args);
    }
    runNode(contextPath, args.slice(1));
  }

  if (command === 'file-context') {
    runNode(fileContextPath, args.slice(1));
  }

  if (command === 'failure') {
    runNode(fileRecordsPath, args);
  }

  if (command === 'git-hook' && subcommand === 'install') {
    runNode(safeGitHookPath, rest);
  }

  runNode(cliPath, args);
}

main();
