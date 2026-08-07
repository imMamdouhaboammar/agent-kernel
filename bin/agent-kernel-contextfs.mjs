#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const VERSION = '1.20.1';
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u;
const SECRET_KEY = /^(token|password|secret|credential|authorization|cookie|api.?key|private.?key)$/iu;
const SECRET_PATTERNS = [
  /OPENAI_API_KEY\s*=\s*["'][^"']+["']/giu,
  /ANTHROPIC_API_KEY\s*=\s*["'][^"']+["']/giu,
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*["'][^"']+["']/giu,
  /AIza[0-9A-Za-z\-_]{35}/gu,
  /sk-[A-Za-z0-9]{20,}/gu,
  /ghp_[A-Za-z0-9]{20,}/gu,
  /github_pat_[A-Za-z0-9_]{20,}/gu,
  /xox[abposr]-[A-Za-z0-9-]{10,}/gu
];
const ROOT_COLLECTIONS = ['projects', 'global', 'agents', 'skills', 'policies'];
const GLOBAL_COLLECTIONS = ['memory', 'failures', 'episodes', 'sessions', 'commits'];

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
    if (!arg.startsWith('--')) {
      flags._.push(arg);
      continue;
    }
    const raw = arg.slice(2);
    const eq = raw.indexOf('=');
    if (eq >= 0) flags[raw.slice(0, eq)] = raw.slice(eq + 1);
    else if (argv[i + 1] && !argv[i + 1].startsWith('-')) flags[raw] = argv[++i];
    else flags[raw] = true;
  }
  return flags;
}

function invalidUri(value, reason) {
  const error = new Error(`Invalid ContextFS URI: ${String(value || '(empty)')}${reason ? ` (${reason})` : ''}`);
  error.code = 'AK_CONTEXTFS_INVALID_URI';
  return error;
}

function canonicalSegment(segment, raw) {
  if (!segment) throw invalidUri(raw, 'empty path segment');
  let decoded;
  try { decoded = decodeURIComponent(segment); } catch { throw invalidUri(raw, 'malformed percent encoding'); }
  if (!decoded || decoded === '.' || decoded === '..') throw invalidUri(raw, 'dot segments are not allowed');
  if (decoded.includes('/') || decoded.includes('\\') || decoded.includes('\0')) throw invalidUri(raw, 'path separators are not allowed inside segments');
  if (/[\u0000-\u001f\u007f]/u.test(decoded)) throw invalidUri(raw, 'control characters are not allowed');
  return encodeURIComponent(decoded);
}

function parseContextUri(value = 'ak://') {
  const raw = String(value || 'ak://').trim();
  if (!raw.startsWith('ak://')) throw invalidUri(raw, 'scheme must be ak://');
  if (raw.includes('\0') || raw.includes('\\') || raw.includes('?') || raw.includes('#') || raw.includes('@')) {
    throw invalidUri(raw, 'unsafe URI syntax');
  }
  const remainder = raw.slice(5);
  if (!remainder) return { uri: 'ak://', segments: [], directory: true };
  const hadTrailingSlash = remainder.endsWith('/');
  const body = hadTrailingSlash ? remainder.slice(0, -1) : remainder;
  if (!body) return { uri: 'ak://', segments: [], directory: true };
  const rawSegments = body.split('/');
  const segments = rawSegments.map((segment) => canonicalSegment(segment, raw));
  const uri = `ak://${segments.join('/')}${hadTrailingSlash ? '/' : ''}`;
  return { uri, segments: segments.map((segment) => decodeURIComponent(segment)), directory: hadTrailingSlash };
}

function safeText(value) {
  let text = String(value ?? '');
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    text = text.replace(pattern, '[REDACTED_SECRET]');
  }
  return text;
}

function sanitize(value, key = '') {
  if (SECRET_KEY.test(key)) return '[REDACTED_SECRET]';
  if (typeof value === 'string') return safeText(value);
  if (Array.isArray(value)) return value.map((item) => sanitize(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, sanitize(childValue, childKey)]));
  }
  return value;
}

