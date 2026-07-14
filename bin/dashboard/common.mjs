import childProcess from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

export const VERSION = String(pkg.version || '0.0.0');
export const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;
export const RAW_ARGS = process.argv.slice(2);
export const JSON_REQUESTED = RAW_ARGS.some((arg) => arg === '--json' || arg.startsWith('--json='));

const SECRET_PATTERNS = [
  /OPENAI_API_KEY\s*=\s*["'][^"']+["']/gi,
  /ANTHROPIC_API_KEY\s*=\s*["'][^"']+["']/gi,
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*["'][^"']+["']/gi,
  /AIza[0-9A-Za-z\-_]{35}/g,
  /sk-[A-Za-z0-9]{20,}/g,
  /ghp_[A-Za-z0-9]{20,}/g,
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /xox[abposr]-[A-Za-z0-9-]{10,}/g
];
const SENSITIVE_KEY = /^(token|password|secret|credential|authorization|cookie|api.?key|private.?key)$/i;
const ALLOWED_FLAGS = new Set(['out', 'project', 'open', 'no-open', 'json', 'help']);

export class DashboardError extends Error {
  constructor(category, message) {
    super(message);
    this.name = 'DashboardError';
    this.category = category;
  }
}

export function kernelHome() {
  return process.env.AGENT_KERNEL_HOME || path.join(os.homedir(), '.agent-kernel');
}

export function dashboardPaths() {
  const home = kernelHome();
  return {
    home,
    config: path.join(home, 'config.json'),
    memories: path.join(home, 'source', 'memories'),
    policies: path.join(home, 'source', 'policies', 'policies.json'),
    failures: path.join(home, 'source', 'failures', 'failure-lessons.json'),
    agents: path.join(home, 'source', 'agents', 'agents.json'),
    projects: path.join(home, 'source', 'projects', 'projects.json'),
    pending: path.join(home, 'inbox', 'pending'),
    approved: path.join(home, 'inbox', 'approved'),
    rejected: path.join(home, 'inbox', 'rejected'),
    episodes: path.join(home, 'episodes', 'archive'),
    sessions: path.join(home, 'runtime', 'sessions'),
    commits: path.join(home, 'runtime', 'commits', 'index.json'),
    updateCache: path.join(home, 'runtime', 'update-status.json'),
    reports: path.join(home, 'reports'),
    audit: path.join(home, 'logs', 'audit.jsonl')
  };
}

export function nowIso() {
  return new Date().toISOString();
}

export function exists(filePath) {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

export function enabled(value) {
  return value === true || String(value || '').toLowerCase() === 'true' || value === '1';
}

export function parseFlags(argv) {
  const flags = { _: [] };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg.startsWith('--')) {
      flags._.push(arg);
      continue;
    }
    const raw = arg.slice(2);
    const equals = raw.indexOf('=');
    const name = equals >= 0 ? raw.slice(0, equals) : raw;
    if (!ALLOWED_FLAGS.has(name)) throw new DashboardError('invalid-arguments', `Unknown dashboard flag: --${name}`);
    if (Object.hasOwn(flags, name)) throw new DashboardError('invalid-arguments', `Duplicate flag: --${name}`);
    if (equals >= 0) {
      flags[name] = raw.slice(equals + 1);
      continue;
    }
    const next = argv[index + 1];
    if (['out', 'project'].includes(name)) {
      if (!next || next.startsWith('--')) throw new DashboardError('invalid-arguments', `Flag --${name} requires a value.`);
      flags[name] = next;
      index++;
    } else {
      flags[name] = true;
    }
  }
  if (flags._.length) throw new DashboardError('invalid-arguments', `Unexpected dashboard argument: ${flags._[0]}`);
  return flags;
}

export function redactText(value) {
  let text = String(value ?? '');
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    text = text.replace(pattern, '[REDACTED_SECRET]');
  }
  return text;
}

export function redactLocalPaths(value, projectPath = '') {
  let text = String(value ?? '');
  const replacements = [
    [kernelHome(), '[AGENT_KERNEL_HOME]'],
    [projectPath, '[PROJECT]'],
    [process.env.HOME || '', '~'],
    [process.env.USERPROFILE || '', '~']
  ].filter(([candidate]) => candidate && candidate.length > 1)
    .sort((left, right) => right[0].length - left[0].length);
  for (const [candidate, replacement] of replacements) text = text.split(candidate).join(replacement);
  return text;
}

