#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findProject, loadProjectRegistry } from './agent-kernel-project-model.mjs';

const VERSION = '1.20.1';
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u;
const PROJECT_COLLECTIONS = ['memory', 'failures', 'episodes', 'sessions', 'files', 'architecture', 'commits'];
const SECRET_KEY = /(?:^|[_-])(token|password|secret|credential|authorization|cookie|api.?key|private.?key|service.?role.?key|access.?key)(?:$|[_-])/iu;
const SECRET_PATTERNS = [
  /OPENAI_API_KEY\s*=\s*["'][^"']+["']/giu,
  /ANTHROPIC_API_KEY\s*=\s*["'][^"']+["']/giu,
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*["'][^"']+["']/giu,
  /(OPENAI_API_KEY|ANTHROPIC_API_KEY|SUPABASE_SERVICE_ROLE_KEY)\s*=\s*[^\s\n]+/giu,
  /AIza[0-9A-Za-z\-_]{35}/gu,
  /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/gu,
  /ghp_[A-Za-z0-9]{20,}/gu,
  /github_pat_[A-Za-z0-9_]{20,}/gu,
  /xox[abposr]-[A-Za-z0-9-]{10,}/gu
];
const FILE_RECORD_CACHE = new Map();

function kernelHome() {
  return process.env.AGENT_KERNEL_HOME || path.join(os.homedir(), '.agent-kernel');
}

function exists(filePath) {
  try { fs.accessSync(filePath); return true; } catch { return false; }
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

function boundedInteger(value, fallback, minimum, maximum, label) {
  if (value === undefined || value === null || value === '') return fallback;
  const raw = String(value).trim();
  if (!/^-?\d+$/u.test(raw)) throw new Error(`Invalid ${label}: ${value}. Expected a finite safe integer.`);
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed)) throw new Error(`Invalid ${label}: ${value}. Expected a finite safe integer.`);
  return Math.max(minimum, Math.min(parsed, maximum));
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

function parseContextUri(value = 'ak://projects/') {
  const raw = String(value || '').trim();
  if (!raw.startsWith('ak://')) throw invalidUri(raw, 'scheme must be ak://');
  if (raw.includes('\0') || raw.includes('\\') || raw.includes('?') || raw.includes('#') || raw.includes('@')) {
    throw invalidUri(raw, 'unsafe URI syntax');
  }
  const remainder = raw.slice(5);
  if (!remainder) return { uri: 'ak://', segments: [], directory: true };
  const trailing = remainder.endsWith('/');
  const body = trailing ? remainder.slice(0, -1) : remainder;
  if (!body) return { uri: 'ak://', segments: [], directory: true };
  const segments = body.split('/').map((segment) => canonicalSegment(segment, raw));
  return {
    uri: `ak://${segments.join('/')}${trailing ? '/' : ''}`,
    segments: segments.map((segment) => decodeURIComponent(segment)),
    directory: trailing
  };
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

function stringList(value, limit = 20) {
  const list = Array.isArray(value) ? value : (typeof value === 'string' ? value.split(',') : []);
  return [...new Set(list.map((item) => compact(item, 240)).filter(Boolean))].slice(0, limit);
}

function canonicalProjectId(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9._-]+/gu, '-').replace(/^-+|-+$/gu, '');
}

function projectForItem(item) {
  return canonicalProjectId(item?.projectId || item?.project || item?.metadata?.projectId || item?.source?.projectId || '');
}

function baseRecord(type, source, item) {
  return { id: stableId(type, source, item), type, source, item };
}

function memoryRecords() {
  const dir = path.join(kernelHome(), 'source', 'memories');
  if (!exists(dir)) return [];
  const records = [];
  for (const name of fs.readdirSync(dir).sort()) {
    if (!name.endsWith('.json') || name === 'skills.json') continue;
    for (const item of arrayValue(readJson(path.join(dir, name), []))) {
      if (!item || item.status !== 'approved') continue;
      records.push(baseRecord('memory', `source/memories/${name}`, item));
    }
  }
  return records;
}