function compact(value, limit = 220) {
  const text = safeText(String(value ?? '')).replace(/\s+/gu, ' ').trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 3))}...`;
}

function stableId(type, source, item) {
  const candidate = String(item?.id || item?.key || item?.name || item?.title || '').trim();
  if (SAFE_ID.test(candidate) && candidate !== '.' && candidate !== '..') return candidate;
  return `${type}_${crypto.createHash('sha256').update(`${source}\n${JSON.stringify(item)}`).digest('hex').slice(0, 16)}`;
}

function arrayValue(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.records)) return value.records;
  if (Array.isArray(value?.episodes)) return value.episodes;
  if (Array.isArray(value?.commits)) return value.commits;
  return [];
}

function memoryRecords() {
  const dir = path.join(kernelHome(), 'source', 'memories');
  if (!exists(dir)) return [];
  const records = [];
  for (const name of fs.readdirSync(dir).sort()) {
    if (!name.endsWith('.json') || name === 'skills.json') continue;
    for (const item of arrayValue(readJson(path.join(dir, name), []))) {
      if (!item || item.status !== 'approved') continue;
      records.push(projectRecord('memory', `source/memories/${name}`, item));
    }
  }
  return records;
}

function failureRecords() {
  const source = 'source/failures/failure-lessons.json';
  return arrayValue(readJson(path.join(kernelHome(), source), [])).filter(Boolean).map((item) => projectRecord('failure', source, item));
}

function episodeRecords() {
  const dir = path.join(kernelHome(), 'episodes', 'archive');
  if (!exists(dir)) return [];
  return fs.readdirSync(dir).sort().filter((name) => name.endsWith('.json')).flatMap((name) => {
    const item = readJson(path.join(dir, name), null);
    return item ? [projectRecord('episode', `episodes/archive/${name}`, item)] : [];
  });
}

function sessionRecords() {
  const dir = path.join(kernelHome(), 'runtime', 'sessions');
  if (!exists(dir)) return [];
  return fs.readdirSync(dir).sort().filter((name) => name.endsWith('.json') && !name.endsWith('.jsonl')).flatMap((name) => {
    const item = readJson(path.join(dir, name), null);
    return item ? [projectRecord('session', `runtime/sessions/${name}`, item)] : [];
  });
}

function commitRecords() {
  const source = 'runtime/commits/index.json';
  return arrayValue(readJson(path.join(kernelHome(), source), [])).filter(Boolean).map((item) => projectRecord('commit', source, item));
}

function skillRecords() {
  const source = 'source/memories/skills.json';
  return arrayValue(readJson(path.join(kernelHome(), source), [])).filter(Boolean).map((item) => projectRecord('skill', source, item));
}

function policyRecords() {
  const source = 'source/policies/policies.json';
  return arrayValue(readJson(path.join(kernelHome(), source), [])).filter(Boolean).map((item) => projectRecord('policy', source, item));
}

function agentRecords() {
  const source = 'source/agents/agents.json';
  return arrayValue(readJson(path.join(kernelHome(), source), [])).filter(Boolean).map((item) => projectRecord('agent', source, item));
}

function projectRecord(type, source, item) {
  const id = stableId(type, source, item);
  return { id, type, source, item };
}

function collectionRecords(scope, collection) {
  if (scope === 'global') {
    if (collection === 'memory') return memoryRecords();
    if (collection === 'failures') return failureRecords();
    if (collection === 'episodes') return episodeRecords();
    if (collection === 'sessions') return sessionRecords();
    if (collection === 'commits') return commitRecords();
  }
  if (scope === 'skills' && !collection) return skillRecords();
  if (scope === 'policies' && !collection) return policyRecords();
  if (scope === 'agents' && !collection) return agentRecords();
  return [];
}

function recordUri(scope, collection, record) {
  if (scope === 'global') return `ak://global/${collection}/${encodeURIComponent(record.id)}`;
  return `ak://${scope}/${encodeURIComponent(record.id)}`;
}

function abstractFor(record) {
  const item = record.item || {};
  return compact(
    item.abstract || item.text || item.summary || item.title || item.fix || item.rootCause || item.reason || item.errorSignature || item.id || record.id,
    220
  ) || `${record.type} ${record.id}`;
}

function stringList(value, limit = 12) {
  const list = Array.isArray(value) ? value : (typeof value === 'string' ? value.split(',') : []);
  return [...new Set(list.map((item) => compact(item, 180)).filter(Boolean))].slice(0, limit);
}

