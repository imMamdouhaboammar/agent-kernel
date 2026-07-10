#!/usr/bin/env node
import childProcess from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const distCliPath = path.join(root, 'dist', 'cli.mjs');
const packageJson = readJson(path.join(root, 'package.json'), { version: '1.0.0' });
const VERSION = packageJson.version || '1.0.0';
const DEFAULT_BUDGET = 1200;
const MAX_BUDGET = 20000;
const MAX_ITEMS = 20;
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

function readJsonFiles(dir) {
  if (!exists(dir)) return [];
  return fs.readdirSync(dir).sort()
    .filter((name) => name.endsWith('.json'))
    .map((name) => readJson(path.join(dir, name), null))
    .filter(Boolean);
}

function redact(value) {
  let text = String(value || '');
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    text = text.replace(pattern, '[REDACTED_SECRET]');
  }
  return text;
}

function slash(value) {
  return String(value || '').replace(/\\/g, '/');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function collectStrings(value) {
  const out = [];
  const add = (item) => {
    if (Array.isArray(item)) item.forEach(add);
    else if (typeof item === 'string') item.split(',').forEach((part) => {
      const trimmed = part.trim();
      if (trimmed) out.push(trimmed);
    });
  };
  add(value);
  return out;
}

function projectCandidates(item) {
  const raw = [
    item?.projectId,
    item?.project,
    item?.project?.id,
    item?.metadata?.projectId,
    item?.source?.projectId,
    item?.evidence?.projectId,
    item?.session?.projectId
  ];
  return unique(raw.map((value) => typeof value === 'string' ? value.trim() : '').filter(Boolean));
}

function matchesProject(item, projectId, kind) {
  if (!projectId) return true;
  const wanted = String(projectId).trim().toLowerCase();
  const candidates = projectCandidates(item).map((value) => value.toLowerCase());
  if (candidates.length) return candidates.includes(wanted);
  if (kind === 'approvedMemory' || kind === 'pendingProposals') {
    return item?.scope !== 'project';
  }
  return item?.scope === 'global';
}

function itemFiles(item, projectRoot) {
  const values = [
    ...collectStrings(item?.file),
    ...collectStrings(item?.files),
    ...collectStrings(item?.source?.files),
    ...collectStrings(item?.metadata?.files),
    ...collectStrings(item?.evidence?.filesTouched)
  ];
  return unique(values.map((value) => {
    const normalized = slash(value).replace(/^\.\//, '');
    if (!normalized) return '';
    if (!path.isAbsolute(value)) return normalized;
    const rel = slash(path.relative(projectRoot, value));
    return rel.startsWith('../') ? normalized : rel;
  }));
}

function requestedFiles(args, projectRoot) {
  const values = [...collectStrings(args?.files), ...collectStrings(args?.file)];
  return unique(values.map((value) => {
    const resolved = path.isAbsolute(value) ? path.normalize(value) : path.resolve(projectRoot, value);
    const rel = slash(path.relative(projectRoot, resolved));
    return rel && !rel.startsWith('../') ? rel : slash(value).replace(/^\.\//, '');
  }));
}

function contextPaths() {
  const home = kernelHome();
  return {
    home,
    memories: path.join(home, 'source', 'memories'),
    failures: path.join(home, 'source', 'failures', 'failure-lessons.json'),
    policies: path.join(home, 'source', 'policies', 'policies.json'),
    compiledPolicies: path.join(home, 'dist', 'policy.json'),
    episodesArchive: path.join(home, 'episodes', 'archive'),
    episodesIndex: path.join(home, 'episodes', 'index.json'),
    sessions: path.join(home, 'runtime', 'sessions'),
    pending: path.join(home, 'inbox', 'pending')
  };
}

function loadApprovedMemory() {
  const p = contextPaths();
  if (!exists(p.memories)) return [];
  const out = [];
  for (const name of fs.readdirSync(p.memories).sort()) {
    if (!name.endsWith('.json')) continue;
    const values = readJson(path.join(p.memories, name), []);
    if (!Array.isArray(values)) continue;
    for (const item of values) {
      if (item && item.status === 'approved') out.push({ ...item, bucket: name.replace(/\.json$/, '') });
    }
  }
  return out;
}

function loadPendingProposals() {
  return readJsonFiles(contextPaths().pending)
    .filter((item) => item && item.status !== 'rejected')
    .map((item) => ({ ...item, status: 'pending', approved: false }));
}

function loadFailureLessons() {
  const values = readJson(contextPaths().failures, []);
  return Array.isArray(values) ? values.filter((item) => item && item.status !== 'rejected') : [];
}

function loadEpisodes() {
  const p = contextPaths();
  const archive = readJsonFiles(p.episodesArchive).filter((item) => item?.status !== 'rejected');
  if (archive.length) return archive;
  const index = readJson(p.episodesIndex, { episodes: [] });
  const values = Array.isArray(index) ? index : index?.episodes;
  return Array.isArray(values) ? values.filter((item) => item?.status !== 'rejected') : [];
}

function loadSessionObservations(sessionId) {
  const dir = contextPaths().sessions;
  if (!exists(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir).sort()) {
    if (!name.endsWith('.jsonl')) continue;
    const fileSessionId = name.replace(/\.jsonl$/, '');
    if (sessionId && fileSessionId !== sessionId) continue;
    const raw = readText(path.join(dir, name), '').trim();
    if (!raw) continue;
    for (const line of raw.split(/\r?\n/)) {
      try {
        const item = JSON.parse(line);
        if (item && item.status !== 'rejected') out.push({ ...item, sessionId: item.sessionId || fileSessionId });
      } catch {
        // Ignore malformed local observations.
      }
    }
  }
  return out;
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

function fileMatches(file, pattern) {
  const normalizedFile = slash(file).replace(/^\.\//, '');
  const normalizedPattern = slash(pattern).replace(/^\.\//, '');
  if (!normalizedPattern.includes('*') && !normalizedPattern.includes('?')) {
    return normalizedFile === normalizedPattern || normalizedFile.endsWith('/' + normalizedPattern);
  }
  try { return globToRegExp(normalizedPattern).test(normalizedFile); } catch { return false; }
}

function loadGuardPolicies(files) {
  if (!files.length) return [];
  const p = contextPaths();
  const policy = readJson(p.compiledPolicies, readJson(p.policies, {}));
  if (!policy || typeof policy !== 'object') return [];
  const out = [];
  const addGroup = (policyType, patterns, message, level) => {
    for (const pattern of Array.isArray(patterns) ? patterns : []) {
      for (const file of files) {
        if (!fileMatches(file, pattern)) continue;
        out.push({
          id: `guard:${policyType}:${pattern}:${file}`,
          type: 'guard-policy',
          policyType,
          pattern,
          file,
          files: [file],
          message,
          level,
          status: 'approved',
          scope: 'global'
        });
      }
    }
  };
  addGroup('denyWritePaths', policy.denyWritePaths, 'Writes to this path are blocked by the local policy pack.', 'critical');
  addGroup('requireApprovalPaths', policy.requireApprovalPaths, 'Changes to this path require explicit approval.', 'standard');
  return out;
}

function textOf(item) {
  return JSON.stringify(item || {}).toLowerCase();
}

function scoreItem(item, options) {
  const text = textOf(item);
  const storedFiles = itemFiles(item, options.projectRoot);
  let score = 0;
  if (options.query && text.includes(options.query.toLowerCase())) score += 40;
  for (const file of options.files) {
    const lower = file.toLowerCase();
    if (storedFiles.some((stored) => stored.toLowerCase() === lower || stored.toLowerCase().endsWith('/' + lower) || lower.endsWith('/' + stored.toLowerCase()))) score += 120;
    else if (text.includes(lower)) score += 50;
    else {
      const base = path.posix.basename(lower);
      if (base.length >= 4 && text.includes(base)) score += 8;
    }
  }
  if (options.sessionId && String(item?.sessionId || '').toLowerCase() === options.sessionId.toLowerCase()) score += 80;
  if (!options.query && !options.files.length && !options.sessionId) score += 1;
  if (score > 0 && item?.level === 'critical') score += 5;
  if (score > 0 && item?.status === 'approved') score += 2;
  return { score, storedFiles };
}

function trim(value, limit = 500) {
  return redact(String(value || '').replace(/\s+/g, ' ').trim()).slice(0, limit);
}

function compactItem(item, kind, projectRoot, score) {
  const files = itemFiles(item, projectRoot);
  const common = {
    id: item?.id || item?.title || item?.errorSignature || `${kind}-item`,
    type: item?.type || kind,
    status: item?.status || (kind === 'pendingProposals' ? 'pending' : 'approved'),
    projectId: projectCandidates(item)[0] || null,
    scope: item?.scope || null,
    files,
    relevanceScore: score
  };
  if (kind === 'approvedMemory' || kind === 'pendingProposals') {
    return { ...common, approved: kind === 'approvedMemory', level: item?.level || 'standard', text: trim(item?.text || item?.summary || item?.title, 650), reason: kind === 'pendingProposals' ? trim(item?.reason, 240) : undefined };
  }
  if (kind === 'failureLessons') {
    return { ...common, errorSignature: trim(item?.errorSignature || item?.signature || item?.title, 180), rootCause: trim(item?.rootCause, 360), preventionRule: trim(item?.preventionRule, 360), fix: trim(item?.fix || item?.summary, 420) };
  }
  if (kind === 'episodes') {
    return { ...common, title: trim(item?.title, 220), summary: trim(item?.summary, 420), excerpt: trim(item?.text, 520), agent: trim(item?.agent, 80) };
  }
  if (kind === 'sessionObservations') {
    return { ...common, sessionId: item?.sessionId || '', observationType: item?.type || 'observation', text: trim(item?.text || item?.summary, 520), command: trim(item?.command, 260), agentId: trim(item?.agentId, 100) };
  }
  if (kind === 'guardPolicies') {
    return { ...common, policyType: item?.policyType, pattern: item?.pattern, file: item?.file, level: item?.level, message: trim(item?.message, 360) };
  }
  return { ...common, summary: trim(item?.summary || item?.text || item?.title, 500) };
}

function rank(items, kind, options) {
  return items
    .filter((item) => matchesProject(item, options.projectId, kind))
    .map((item) => ({ item, ...scoreItem(item, options) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || String(a.item?.id || '').localeCompare(String(b.item?.id || '')))
    .slice(0, options.limit)
    .map((entry) => compactItem(entry.item, kind, options.projectRoot, entry.score));
}

const SECTION_ORDER = [
  ['approvedMemory', 'Approved Memory'],
  ['failureLessons', 'Failure Lessons'],
  ['episodes', 'Related Episodes'],
  ['sessionObservations', 'Session Observations'],
  ['guardPolicies', 'Guard Policies'],
  ['pendingProposals', 'Pending Evidence']
];

function lineFor(kind, item) {
  if (kind === 'approvedMemory') return `- ${item.id}: ${item.text}`;
  if (kind === 'pendingProposals') return `- [PENDING, UNAPPROVED] ${item.id}: ${item.text}`;
  if (kind === 'failureLessons') return `- ${item.errorSignature || item.id}: ${item.preventionRule || item.rootCause || item.fix}`;
  if (kind === 'episodes') return `- ${item.title || item.id}: ${item.summary || item.excerpt}`;
  if (kind === 'sessionObservations') return `- ${item.observationType} ${item.sessionId}: ${item.text}`;
  if (kind === 'guardPolicies') return `- ${item.file}: ${item.message} (${item.policyType}: ${item.pattern})`;
  return `- ${item.id}`;
}

function renderSections(allSections, budget) {
  let context = '';
  const included = Object.fromEntries(SECTION_ORDER.map(([key]) => [key, []]));
  const append = (value) => {
    const separator = context ? '\n' : '';
    const available = budget - context.length - separator.length;
    if (available <= 0) return false;
    const safe = value.length <= available ? value : value.slice(0, available);
    context += separator + safe;
    return safe.length === value.length;
  };
  for (const [key, title] of SECTION_ORDER) {
    const items = allSections[key] || [];
    if (!items.length) continue;
    const heading = `## ${title}`;
    if ((context ? 1 : 0) + heading.length >= budget - context.length) break;
    append(heading);
    for (const item of items) {
      const complete = append(lineFor(key, item).slice(0, 900));
      included[key].push(item);
      if (!complete || context.length >= budget) break;
    }
    if (context.length >= budget) break;
  }
  return { context: context.trimEnd(), sections: included };
}

function buildContext(args = {}, fileOnly = false) {
  const projectRoot = path.resolve(String(args.projectRoot || args.cwd || process.cwd()));
  const files = requestedFiles(args, projectRoot);
  if (fileOnly && !files.length) throw new Error('files is required for agent_kernel_get_file_context');
  const budget = Math.max(100, Math.min(Number(args.budget || DEFAULT_BUDGET), MAX_BUDGET));
  const limit = Math.max(1, Math.min(Number(args.limit || 8), MAX_ITEMS));
  const options = {
    projectRoot,
    projectId: String(args.projectId || '').trim(),
    sessionId: String(args.sessionId || '').trim(),
    query: String(args.query || '').trim(),
    files,
    limit
  };
  const allSections = {
    approvedMemory: rank(loadApprovedMemory(), 'approvedMemory', options),
    failureLessons: rank(loadFailureLessons(), 'failureLessons', options),
    episodes: rank(loadEpisodes(), 'episodes', options),
    sessionObservations: rank(loadSessionObservations(options.sessionId), 'sessionObservations', options),
    guardPolicies: rank(loadGuardPolicies(files), 'guardPolicies', options),
    pendingProposals: rank(loadPendingProposals(), 'pendingProposals', options)
  };
  const rendered = renderSections(allSections, budget);
  return {
    version: VERSION,
    projectId: options.projectId || null,
    sessionId: options.sessionId || null,
    projectRoot: slash(projectRoot),
    query: options.query,
    files,
    budget,
    budgetUsed: rendered.context.length,
    context: rendered.context,
    sections: rendered.sections,
    counts: Object.fromEntries(SECTION_ORDER.map(([key]) => [key, allSections[key].length]))
  };
}

function contextToolDefinitions() {
  return [
    {
      name: 'agent_kernel_get_context',
      description: 'Return compact local project and task context. Approved memory is separated from pending, unapproved evidence. Rejected proposals are never returned.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          query: { type: 'string', description: 'Task or problem to retrieve context for.' },
          projectId: { type: 'string', description: 'Stable local project identifier used to prevent cross-project context leakage.' },
          sessionId: { type: 'string', description: 'Optional local session identifier.' },
          files: { type: 'array', items: { type: 'string' }, description: 'Optional repository-relative file paths.' },
          budget: { type: 'number', minimum: 100, maximum: MAX_BUDGET, default: DEFAULT_BUDGET },
          limit: { type: 'number', minimum: 1, maximum: MAX_ITEMS, default: 8 }
        }
      }
    },
    {
      name: 'agent_kernel_get_file_context',
      description: 'Return compact context for one or more files, scoped to the requested project. Approved memory and pending evidence remain separate.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['files'],
        properties: {
          files: { type: 'array', minItems: 1, items: { type: 'string' }, description: 'Repository-relative file paths.' },
          projectId: { type: 'string', description: 'Stable local project identifier.' },
          projectRoot: { type: 'string', description: 'Optional local project root used only for path normalization.' },
          budget: { type: 'number', minimum: 100, maximum: MAX_BUDGET, default: DEFAULT_BUDGET },
          limit: { type: 'number', minimum: 1, maximum: MAX_ITEMS, default: 8 }
        }
      }
    }
  ];
}

function mcpText(value) {
  return { content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] };
}

function jsonRpcResult(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function jsonRpcError(id, code, message) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

function runBase(args, options = {}) {
  const result = childProcess.spawnSync(process.execPath, [distCliPath, 'mcp', ...args], {
    cwd: process.cwd(),
    env: process.env,
    input: options.input,
    encoding: 'utf8',
    stdio: options.inherit ? 'inherit' : ['pipe', 'pipe', 'pipe'],
    maxBuffer: 2 * 1024 * 1024
  });
  if (result.error) throw result.error;
  if (typeof result.status === 'number' && result.status !== 0) {
    throw new Error(String(result.stderr || `Base MCP command failed with status ${result.status}`).trim());
  }
  return result.stdout || '';
}

function forwardRpc(request) {
  const output = runBase(['serve'], { input: JSON.stringify(request) + '\n' }).trim();
  if (!output) return null;
  const lines = output.split(/\r?\n/).filter(Boolean);
  return JSON.parse(lines[lines.length - 1]);
}

function mergeTools(baseTools = []) {
  const byName = new Map(baseTools.map((tool) => [tool.name, tool]));
  for (const tool of contextToolDefinitions()) byName.set(tool.name, tool);
  return [...byName.values()];
}

function handleRpc(request) {
  if (!request?.method) return null;
  if (request.method.startsWith('notifications/')) return null;
  if (request.method === 'tools/list') {
    const base = forwardRpc(request) || jsonRpcResult(request.id, { tools: [] });
    return jsonRpcResult(request.id, { tools: mergeTools(base?.result?.tools || []) });
  }
  if (request.method === 'tools/call') {
    const name = request.params?.name;
    const args = request.params?.arguments || {};
    if (name === 'agent_kernel_get_context') return jsonRpcResult(request.id, mcpText(buildContext(args, false)));
    if (name === 'agent_kernel_get_file_context') return jsonRpcResult(request.id, mcpText(buildContext(args, true)));
  }
  return forwardRpc(request);
}

function serve() {
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let request;
    try { request = JSON.parse(trimmed); } catch {
      process.stdout.write(JSON.stringify(jsonRpcError(null, -32700, 'Parse error')) + '\n');
      return;
    }
    try {
      const response = handleRpc(request);
      if (response) process.stdout.write(JSON.stringify(response) + '\n');
    } catch (error) {
      process.stdout.write(JSON.stringify(jsonRpcError(request.id, -32603, error?.message || String(error))) + '\n');
    }
  });
}

function testRegistry() {
  let base = { ok: true, server: 'agent-kernel-memory', version: VERSION, tools: [] };
  try {
    const output = runBase(['test']).trim();
    if (output) base = JSON.parse(output);
  } catch {
    // Keep context tools inspectable even if the older registry command fails.
  }
  process.stdout.write(JSON.stringify({ ...base, tools: mergeTools((base.tools || []).map((name) => typeof name === 'string' ? { name } : name)).map((tool) => tool.name) }, null, 2) + '\n');
}

function main() {
  const raw = process.argv.slice(2);
  const args = raw[0] === 'mcp' ? raw.slice(1) : raw;
  const action = args[0];
  if (action === 'serve') return serve();
  if (action === 'test') return testRegistry();
  runBase(args, { inherit: true });
}

main();