export function sanitize(value, key = '') {
  if (SENSITIVE_KEY.test(key)) return '[REDACTED_SECRET]';
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map((item) => sanitize(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, sanitize(childValue, childKey)]));
  }
  return value;
}

export function ensureSafeTarget(target) {
  const resolved = path.resolve(target);
  if (exists(resolved)) {
    const stat = fs.lstatSync(resolved);
    if (stat.isSymbolicLink()) throw new DashboardError('unsafe-output', `Dashboard output cannot be a symbolic link: ${resolved}`);
    if (!stat.isFile()) throw new DashboardError('unsafe-output', `Dashboard output must be a regular file: ${resolved}`);
  }
  let current = path.dirname(resolved);
  const missing = [];
  while (!exists(current)) {
    missing.push(current);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  while (current && current !== path.dirname(current)) {
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) throw new DashboardError('unsafe-output', `Dashboard output parent cannot be symbolic: ${current}`);
    current = path.dirname(current);
  }
  for (const dir of missing.reverse()) fs.mkdirSync(dir);
  return resolved;
}

export function writeAtomic(target, content) {
  const temporary = `${target}.tmp-${process.pid}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  try {
    fs.writeFileSync(temporary, content, 'utf8');
    fs.renameSync(temporary, target);
  } catch (error) {
    try { fs.rmSync(temporary, { force: true }); } catch {}
    throw error;
  }
}

function browserPrefix() {
  if (!process.env.AGENT_KERNEL_BROWSER_ARGS_JSON) return [];
  let parsed;
  try {
    parsed = JSON.parse(process.env.AGENT_KERNEL_BROWSER_ARGS_JSON);
  } catch {
    throw new DashboardError('invalid-browser-config', 'AGENT_KERNEL_BROWSER_ARGS_JSON must contain a JSON array.');
  }
  if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== 'string' || value.length > 1000)) {
    throw new DashboardError('invalid-browser-config', 'AGENT_KERNEL_BROWSER_ARGS_JSON must contain a bounded string array.');
  }
  return parsed;
}

export function browserInvocation(filePath) {
  if (process.env.AGENT_KERNEL_BROWSER_BIN) {
    return { command: process.env.AGENT_KERNEL_BROWSER_BIN, args: [...browserPrefix(), filePath], label: 'configured' };
  }
  if (process.platform === 'darwin') return { command: 'open', args: [filePath], label: 'open' };
  if (process.platform === 'win32') return { command: 'rundll32.exe', args: ['url.dll,FileProtocolHandler', pathToFileURL(filePath).href], label: 'rundll32' };
  return { command: 'xdg-open', args: [filePath], label: 'xdg-open' };
}

export function openDashboard(invocation) {
  const result = childProcess.spawnSync(invocation.command, invocation.args, {
    cwd: process.cwd(),
    env: process.env,
    shell: false,
    stdio: 'ignore',
    timeout: 5000
  });
  if (result.error) {
    const category = result.error.code === 'ENOENT' ? 'browser-not-found' : result.error.code === 'ETIMEDOUT' ? 'browser-timeout' : 'browser-error';
    return { opened: false, browser: invocation.label, error: category };
  }
  if (result.status !== 0) return { opened: false, browser: invocation.label, error: 'browser-exit' };
  return { opened: true, browser: invocation.label, error: null };
}

export function appendDashboardAudit(result) {
  const auditPath = dashboardPaths().audit;
  fs.mkdirSync(path.dirname(auditPath), { recursive: true });
  const record = sanitize({
    id: `audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    timestamp: nowIso(),
    actor: 'user',
    operation: 'dashboard.generate',
    targetType: 'dashboard',
    targetId: path.basename(result.path),
    summary: 'Generated read-only static memory dashboard',
    metadata: { opened: result.opened, browser: result.browser, browserError: result.browserError, sections: result.sections.length }
  });
  fs.appendFileSync(auditPath, JSON.stringify(record) + '\n');
}

export function printJson(value) {
  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}