function overviewFor(record) {
  const item = record.item || {};
  return sanitize({
    id: record.id,
    type: record.type,
    title: compact(item.title || item.errorSignature || item.text || item.summary || record.id, 180),
    status: item.status || null,
    project: item.projectId || item.project || item.metadata?.projectId || null,
    files: stringList(item.files || item.evidence?.filesTouched),
    commands: stringList(item.commands || item.command || item.evidence?.command),
    tags: stringList(item.tags),
    updatedAt: item.updatedAt || item.lastSeenAt || item.endedAt || item.timestamp || item.createdAt || null,
    source: record.source
  });
}

function recordProjection(scope, collection, record, level) {
  const uri = recordUri(scope, collection, record);
  const result = {
    uri,
    kind: 'record',
    type: record.type,
    id: record.id,
    level,
    abstract: abstractFor(record),
    provenance: { source: record.source }
  };
  if (level >= 1) result.overview = overviewFor(record);
  if (level >= 2) result.details = sanitize(record.item);
  return result;
}

function directoryEntry(name, uri) {
  return { name, uri, kind: 'directory' };
}

function recordEntry(scope, collection, record) {
  return {
    name: record.id,
    uri: recordUri(scope, collection, record),
    kind: 'record',
    type: record.type,
    abstract: abstractFor(record)
  };
}

function treeFor(parsed, depth) {
  const segments = parsed.segments;
  if (segments.length === 0) {
    return {
      uri: 'ak://',
      kind: 'directory',
      depth,
      entries: ROOT_COLLECTIONS.map((name) => directoryEntry(name, `ak://${name}/`))
    };
  }

  if (segments.length === 1 && segments[0] === 'global') {
    return {
      uri: 'ak://global/',
      kind: 'directory',
      depth,
      entries: GLOBAL_COLLECTIONS.map((name) => directoryEntry(name, `ak://global/${name}/`))
    };
  }

  if (segments.length === 1 && ['agents', 'skills', 'policies'].includes(segments[0])) {
    const scope = segments[0];
    return {
      uri: `ak://${scope}/`,
      kind: 'directory',
      depth,
      entries: collectionRecords(scope, null).map((record) => recordEntry(scope, null, record))
    };
  }

  if (segments.length === 1 && segments[0] === 'projects') {
    const projects = new Set();
    for (const record of [...memoryRecords(), ...failureRecords(), ...episodeRecords(), ...sessionRecords()]) {
      const item = record.item || {};
      const project = item.projectId || item.project || item.metadata?.projectId || null;
      if (project) projects.add(String(project));
    }
    return {
      uri: 'ak://projects/',
      kind: 'directory',
      depth,
      entries: [...projects].sort().map((name) => directoryEntry(name, `ak://projects/${encodeURIComponent(name)}/`))
    };
  }

  if (segments.length === 2 && segments[0] === 'global' && GLOBAL_COLLECTIONS.includes(segments[1])) {
    const collection = segments[1];
    return {
      uri: `ak://global/${collection}/`,
      kind: 'directory',
      depth,
      entries: collectionRecords('global', collection).map((record) => recordEntry('global', collection, record))
    };
  }

  throw invalidUri(parsed.uri, 'unknown ContextFS directory');
}

function readRecord(parsed, level) {
  const segments = parsed.segments;
  if (segments.length === 3 && segments[0] === 'global' && GLOBAL_COLLECTIONS.includes(segments[1])) {
    const collection = segments[1];
    const id = segments[2];
    const record = collectionRecords('global', collection).find((candidate) => candidate.id === id);
    if (!record) throw new Error(`ContextFS record not found: ${parsed.uri}`);
    return recordProjection('global', collection, record, level);
  }
  if (segments.length === 2 && ['agents', 'skills', 'policies'].includes(segments[0])) {
    const scope = segments[0];
    const id = segments[1];
    const record = collectionRecords(scope, null).find((candidate) => candidate.id === id);
    if (!record) throw new Error(`ContextFS record not found: ${parsed.uri}`);
    return recordProjection(scope, null, record, level);
  }
  throw invalidUri(parsed.uri, 'record path expected');
}

function lower(value) {
  return String(value ?? '').toLowerCase();
}