function failureRecords() {
  const source = 'source/failures/failure-lessons.json';
  return arrayValue(readJson(path.join(kernelHome(), source), [])).filter(Boolean).map((item) => baseRecord('failure', source, item));
}

function episodeRecords() {
  const dir = path.join(kernelHome(), 'episodes', 'archive');
  if (!exists(dir)) return [];
  return fs.readdirSync(dir).sort().filter((name) => name.endsWith('.json')).flatMap((name) => {
    const item = readJson(path.join(dir, name), null);
    return item ? [baseRecord('episode', `episodes/archive/${name}`, item)] : [];
  });
}

function sessionRecords() {
  const dir = path.join(kernelHome(), 'runtime', 'sessions');
  if (!exists(dir)) return [];
  return fs.readdirSync(dir).sort().filter((name) => name.endsWith('.json') && !name.endsWith('.context-commit.json') && !name.endsWith('.context-commit.in-progress.json')).flatMap((name) => {
    const item = readJson(path.join(dir, name), null);
    return item ? [baseRecord('session', `runtime/sessions/${name}`, item)] : [];
  });
}

function commitRecords() {
  const source = 'runtime/commits/index.json';
  return arrayValue(readJson(path.join(kernelHome(), source), [])).filter(Boolean).map((item) => baseRecord('commit', source, item));
}

function sourceRecords(collection) {
  if (collection === 'memory') return memoryRecords();
  if (collection === 'failures') return failureRecords();
  if (collection === 'episodes') return episodeRecords();
  if (collection === 'sessions') return sessionRecords();
  if (collection === 'commits') return commitRecords();
  return [];
}

function projectRecords(projectId, collection) {
  const canonical = canonicalProjectId(projectId);
  return sourceRecords(collection).filter((record) => projectForItem(record.item) === canonical && record.item?.status !== 'rejected');
}

function projectRecordUri(projectId, collection, recordId) {
  const canonical = canonicalProjectId(projectId);
  return `ak://projects/${encodeURIComponent(canonical)}/${collection}/${encodeURIComponent(recordId)}`;
}

function fileId(projectId, filePath) {
  const canonical = canonicalProjectId(projectId);
  return `file_${crypto.createHash('sha256').update(`${canonical}\n${filePath}`).digest('hex').slice(0, 16)}`;
}

function allProjectSourceRecords(projectId) {
  return ['memory', 'failures', 'episodes', 'sessions', 'commits'].flatMap((collection) =>
    projectRecords(projectId, collection).map((record) => ({ collection, record }))
  );
}

