#!/usr/bin/env node
import childProcess from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const VERSION = '1.8.0';
const DEFAULT_BUDGET = 1800;
const MAX_BUDGET = 20000;
const MAX_ITEMS_PER_SECTION = 20;
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

function readJson(filePath, fallback) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return fallback; }
}

function parseFlags(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const raw = arg.slice(2);
      const eq = raw.indexOf('=');
      if (eq >= 0) flags[raw.slice(0, eq)] = raw.slice(eq + 1);
      else if (argv[i + 1] && !argv[i + 1].startsWith('-')) flags[raw] = argv[++i];
      else flags[raw] = true;
    } else if (arg === '-h') {
      flags.help = true;
    } else {
      flags._.push(arg);
    }
  }
  return flags;
}

function projectRootFrom(cwd, explicitRoot) {
  if (explicitRoot) return path.resolve(cwd, String(explicitRoot));
  try {
    return childProcess.execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return path.resolve(cwd);
  }
}

function slash(value) {
  return String(value || '').replace(/\\/g, '/');
}

function inside(root, target) {
  const rel = path.relative(root, target);
  return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel));
}

function realpathOrSelf(value) {
  if (!value) return value;
  try { return fs.realpathSync.native(value); } catch { /* fall through */ }
  const parent = path.dirname(value);
  const base = path.basename(value);
  try { return path.join(fs.realpathSync.native(parent), base); } catch { return value; }
}

function normalizePath(value, projectRoot, base = projectRoot) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const resolved = path.isAbsolute(raw) ? path.normalize(raw) : path.resolve(base || projectRoot, raw);
  const realRoot = realpathOrSelf(projectRoot);
  const realResolved = realpathOrSelf(resolved);
  if (inside(realRoot, realResolved)) {
    const rel = slash(path.relative(realRoot, realResolved));
    return rel || '.';
  }
  return slash(resolved);
}

function normalizeRequestedFiles(flags, projectRoot, cwd) {
  const values = [];
  const add = (value) => {
    if (Array.isArray(value)) value.forEach(add);
    else if (typeof value === 'string') value.split(',').forEach((part) => {
      const trimmed = part.trim();
      if (trimmed) values.push(trimmed);
    });
  };
  add(flags._);
  add(flags.file);
  add(flags.files);
  return [...new Set(values.map((value) => normalizePath(value, projectRoot, cwd)).filter(Boolean))];
}

function redact(value) {
  let out = String(value || '');
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    out = out.replace(pattern, '[REDACTED_SECRET]');
  }
  return out;
}

function contextPaths() {
  const root = kernelHome();
  return {
    root,
    memories: path.join(root, 'source', 'memories'),
    failures: path.join(root, 'source', 'failures', 'failure-lessons.json'),
    policies: path.join(root, 'source', 'policies', 'policies.json'),
    compiledPolicies: path.join(root, 'dist', 'policy.json'),
    episodeArchive: path.join(root, 'episodes', 'archive'),
    episodeIndex: path.join(root, 'episodes', 'index.json'),
    sessions: path.join(root, 'runtime', 'sessions'),
    pending: path.join(root, 'inbox', 'pending')
  };
}

function readJsonFiles(dir) {
  if (!exists(dir)) return [];
  return fs.readdirSync(dir).sort()
    .filter((name) => name.endsWith('.json'))
    .map((name) => readJson(path.join(dir, name), null))
    .filter(Boolean);
}

function loadApprovedMemory() {
  const p = contextPaths();
  if (!exists(p.memories)) return [];
  const items = [];
  for (const name of fs.readdirSync(p.memories).sort()) {
    if (!name.endsWith('.json')) continue;
    const value = readJson(path.join(p.memories, name), []);
    if (!Array.isArray(value)) continue;
    for (const item of value) {
      if (item && item.status === 'approved') {
        items.push({ ...item, bucket: name.replace(/\.json$/, '') });
      }
    }
  }
  return items;
}

function loadPendingProposals() {
  return readJsonFiles(contextPaths().pending)
    .filter((item) => item && item.status !== 'rejected')
    .map((item) => ({ ...item, status: 'pending', approved: false }));
}

function loadFailureLessons() {
  const value = readJson(contextPaths().failures, []);
  return Array.isArray(value) ? value.filter((item) => item && item.status !== 'rejected') : [];
}