function queryTerms(query) {
  return lower(query).match(/[\p{L}\p{N}_./:-]+/gu)?.filter((term) => term.length > 1) || [];
}

function projectFor(record) {
  const item = record.item || {};
  return String(item.projectId || item.project || item.metadata?.projectId || item.source?.projectId || '').trim();
}

function filesFor(record) {
  const item = record.item || {};
  return stringList(item.files || item.evidence?.filesTouched, 50);
}

function searchableText(record) {
  return lower(safeText(JSON.stringify({
    id: record.id,
    type: record.type,
    abstract: abstractFor(record),
    overview: overviewFor(record),
    rootCause: record.item?.rootCause,
    fix: record.item?.fix,
    reason: record.item?.reason,
    summary: record.item?.summary,
    text: record.item?.text,
    title: record.item?.title,
    errorSignature: record.item?.errorSignature
  })));
}

function candidateScore(record, query, projectId, requestedFiles) {
  const item = record.item || {};
  if (item.status === 'rejected') return { score: 0, signals: ['rejected'] };
  const project = projectFor(record);
  if (projectId && project && lower(project) !== lower(projectId)) return { score: 0, signals: ['project-mismatch'] };

  const text = searchableText(record);
  const terms = queryTerms(query);
  const signals = [];
  let score = 0;
  const phrase = lower(query).trim();
  if (phrase && text.includes(phrase)) {
    score += 14;
    signals.push('phrase');
  }
  for (const term of terms) {
    if (text.includes(term)) {
      score += 3;
      signals.push(`term:${term}`);
    }
  }
  if (terms.length && !terms.some((term) => text.includes(term))) return { score: 0, signals: ['no-query-match'] };

  if (projectId) {
    if (project && lower(project) === lower(projectId)) {
      score += 12;
      signals.push('project-exact');
    } else if (!project) {
      score += 1;
      signals.push('project-unspecified');
    }
  }

  const recordFiles = filesFor(record).map(lower);
  for (const requested of requestedFiles.map(lower)) {
    if (recordFiles.includes(requested)) {
      score += 18;
      signals.push(`file-exact:${requested}`);
    } else if (recordFiles.some((file) => file.endsWith(`/${requested}`) || requested.endsWith(`/${file}`))) {
      score += 10;
      signals.push(`file-related:${requested}`);
    }
  }

  const occurrences = Number(item.occurrences || 0);
  if (Number.isFinite(occurrences) && occurrences > 1) {
    score += Math.min(occurrences, 5);
    signals.push(`occurrences:${occurrences}`);
  }
  return { score, signals };
}

function eligibleGlobalCollections(under) {
  const { segments, directory } = under;
  if (!directory) throw invalidUri(under.uri, 'find scope must be a directory');
  if (segments.length === 0) return GLOBAL_COLLECTIONS;
  if (segments.length === 1 && segments[0] === 'global') return GLOBAL_COLLECTIONS;
  if (segments.length === 2 && segments[0] === 'global' && GLOBAL_COLLECTIONS.includes(segments[1])) return [segments[1]];
  throw invalidUri(under.uri, 'find currently supports ak://, ak://global/, or a global collection');
}

