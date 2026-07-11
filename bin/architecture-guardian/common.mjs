import childProcess from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const CODE_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.mts', '.cts',
  '.py', '.go', '.java', '.rb', '.php', '.cs', '.rs', '.kt', '.kts', '.swift'
]);

export const DEFAULT_IGNORES = [
  '.git/**', 'node_modules/**', 'dist/**', 'build/**', 'coverage/**',
  '.next/**', '.nuxt/**', '.cache/**', '.turbo/**', 'vendor/**',
  '.venv/**', 'venv/**', '__pycache__/**', '.agent-kernel/architecture/reports/**'
];

export function nowIso() { return new Date().toISOString(); }
export function slash(value) { return String(value || '').replace(/\\/g, '/'); }
export function normalizeRelative(value) {
  const cleaned = slash(value).replace(/^\.\//, '').replace(/^\/+/, '');
  return cleaned === '.' ? '' : cleaned;
}
export function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
export function readJson(filePath, fallback = null) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return fallback; }
}
export function readText(filePath, fallback = '') {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return fallback; }
}
export function writeJsonAtomic(filePath, value) {
  ensureDir(path.dirname(filePath));
  const temporary = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', 'utf8');
  fs.renameSync(temporary, filePath);
}
export function writeTextAtomic(filePath, value) {
  ensureDir(path.dirname(filePath));
  const temporary = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporary, value, 'utf8');
  fs.renameSync(temporary, filePath);
}
export function stableHash(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
}
export function shortHash(value, length = 16) { return stableHash(value).slice(0, length); }

export function projectRoot(input = '.') {
  const resolved = path.resolve(String(input || '.'));
  try {
    return childProcess.execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: resolved,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return resolved;
  }
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
    if (equals >= 0) {
      flags[raw.slice(0, equals)] = raw.slice(equals + 1);
    } else if (argv[index + 1] && !argv[index + 1].startsWith('-')) {
      flags[raw] = argv[++index];
    } else {
      flags[raw] = true;
    }
  }
  return flags;
}

export function csv(value) {
  if (Array.isArray(value)) return value.flatMap(csv);
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

export function globToRegExp(glob) {
  const normalized = normalizeRelative(glob);
  let expression = '^';
  for (let index = 0; index < normalized.length; index++) {
    const char = normalized[index];
    const next = normalized[index + 1];
    if (char === '*' && next === '*') {
      const after = normalized[index + 2];
      if (after === '/') {
        expression += '(?:.*/)?';
        index += 2;
      } else {
        expression += '.*';
        index += 1;
      }
    } else if (char === '*') {
      expression += '[^/]*';
    } else if (char === '?') {
      expression += '[^/]';
    } else if ('\\.^$+{}()|[]'.includes(char)) {
      expression += `\\${char}`;
    } else {
      expression += char;
    }
  }
  expression += '$';
  return new RegExp(expression);
}

const globCache = new Map();
export function matchesGlob(filePath, glob) {
  const key = String(glob || '');
  if (!globCache.has(key)) globCache.set(key, globToRegExp(key));
  return globCache.get(key).test(normalizeRelative(filePath));
}
export function matchesAny(filePath, patterns = []) {
  return patterns.some((pattern) => matchesGlob(filePath, pattern));
}

export function walkCodeFiles(root, options = {}) {
  const ignores = [...DEFAULT_IGNORES, ...(options.ignore || [])];
  const maxFiles = Math.max(1, Number(options.maxFiles || 10000));
  const maxFileBytes = Math.max(1024, Number(options.maxFileBytes || 768 * 1024));
  const files = [];
  const stack = [''];
  while (stack.length && files.length < maxFiles) {
    const relativeDir = stack.pop();
    const absoluteDir = path.join(root, relativeDir);
    let entries;
    try { entries = fs.readdirSync(absoluteDir, { withFileTypes: true }); } catch { continue; }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const relative = normalizeRelative(path.join(relativeDir, entry.name));
      if (matchesAny(relative, ignores) || matchesAny(`${relative}/`, ignores)) continue;
      if (entry.isDirectory()) {
        stack.push(relative);
        continue;
      }
      if (!entry.isFile() || !CODE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      let stat;
      try { stat = fs.statSync(path.join(root, relative)); } catch { continue; }
      if (stat.size > maxFileBytes) continue;
      files.push(relative);
      if (files.length >= maxFiles) break;
    }
  }
  return files.sort();
}

export function changedFiles(root, options = {}) {
  if (options.files?.length) return [...new Set(options.files.map(normalizeRelative).filter(Boolean))].sort();
  const base = String(options.base || '').trim();
  const args = base
    ? ['diff', '--name-only', '--diff-filter=ACMRTUXB', `${base}...HEAD`]
    : ['diff', '--name-only', '--diff-filter=ACMRTUXB'];
  const stagedArgs = ['diff', '--cached', '--name-only', '--diff-filter=ACMRTUXB'];
  const untrackedArgs = ['ls-files', '--others', '--exclude-standard'];
  const values = [];
  for (const commandArgs of [args, stagedArgs, untrackedArgs]) {
    try {
      const output = childProcess.execFileSync('git', commandArgs, {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      });
      values.push(...output.split(/\r?\n/).map(normalizeRelative).filter(Boolean));
    } catch {
      // Non-git projects are allowed. Scope checks simply receive no inferred files.
    }
  }
  return [...new Set(values)].sort();
}

export function severityRank(value) {
  return { info: 0, warning: 1, medium: 2, high: 3, critical: 4 }[String(value || '').toLowerCase()] ?? 1;
}

export function safeRelative(root, filePath) {
  const absolute = path.resolve(filePath);
  const relative = normalizeRelative(path.relative(root, absolute));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return relative;
}

export function unique(values) { return [...new Set(values.filter((value) => value !== null && value !== undefined && value !== ''))]; }

export function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortObject(value[key])]));
}