function loadEpisodes() {
  const p = contextPaths();
  const archived = readJsonFiles(p.episodeArchive);
  if (archived.length) return archived;
  const index = readJson(p.episodeIndex, { episodes: [] });
  if (Array.isArray(index)) return index;
  return Array.isArray(index?.episodes) ? index.episodes : [];
}

function loadSessionObservations() {
  const p = contextPaths();
  if (!exists(p.sessions)) return [];
  const observations = [];
  for (const name of fs.readdirSync(p.sessions).sort()) {
    if (!name.endsWith('.jsonl')) continue;
    const raw = readText(path.join(p.sessions, name), '').trim();
    if (!raw) continue;
    for (const line of raw.split(/\r?\n/)) {
      try {
        const item = JSON.parse(line);
        if (item) observations.push({ ...item, sessionId: item.sessionId || name.replace(/\.jsonl$/, '') });
      } catch {
        // Ignore a malformed observation line instead of breaking local recall.
      }
    }
  }
  return observations;
}

function globToRegExp(pattern) {
  const normalized = slash(pattern).replace(/^\.\//, '');
  const escaped = normalized
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '__DOUBLE_STAR__')
    .replace(/\*/g, '[^/]*')
    .replace(/__DOUBLE_STAR__/g, '.*')
    .replace(/\?/g, '[^/]');
  return new RegExp(`^${escaped}$`);
}