function findContext(flags) {
  const query = flags._.slice(1).join(' ').trim();
  if (!query) throw new Error('Usage: agent-kernel context find <query> [--under ak://...] [--project-id id] [--file path] [--budget N] [--limit N] [--trace] [--json]');
  const under = parseContextUri(String(flags.under || 'ak://global/'));
  const collections = eligibleGlobalCollections(under);
  const projectId = String(flags['project-id'] || flags.projectId || '').trim();
  const requestedFiles = stringList(flags.file || flags.files, 20);
  const limit = Math.max(1, Math.min(Number(flags.limit || 8), 50));
  const budget = Math.max(200, Math.min(Number(flags.budget || 1200), 12000));
  const trace = [];
  const candidates = [];

  for (const collection of collections) {
    const records = collectionRecords('global', collection);
    const scored = records.map((record) => ({ record, ...candidateScore(record, query, projectId, requestedFiles) }));
    const collectionScore = scored.reduce((max, entry) => Math.max(max, entry.score), 0);
    trace.push({
      stage: 'collection',
      collection,
      uri: `ak://global/${collection}/`,
      score: collectionScore,
      decision: collectionScore > 0 ? 'descend' : 'skip'
    });
    for (const entry of scored) {
      const uri = recordUri('global', collection, entry.record);
      if (entry.score <= 0) {
        trace.push({ stage: 'candidate', collection, uri, score: 0, decision: 'skip', signals: entry.signals });
        continue;
      }
      candidates.push({ collection, ...entry, uri });
    }
  }

  candidates.sort((a, b) => b.score - a.score || a.uri.localeCompare(b.uri));
  const selected = candidates.slice(0, limit);
  const results = [];
  let budgetUsed = 0;

  for (let index = 0; index < selected.length; index++) {
    const candidate = selected[index];
    let projection = recordProjection('global', candidate.collection, candidate.record, index === 0 ? 1 : 0);
    projection = { ...projection, score: candidate.score };
    let size = JSON.stringify(projection).length;
    if (budgetUsed + size > budget && projection.level === 1) {
      projection = { ...recordProjection('global', candidate.collection, candidate.record, 0), score: candidate.score };
      size = JSON.stringify(projection).length;
    }
    if (budgetUsed + size > budget) {
      trace.push({ stage: 'candidate', collection: candidate.collection, uri: candidate.uri, score: candidate.score, decision: 'budget-skip', signals: candidate.signals });
      continue;
    }
    results.push(projection);
    budgetUsed += size;
    trace.push({ stage: 'candidate', collection: candidate.collection, uri: candidate.uri, score: candidate.score, decision: 'include', level: projection.level, signals: candidate.signals });
  }

  return {
    version: VERSION,
    query,
    under: under.uri,
    projectId: projectId || null,
    files: requestedFiles,
    budget,
    budgetUsed,
    results,
    ...(flags.trace ? { trace } : {})
  };
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function printTree(tree) {
  process.stdout.write(`${tree.uri}\n`);
  for (const entry of tree.entries) process.stdout.write(`${entry.kind === 'directory' ? 'd' : 'r'}\t${entry.uri}\t${entry.abstract || ''}\n`);
}

function printRecord(record) {
  process.stdout.write(`${record.uri}\n${record.abstract}\n`);
  if (record.overview) process.stdout.write(`${JSON.stringify(record.overview, null, 2)}\n`);
  if (record.details) process.stdout.write(`${JSON.stringify(record.details, null, 2)}\n`);
}

function printFind(result) {
  for (const item of result.results) {
    process.stdout.write(`${item.score}\t${item.uri}\tL${item.level}\t${item.abstract}\n`);
  }
}

function usage() {
  process.stdout.write(`agent-kernel ContextFS ${VERSION}\n\nUsage:\n  agent-kernel context tree [ak://...] [--depth N] [--json]\n  agent-kernel context read <ak://...> [--level 0|1|2] [--json]\n  agent-kernel context find <query> [--under ak://...] [--project-id id] [--file path] [--budget N] [--limit N] [--trace] [--json]\n`);
}

function commandTree(flags) {
  const parsed = parseContextUri(flags._[1] || 'ak://');
  const depth = Math.max(1, Math.min(Number(flags.depth || 1), 5));
  const tree = treeFor(parsed, depth);
  if (flags.json) printJson(tree); else printTree(tree);
}

function commandRead(flags) {
  const rawUri = flags._[1];
  if (!rawUri) throw new Error('Usage: agent-kernel context read <ak://...> [--level 0|1|2] [--json]');
  const parsed = parseContextUri(rawUri);
  const level = Number(flags.level ?? 1);
  if (![0, 1, 2].includes(level)) throw new Error(`Invalid context level: ${flags.level}. Use 0, 1, or 2.`);
  const record = readRecord(parsed, level);
  if (flags.json) printJson(record); else printRecord(record);
}

function commandFind(flags) {
  const result = findContext(flags);
  if (flags.json) printJson(result); else printFind(result);
}

function main() {
  const flags = parseFlags(process.argv.slice(2));
  const command = flags._[0];
  if (!command || flags.help || flags.h) return usage();
  if (command === 'tree') return commandTree(flags);
  if (command === 'read') return commandRead(flags);
  if (command === 'find') return commandFind(flags);
  throw new Error(`Unknown ContextFS command: ${command}`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error?.message || error}\n`);
  process.exitCode = 1;
}