function fileRecords(projectId) {
  const canonical = canonicalProjectId(projectId);
  if (FILE_RECORD_CACHE.has(canonical)) return FILE_RECORD_CACHE.get(canonical);
  const files = new Map();
  for (const { collection, record } of allProjectSourceRecords(canonical)) {
    for (const filePath of stringList(record.item?.files || record.item?.evidence?.filesTouched, 100)) {
      const normalized = String(filePath).replace(/\\/gu, '/').replace(/^\.\//u, '').trim();
      if (!normalized || normalized.includes('\0') || normalized.split('/').includes('..')) continue;
      const current = files.get(normalized) || {
        id: fileId(canonical, normalized),
        type: 'file',
        source: 'derived:file-references',
        item: { projectId: canonical, path: normalized, references: [] }
      };
      current.item.references.push({ collection, recordId: record.id });
      files.set(normalized, current);
    }
  }
  const result = [...files.values()].sort((a, b) => a.item.path.localeCompare(b.item.path));
  FILE_RECORD_CACHE.set(canonical, result);
  return result;
}

function architectureRecords() {
  return [];
}

function collectionRecords(projectId, collection) {
  if (collection === 'files') return fileRecords(projectId);
  if (collection === 'architecture') return architectureRecords(projectId);
  return projectRecords(projectId, collection);
}

function abstractFor(record) {
  const item = record.item || {};
  if (record.type === 'file') return `Referenced project file ${compact(item.path, 180)}`;
  return compact(
    item.abstract || item.text || item.summary || item.title || item.fix || item.rootCause || item.reason || item.errorSignature || item.id || record.id,
    220
  ) || `${record.type} ${record.id}`;
}

function overviewFor(projectId, record) {
  const item = record.item || {};
  if (record.type === 'file') {
    return sanitize({
      id: record.id,
      type: record.type,
      project: projectId,
      path: item.path,
      references: item.references,
      source: record.source
    });
  }
  return sanitize({
    id: record.id,
    type: record.type,
    title: compact(item.title || item.errorSignature || item.text || item.summary || record.id, 180),
    status: item.status || null,
    project: projectId,
    files: stringList(item.files || item.evidence?.filesTouched, 20),
    commands: stringList(item.commands || item.command || item.evidence?.command, 20),
    commits: stringList(item.commits || item.commit || item.sha, 20),
    tags: stringList(item.tags, 20),
    updatedAt: item.updatedAt || item.lastSeenAt || item.endedAt || item.timestamp || item.createdAt || null,
    source: record.source
  });
}

function fileRecordForPath(projectId, filePath) {
  return fileRecords(projectId).find((record) => record.item.path === filePath) || null;
}

function relationsFor(projectId, collection, record) {
  const canonical = canonicalProjectId(projectId);
  const relations = [{ type: 'owned-by-project', target: `ak://projects/${encodeURIComponent(canonical)}/` }];
  if (record.type === 'file') {
    for (const reference of record.item?.references || []) {
      relations.push({ type: 'referenced-by', target: projectRecordUri(canonical, reference.collection, reference.recordId) });
    }
    return relations.slice(0, 12);
  }
  for (const filePath of stringList(record.item?.files || record.item?.evidence?.filesTouched, 10)) {
    const fileRecord = fileRecordForPath(canonical, String(filePath).replace(/\\/gu, '/').replace(/^\.\//u, ''));
    if (!fileRecord) continue;
    relations.push({
      type: 'references-file',
      target: projectRecordUri(canonical, 'files', fileRecord.id),
      path: fileRecord.item.path
    });
  }
  return relations.slice(0, 12);
}

function recordProjection(projectId, collection, record, level) {
  const canonical = canonicalProjectId(projectId);
  const result = {
    uri: projectRecordUri(canonical, collection, record.id),
    kind: 'record',
    type: record.type,
    id: record.id,
    projectId: canonical,
    level,
    abstract: abstractFor(record),
    relations: relationsFor(canonical, collection, record),
    provenance: { source: record.source }
  };
  if (level >= 1) result.overview = overviewFor(canonical, record);
  if (level >= 2) result.details = sanitize(record.item);
  return result;
}

function directoryEntry(name, uri) {
  return { name, uri, kind: 'directory' };
}

function recordEntry(projectId, collection, record) {
  const entry = {
    name: record.id,
    uri: projectRecordUri(projectId, collection, record.id),
    kind: 'record',
    type: record.type,
    abstract: abstractFor(record)
  };
  if (record.type === 'file') entry.path = record.item.path;
  return entry;
}

function knownProjectIds() {
  const ids = new Set();
  for (const project of loadProjectRegistry().projects) {
    const projectId = canonicalProjectId(project.projectId);
    if (projectId) ids.add(projectId);
  }
  for (const collection of ['memory', 'failures', 'episodes', 'sessions', 'commits']) {
    for (const record of sourceRecords(collection)) {
      const projectId = projectForItem(record.item);
      if (projectId) ids.add(projectId);
    }
  }
  return [...ids].sort();
}

function requireKnownProject(projectId) {
  const canonical = canonicalProjectId(projectId);
  if (!canonical || !knownProjectIds().includes(canonical)) throw new Error(`ContextFS project not found: ${projectId || '(empty)'}`);
  return canonical;
}

function baseTreeFor(parsed) {
  const segments = parsed.segments;
  if (segments.length === 1 && segments[0] === 'projects') {
    return {
      uri: 'ak://projects/',
      kind: 'directory',
      entries: knownProjectIds().map((projectId) => directoryEntry(projectId, `ak://projects/${encodeURIComponent(projectId)}/`))
    };
  }
  if (segments.length === 2 && segments[0] === 'projects') {
    const projectId = requireKnownProject(segments[1]);
    return {
      uri: `ak://projects/${encodeURIComponent(projectId)}/`,
      kind: 'directory',
      projectId,
      entries: PROJECT_COLLECTIONS.map((collection) => directoryEntry(collection, `ak://projects/${encodeURIComponent(projectId)}/${collection}/`))
    };
  }
  if (segments.length === 3 && segments[0] === 'projects' && PROJECT_COLLECTIONS.includes(segments[2])) {
    const projectId = requireKnownProject(segments[1]);
    const collection = segments[2];
    return {
      uri: `ak://projects/${encodeURIComponent(projectId)}/${collection}/`,
      kind: 'directory',
      projectId,
      collection,
      entries: collectionRecords(projectId, collection).map((record) => recordEntry(projectId, collection, record))
    };
  }
  throw invalidUri(parsed.uri, 'unknown project ContextFS directory');
}

function treeFor(parsed, depth) {
  const base = baseTreeFor(parsed);
  if (depth <= 1) return { ...base, depth };
  const entries = base.entries.map((entry) => {
    if (entry.kind !== 'directory') return entry;
    const child = treeFor(parseContextUri(entry.uri), depth - 1);
    return { ...entry, entries: child.entries };
  });
  return { ...base, depth, entries };
}

function readRecord(parsed, level) {
  const segments = parsed.segments;
  if (segments.length !== 4 || segments[0] !== 'projects' || !PROJECT_COLLECTIONS.includes(segments[2])) {
    throw invalidUri(parsed.uri, 'project record path expected');
  }
  const projectId = requireKnownProject(segments[1]);
  const collection = segments[2];
  const record = collectionRecords(projectId, collection).find((candidate) => candidate.id === segments[3]);
  if (!record) throw new Error(`ContextFS record not found: ${parsed.uri}`);
  return recordProjection(projectId, collection, record, level);
}

function lower(value) {
  return String(value ?? '').toLowerCase();
}

function queryTerms(query) {
  return lower(query).match(/[\p{L}\p{N}_./:-]+/gu)?.filter((term) => term.length > 1) || [];
}

function searchableText(record) {
  const item = record.item || {};
  return lower(safeText(JSON.stringify({
    type: record.type,
    abstract: abstractFor(record),
    rootCause: item.rootCause,
    fix: item.fix,
    reason: item.reason,
    summary: item.summary,
    text: item.text,
    title: item.title,
    errorSignature: item.errorSignature,
    tags: item.tags,
    commands: item.commands || item.command
  })));
}

function filesFor(record) {
  if (record.type === 'file') return [record.item.path];
  return stringList(record.item?.files || record.item?.evidence?.filesTouched, 50);
}

function candidateScore(record, query, requestedFiles) {
  if (record.item?.status === 'rejected') return { score: 0, signals: ['rejected'] };
  const text = searchableText(record);
  const terms = queryTerms(query);
  const lexicalSignals = [];
  let lexicalScore = 0;
  const phrase = lower(query).trim();
  if (phrase && text.includes(phrase)) {
    lexicalScore += 14;
    lexicalSignals.push('phrase');
  }
  for (const term of terms) {
    if (text.includes(term)) {
      lexicalScore += 3;
      lexicalSignals.push(`term:${term}`);
    }
  }

  const recordFiles = filesFor(record).map(lower);
  const fileSignals = [];
  let fileScore = 0;
  for (const requested of requestedFiles.map(lower)) {
    if (recordFiles.includes(requested)) {
      fileScore += 18;
      fileSignals.push(`file-exact:${requested}`);
    } else if (recordFiles.some((file) => file.endsWith(`/${requested}`) || requested.endsWith(`/${file}`))) {
      fileScore += 10;
      fileSignals.push(`file-related:${requested}`);
    }
  }

  if (lexicalScore === 0 && fileScore === 0) return { score: 0, signals: ['no-query-match'] };

  const signals = ['project-exact', ...lexicalSignals, ...fileSignals];
  let score = 12 + lexicalScore + fileScore;
  const occurrences = Number(record.item?.occurrences || 0);
  if (Number.isFinite(occurrences) && occurrences > 1) {
    score += Math.min(occurrences, 5);
    signals.push(`occurrences:${occurrences}`);
  }
  return { score, signals };
}

function projectFromUnder(rawUnder) {
  if (!rawUnder) return null;
  const under = parseContextUri(rawUnder);
  if (!under.directory || under.segments[0] !== 'projects' || under.segments.length < 2 || under.segments.length > 3) {
    throw invalidUri(under.uri, 'project find scope must be a project directory or collection');
  }
  if (under.segments.length === 3 && !PROJECT_COLLECTIONS.includes(under.segments[2])) {
    throw invalidUri(under.uri, 'unknown project collection');
  }
  const projectId = requireKnownProject(under.segments[1]);
  const canonicalUnder = under.segments.length === 3
    ? parseContextUri(`ak://projects/${encodeURIComponent(projectId)}/${under.segments[2]}/`)
    : parseContextUri(`ak://projects/${encodeURIComponent(projectId)}/`);
  return { projectId, under: canonicalUnder };
}

function resolveProjectScope(flags) {
  const underScope = projectFromUnder(flags.under ? String(flags.under) : null);
  const explicitId = canonicalProjectId(flags['project-id'] || flags.projectId || '');
  let pathProject = null;
  if (flags.project) {
    pathProject = findProject(String(flags.project));
    if (!pathProject) throw new Error(`ContextFS project not found for --project: ${flags.project}`);
  }
  const values = [underScope?.projectId, explicitId || null, canonicalProjectId(pathProject?.projectId || '') || null].filter(Boolean);
  const uniqueIds = [...new Set(values)];
  if (uniqueIds.length > 1) throw new Error(`Project scope mismatch: ${uniqueIds.join(' != ')}`);
  const projectId = requireKnownProject(uniqueIds[0]);
  const under = underScope?.under || parseContextUri(`ak://projects/${encodeURIComponent(projectId)}/`);
  return { projectId, under };
}

function eligibleCollections(under) {
  if (under.segments.length === 2) return PROJECT_COLLECTIONS.filter((collection) => collection !== 'architecture');
  if (under.segments.length === 3) return [under.segments[2]];
  throw invalidUri(under.uri, 'project find scope must be project root or collection');
}

function relationCandidates(projectId, seed, includedUris) {
  const sharedFiles = new Set(filesFor(seed.record).map((file) => lower(file)));
  if (!sharedFiles.size) return [];
  const output = [];
  for (const collection of ['memory', 'failures', 'episodes', 'sessions', 'commits']) {
    for (const record of collectionRecords(projectId, collection)) {
      const uri = projectRecordUri(projectId, collection, record.id);
      if (includedUris.has(uri)) continue;
      const matchingFiles = filesFor(record).filter((file) => sharedFiles.has(lower(file)));
      if (!matchingFiles.length) continue;
      output.push({
        collection,
        record,
        uri,
        score: Math.max(1, Math.floor(seed.score * 0.5)),
        signals: matchingFiles.map((file) => `relation:file:${file}`),
        from: seed.uri
      });
    }
  }
  return output.sort((a, b) => b.score - a.score || a.uri.localeCompare(b.uri)).slice(0, 4);
}

function findContext(flags) {
  const query = flags._.slice(1).join(' ').trim();
  if (!query) throw new Error('Usage: agent-kernel context find <query> [--under ak://projects/<id>/] [--project path] [--project-id id] [--file path] [--budget N] [--limit N] [--trace] [--json]');
  const { projectId, under } = resolveProjectScope(flags);
  const collections = eligibleCollections(under);
  const requestedFiles = stringList(flags.file || flags.files, 20).map((file) => String(file).replace(/\\/gu, '/').replace(/^\.\//u, ''));
  const limit = boundedInteger(flags.limit, 8, 1, 50, 'limit');
  const budget = boundedInteger(flags.budget, 1200, 200, 12000, 'budget');
  const trace = [];
  const candidates = [];

  for (const collection of collections) {
    const records = collectionRecords(projectId, collection);
    const scored = records.map((record) => ({ record, ...candidateScore(record, query, requestedFiles) }));
    const collectionScore = scored.reduce((maximum, entry) => Math.max(maximum, entry.score), 0);
    trace.push({
      stage: 'collection',
      collection,
      uri: `ak://projects/${encodeURIComponent(projectId)}/${collection}/`,
      score: collectionScore,
      decision: collectionScore > 0 ? 'descend' : 'skip'
    });
    for (const entry of scored) {
      const uri = projectRecordUri(projectId, collection, entry.record.id);
      if (entry.score <= 0) {
        trace.push({ stage: 'candidate', collection, uri, score: 0, decision: 'skip', signals: entry.signals });
        continue;
      }
      candidates.push({ collection, ...entry, uri });
    }
  }

  candidates.sort((a, b) => b.score - a.score || a.uri.localeCompare(b.uri));
  const selected = candidates.slice(0, limit);
  const includedUris = new Set(selected.map((candidate) => candidate.uri));
  const seed = selected[0] || null;
  const related = seed ? relationCandidates(projectId, seed, includedUris) : [];
  for (const relation of related) {
    if (selected.length >= limit) break;
    selected.push(relation);
    includedUris.add(relation.uri);
    trace.push({
      stage: 'relation',
      relation: 'references-file',
      from: relation.from,
      uri: relation.uri,
      score: relation.score,
      decision: 'include',
      signals: relation.signals
    });
  }
  selected.sort((a, b) => b.score - a.score || a.uri.localeCompare(b.uri));

  const results = [];
  let budgetUsed = 0;
  for (let index = 0; index < selected.length; index++) {
    const candidate = selected[index];
    let projection = recordProjection(projectId, candidate.collection, candidate.record, index === 0 ? 1 : 0);
    projection = { ...projection, score: candidate.score };
    let size = JSON.stringify(projection).length;
    if (budgetUsed + size > budget && projection.level === 1) {
      projection = { ...recordProjection(projectId, candidate.collection, candidate.record, 0), score: candidate.score };
      size = JSON.stringify(projection).length;
    }
    if (budgetUsed + size > budget) {
      trace.push({ stage: 'candidate', collection: candidate.collection, uri: candidate.uri, score: candidate.score, decision: 'budget-skip', signals: candidate.signals });
      continue;
    }
    results.push(projection);
    budgetUsed += size;
    if (!related.some((relation) => relation.uri === candidate.uri)) {
      trace.push({ stage: 'candidate', collection: candidate.collection, uri: candidate.uri, score: candidate.score, decision: 'include', level: projection.level, signals: candidate.signals });
    }
  }

  return {
    version: VERSION,
    query,
    under: under.uri,
    projectId,
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
  for (const item of result.results) process.stdout.write(`${item.score}\t${item.uri}\tL${item.level}\t${item.abstract}\n`);
}

function usage() {
  process.stdout.write(`agent-kernel project ContextFS ${VERSION}\n\nUsage:\n  agent-kernel context tree ak://projects/[<id>/[collection/]] [--depth N] [--json]\n  agent-kernel context read ak://projects/<id>/<collection>/<record> [--level 0|1|2] [--json]\n  agent-kernel context find <query> --under ak://projects/<id>/ [--project path] [--file path] [--budget N] [--limit N] [--trace] [--json]\n`);
}

function commandTree(flags) {
  const parsed = parseContextUri(flags._[1] || 'ak://projects/');
  const depth = boundedInteger(flags.depth, 1, 1, 5, 'depth');
  const tree = treeFor(parsed, depth);
  if (flags.json) printJson(tree); else printTree(tree);
}

function commandRead(flags) {
  const rawUri = flags._[1];
  if (!rawUri) throw new Error('Usage: agent-kernel context read <ak://projects/...> [--level 0|1|2] [--json]');
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
  throw new Error(`Unknown project ContextFS command: ${command}`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error?.message || error}\n`);
  process.exitCode = 1;
}