function fileMatchesPattern(file, pattern) {
  const normalizedFile = slash(file).replace(/^\.\//, '');
  const normalizedPattern = slash(pattern).replace(/^\.\//, '');
  if (!normalizedPattern.includes('*') && !normalizedPattern.includes('?')) {
    return normalizedFile === normalizedPattern || normalizedFile.endsWith('/' + normalizedPattern);
  }
  try {
    return globToRegExp(normalizedPattern).test(normalizedFile);
  } catch {
    return false;
  }
}

function loadGuardPolicies(requestedFiles) {
  const p = contextPaths();
  const policy = readJson(p.compiledPolicies, readJson(p.policies, {}));
  if (!policy || typeof policy !== 'object') return [];
  const records = [];

  const addPatternGroup = (key, patterns, defaultMessage) => {
    for (const pattern of Array.isArray(patterns) ? patterns : []) {
      for (const file of requestedFiles) {
        if (!fileMatchesPattern(file, pattern)) continue;
        records.push({
          id: `guard:${key}:${pattern}:${file}`,
          type: 'guard-policy',
          policyType: key,
          pattern,
          file,
          message: defaultMessage,
          level: key === 'denyWritePaths' ? 'critical' : 'standard',
          status: 'approved'
        });
      }
    }
  };

  addPatternGroup('denyWritePaths', policy.denyWritePaths, 'Writes to this path are blocked by the local policy pack.');
  addPatternGroup('requireApprovalPaths', policy.requireApprovalPaths, 'Changes to this path require explicit approval.');

  for (const rule of Array.isArray(policy.forbiddenContentPatterns) ? policy.forbiddenContentPatterns : []) {
    const patterns = Array.isArray(rule.files) ? rule.files : [];
    for (const file of requestedFiles) {
      if (!patterns.some((pattern) => fileMatchesPattern(file, pattern))) continue;
      records.push({
        id: `guard:forbiddenContentPatterns:${rule.id || rule.pattern || file}`,
        type: 'guard-policy',
        policyType: 'forbiddenContentPatterns',
        pattern: patterns.join(','),
        file,
        message: rule.message || 'This file is covered by a forbidden-content policy.',
        level: 'critical',
        status: 'approved'
      });
    }
  }

  return records;
}

function recordFiles(item, projectRoot) {
  const values = [];
  const add = (value) => {
    if (Array.isArray(value)) value.forEach(add);
    else if (typeof value === 'string') value.split(',').forEach((part) => {
      const trimmed = part.trim();
      if (trimmed) values.push(trimmed);
    });
  };
  add(item?.files);
  add(item?.file);
  add(item?.source?.files);
  add(item?.metadata?.files);
  add(item?.evidence?.filesTouched);
  const base = item?.cwd || item?.evidence?.cwd || item?.source?.cwd || projectRoot;
  return [...new Set(values.map((value) => normalizePath(value, projectRoot, base)).filter(Boolean))];
}

function timestampOf(item) {
  return String(
    item?.updatedAt ||
    item?.lastSeenAt ||
    item?.timestamp ||
    item?.createdAt ||
    item?.firstSeenAt ||
    ''
  );
}

function relevance(item, requestedFiles, projectRoot, kind) {
  const storedFiles = recordFiles(item, projectRoot);
  const requestedLower = requestedFiles.map((file) => file.toLowerCase());
  const storedLower = storedFiles.map((file) => file.toLowerCase());
  const matchedFiles = requestedFiles.filter((file, index) => {
    const lower = requestedLower[index];
    return storedLower.some((stored) => stored === lower || stored.endsWith('/' + lower) || lower.endsWith('/' + stored));
  });

  let score = matchedFiles.length * 120;
  const text = JSON.stringify(item || {}).toLowerCase();

  for (const file of requestedFiles) {
    const lower = file.toLowerCase();
    if (text.includes(lower)) score += 55;
    const basename = path.posix.basename(lower);
    if (basename.length >= 4 && text.includes(basename)) score += 8;
  }

  if (kind === 'guardPolicies' && item.file && requestedFiles.includes(item.file)) score += 100;
  if (score > 0 && item.level === 'critical') score += 5;
  if (score > 0 && item.status === 'approved') score += 2;

  return { score, matchedFiles, storedFiles };
}

function rank(items, requestedFiles, projectRoot, kind, limit) {
  return items
    .map((item) => {
      const match = relevance(item, requestedFiles, projectRoot, kind);
      return { item, ...match, timestamp: timestampOf(item) };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.timestamp.localeCompare(a.timestamp) || String(a.item.id || '').localeCompare(String(b.item.id || '')))
    .slice(0, limit)
    .map((entry) => compactRecord(entry.item, kind, entry));
}

function trimmed(value, limit = 500) {
  return redact(String(value || '').replace(/\s+/g, ' ').trim()).slice(0, limit);
}

function compactRecord(item, kind, match) {
  const common = {
    id: item.id || item.title || item.errorSignature || `${kind}-item`,
    type: item.type || kind,
    status: item.status || (kind === 'pendingProposals' ? 'pending' : 'approved'),
    timestamp: match.timestamp || null,
    files: match.storedFiles,
    matchedFiles: match.matchedFiles,
    relevanceScore: match.score
  };

  if (kind === 'approvedMemory' || kind === 'pendingProposals') {
    return {
      ...common,
      approved: kind === 'approvedMemory',
      level: item.level || 'standard',
      scope: item.scope || 'global',
      text: trimmed(item.text, 650),
      reason: kind === 'pendingProposals' ? trimmed(item.reason, 240) : undefined
    };
  }

  if (kind === 'failureLessons') {
    return {
      ...common,
      errorSignature: trimmed(item.errorSignature, 180),
      rootCause: trimmed(item.rootCause, 360),
      fixRecipe: (item.fixRecipe || []).map((value) => trimmed(value, 220)).slice(0, 6),
      preventionRule: trimmed(item.preventionRule, 360),
      occurrences: Number(item.occurrences || 1)
    };
  }

  if (kind === 'episodes') {
    return {
      ...common,
      title: trimmed(item.title, 220),
      summary: trimmed(item.summary, 420),
      excerpt: trimmed(item.text, 520),
      agent: trimmed(item.agent, 80),
      project: trimmed(item.project, 120)
    };
  }

  if (kind === 'sessionObservations') {
    return {
      ...common,
      sessionId: item.sessionId || '',
      observationType: item.type || 'observation',
      text: trimmed(item.text, 520),
      command: trimmed(item.command, 260),
      agentId: trimmed(item.agentId, 100)
    };
  }

  if (kind === 'guardPolicies') {
    return {
      ...common,
      policyType: item.policyType,
      pattern: item.pattern,
      file: item.file,
      level: item.level,
      message: trimmed(item.message, 360)
    };
  }

  return { ...common, summary: trimmed(item.summary || item.text || item.title, 500) };
}

function lineFor(kind, item) {
  const pending = kind === 'pendingProposals' ? '[PENDING, UNAPPROVED] ' : '';
  if (kind === 'approvedMemory' || kind === 'pendingProposals') {
    return `- ${pending}${item.id}: ${item.text}`;
  }
  if (kind === 'failureLessons') {
    const detail = item.preventionRule || item.rootCause || item.fixRecipe.join(' | ');
    return `- ${item.errorSignature || item.id}: ${detail}`;
  }
  if (kind === 'episodes') {
    return `- ${item.title || item.id}: ${item.summary || item.excerpt}`;
  }
  if (kind === 'sessionObservations') {
    return `- ${item.observationType} ${item.sessionId}: ${item.text}`;
  }
  if (kind === 'guardPolicies') {
    return `- ${item.file}: ${item.message} (${item.policyType}: ${item.pattern})`;
  }
  return `- ${item.id}`;
}

const SECTION_ORDER = [
  ['approvedMemory', 'Approved Memory'],
  ['failureLessons', 'Failure Lessons'],
  ['episodes', 'Related Episodes'],
  ['sessionObservations', 'Session Observations'],
  ['guardPolicies', 'Guard Policies'],
  ['pendingProposals', 'Pending Proposals']
];

function renderBudgetedSections(allSections, budget) {
  let context = '';
  const sections = Object.fromEntries(SECTION_ORDER.map(([key]) => [key, []]));

  const append = (text) => {
    const separator = context ? '\n' : '';
    const available = budget - context.length - separator.length;
    if (available <= 0) return false;
    const safe = text.length <= available ? text : text.slice(0, available);
    context += separator + safe;
    return safe.length === text.length;
  };

  for (const [key, title] of SECTION_ORDER) {
    const items = allSections[key] || [];
    if (!items.length) continue;

    const heading = `## ${title}`;
    const headingCost = (context ? 1 : 0) + heading.length;
    if (headingCost >= budget - context.length) break;
    append(heading);

    for (const item of items) {
      const line = lineFor(key, item).slice(0, 900);
      const complete = append(line);
      sections[key].push(item);
      if (!complete || context.length >= budget) break;
    }
    if (context.length >= budget) break;
  }

  return { context: context.trimEnd(), sections };
}

function buildFileContext(flags) {
  const cwd = process.cwd();
  const projectRoot = projectRootFrom(cwd, flags['project-root']);
  const files = normalizeRequestedFiles(flags, projectRoot, cwd);
  if (!files.length) {
    throw new Error('At least one file path is required. Usage: agent-kernel file-context <file...> [--budget 1200] [--json]');
  }

  const limit = Math.max(1, Math.min(Number(flags.limit || 8), MAX_ITEMS_PER_SECTION));
  const budget = Math.max(100, Math.min(Number(flags.budget || DEFAULT_BUDGET), MAX_BUDGET));

  const allSections = {
    approvedMemory: rank(loadApprovedMemory(), files, projectRoot, 'approvedMemory', limit),
    failureLessons: rank(loadFailureLessons(), files, projectRoot, 'failureLessons', limit),
    episodes: rank(loadEpisodes(), files, projectRoot, 'episodes', limit),
    sessionObservations: rank(loadSessionObservations(), files, projectRoot, 'sessionObservations', limit),
    guardPolicies: rank(loadGuardPolicies(files), files, projectRoot, 'guardPolicies', limit),
    pendingProposals: rank(loadPendingProposals(), files, projectRoot, 'pendingProposals', limit)
  };

  const rendered = renderBudgetedSections(allSections, budget);
  return {
    version: VERSION,
    home: kernelHome(),
    projectRoot: slash(projectRoot),
    files,
    budget,
    budgetUsed: rendered.context.length,
    context: rendered.context,
    sections: rendered.sections,
    counts: Object.fromEntries(SECTION_ORDER.map(([key]) => [key, allSections[key].length]))
  };
}

function usage() {
  process.stdout.write(`agent-kernel-file-context ${VERSION}\n\nUsage:\n  agent-kernel file-context src/cli.mjs\n  agent-kernel file-context src/cli.mjs test/smoke.mjs --budget 1200\n  agent-kernel file-context src/cli.mjs --json\n\nOptions:\n  --budget <chars>       Maximum rendered context size. Default: ${DEFAULT_BUDGET}\n  --limit <items>        Maximum matches per source. Default: 8\n  --project-root <path>  Override project-root detection\n  --json                 Print structured JSON\n`);
}

function main() {
  const flags = parseFlags(process.argv.slice(2));
  if (flags.help) return usage();

  try {
    const result = buildFileContext(flags);
    if (flags.json) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    else process.stdout.write((result.context || 'No matching local file context found.') + '\n');
  } catch (error) {
    process.stderr.write(`${error?.message || String(error)}\n`);
    process.exitCode = 1;
  }
}

main();
