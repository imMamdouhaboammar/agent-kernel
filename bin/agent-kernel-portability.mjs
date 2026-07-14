#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const pkg = readJson(path.join(root, 'package.json'), { version: '1.0.0' });
const VERSION = pkg.version || '1.0.0';
const EXPORT_SCHEMA_VERSION = 1;
const DEFAULT_RETENTION_DAYS = 30;
const SAFE_FILE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;
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

function kernelHome() {
  return process.env.AGENT_KERNEL_HOME || path.join(os.homedir(), '.agent-kernel');
}

function nowIso() {
  return new Date().toISOString();
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
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

function writeTextAtomic(filePath, text) {
  ensureDir(path.dirname(filePath));
  const temporary = `${filePath}.tmp-${process.pid}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  try {
    fs.writeFileSync(temporary, text, 'utf8');
    fs.renameSync(temporary, filePath);
  } catch (error) {
    try { fs.rmSync(temporary, { force: true }); } catch {}
    throw error;
  }
}

function writeJsonAtomic(filePath, value) {
  writeTextAtomic(filePath, JSON.stringify(value, null, 2) + '\n');
}

function appendJsonl(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, JSON.stringify(value) + '\n');
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
    const name = eq >= 0 ? raw.slice(0, eq) : raw;
    if (Object.hasOwn(flags, name)) throw new Error(`Duplicate flag: --${name}`);
    if (eq >= 0) flags[name] = raw.slice(eq + 1);
    else if (argv[i + 1] && !argv[i + 1].startsWith('-')) flags[name] = argv[++i];
    else flags[name] = true;
  }
  return flags;
}

function rejectFlagCombination(flags, pairs) {
  for (const [left, right] of pairs) {
    if (flags[left] && flags[right]) throw new Error(`Flags --${left} and --${right} cannot be used together.`);
  }
}

function paths() {
  const home = kernelHome();
  return {
    home,
    config: path.join(home, 'config.json'),
    memories: path.join(home, 'source', 'memories'),
    policies: path.join(home, 'source', 'policies', 'policies.json'),
    failures: path.join(home, 'source', 'failures', 'failure-lessons.json'),
    episodesArchive: path.join(home, 'episodes', 'archive'),
    episodeIndex: path.join(home, 'episodes', 'index.json'),
    agents: path.join(home, 'source', 'agents', 'agents.json'),
    projects: path.join(home, 'source', 'projects', 'projects.json'),
    sessions: path.join(home, 'runtime', 'sessions'),
    commits: path.join(home, 'runtime', 'commits', 'index.json'),
    daemon: path.join(home, 'runtime', 'daemon.json'),
    pending: path.join(home, 'inbox', 'pending'),
    audit: path.join(home, 'logs', 'audit.jsonl'),
    importBackups: path.join(home, 'imports', 'backups')
  };
}

function redactText(value) {
  let text = String(value ?? '');
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    text = text.replace(pattern, '[REDACTED_SECRET]');
  }
  return text;
}

function sanitize(value, key = '') {
  if (SENSITIVE_KEY.test(key)) return '[REDACTED_SECRET]';
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map((item) => sanitize(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, sanitize(childValue, childKey)]));
  }
  return value;
}

function audit(operation, input = {}) {
  const record = sanitize({
    id: `audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    timestamp: nowIso(),
    actor: input.actor || 'user',
    agentId: input.agentId || null,
    operation,
    targetType: input.targetType || null,
    targetId: input.targetId || null,
    summary: input.summary || operation,
    metadata: input.metadata || {}
  });
  appendJsonl(paths().audit, record);
  return record;
}

function requireSafeFileId(value, label) {
  const id = String(value || '');
  if (!SAFE_FILE_ID.test(id) || id === '.' || id === '..') {
    throw new Error(`Invalid ${label}: ${id || '(empty)'}`);
  }
  return id;
}

function memoryBucketPath(bucket) {
  const name = requireSafeFileId(bucket, 'memory bucket');
  const base = path.resolve(paths().memories);
  const target = path.resolve(base, `${name}.json`);
  if (path.dirname(target) !== base) throw new Error(`Memory bucket escapes the memories directory: ${bucket}`);
  return target;
}

function retentionConfig() {
  const config = readJson(paths().config, {});
  const parsed = Number(config.runtimeRetentionDays);
  return {
    runtimeRetentionDays: Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : DEFAULT_RETENTION_DAYS,
    keepFailureEvidence: config.keepFailureEvidence !== false,
    keepApprovedMemoryForever: config.keepApprovedMemoryForever !== false,
    autoPruneRawObservations: config.autoPruneRawObservations === true
  };
}

function parseDurationDays(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const match = String(value).trim().toLowerCase().match(/^(\d+)(d|day|days)?$/);
  if (!match || Number(match[1]) < 1) throw new Error(`Invalid duration: ${value}. Use a value such as 30d.`);
  return Number(match[1]);
}

function sessionRecords() {
  const dir = paths().sessions;
  if (!exists(dir)) return [];
  return fs.readdirSync(dir).sort()
    .filter((name) => name.endsWith('.json') && !name.endsWith('.jsonl'))
    .map((name) => readJson(path.join(dir, name), null))
    .filter(Boolean);
}

function observationFiles() {
  const dir = paths().sessions;
  if (!exists(dir)) return [];
  return fs.readdirSync(dir).sort().filter((name) => name.endsWith('.jsonl')).map((name) => path.join(dir, name));
}

function readObservations(sessionId) {
  const raw = readText(path.join(paths().sessions, `${sessionId}.jsonl`), '').trim();
  if (!raw) return { records: [], malformed: 0 };
  let malformed = 0;
  const records = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try { records.push(JSON.parse(line)); } catch { malformed++; }
  }
  return { records, malformed };
}

function fileTimestamp(filePath, session) {
  const candidates = [session?.updatedAt, session?.endedAt, session?.startedAt]
    .map((value) => Date.parse(value || ''))
    .filter(Number.isFinite);
  if (candidates.length) return Math.max(...candidates);
  try { return fs.statSync(filePath).mtimeMs; } catch { return Date.now(); }
}

function retentionPlan(flags = {}) {
  const config = retentionConfig();
  const days = parseDurationDays(flags['older-than'] || flags.olderThan, config.runtimeRetentionDays);
  const cutoffMs = Date.now() - days * 86400000;
  const logs = observationFiles().map((filePath) => {
    const session = readJson(filePath.replace(/\.jsonl$/, '.json'), null);
    const timestampMs = fileTimestamp(filePath, session);
    const parsed = readObservations(path.basename(filePath, '.jsonl'));
    return {
      sessionId: path.basename(filePath, '.jsonl'),
      filePath,
      updatedAt: new Date(timestampMs).toISOString(),
      bytes: fs.statSync(filePath).size,
      observationCount: parsed.records.length,
      malformedLineCount: parsed.malformed,
      eligible: timestampMs < cutoffMs
    };
  });
  return {
    config,
    days,
    cutoff: new Date(cutoffMs).toISOString(),
    rawLogCount: logs.length,
    eligibleCount: logs.filter((item) => item.eligible).length,
    eligibleBytes: logs.filter((item) => item.eligible).reduce((sum, item) => sum + item.bytes, 0),
    malformedLineCount: logs.reduce((sum, item) => sum + item.malformedLineCount, 0),
    logs
  };
}

function printJson(value) {
  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}

function commandRetentionStatus(flags) {
  const plan = retentionPlan(flags);
  if (flags.json) return printJson(plan);
  process.stdout.write(`Runtime retention: ${plan.days} day(s)\n`);
  process.stdout.write(`Raw session logs: ${plan.rawLogCount}\n`);
  process.stdout.write(`Eligible for prune: ${plan.eligibleCount}\n`);
  process.stdout.write(`Eligible bytes: ${plan.eligibleBytes}\n`);
  process.stdout.write(`Malformed observation lines: ${plan.malformedLineCount}\n`);
  process.stdout.write(`Approved memory protected: ${plan.config.keepApprovedMemoryForever ? 'yes' : 'no'}\n`);
  process.stdout.write(`Failure evidence protected: ${plan.config.keepFailureEvidence ? 'yes' : 'no'}\n`);
}

function commandRetentionPrune(flags) {
  const plan = retentionPlan(flags);
  const eligible = plan.logs.filter((item) => item.eligible);
  const dryRun = flags['dry-run'] || flags.dryRun;
  if (!dryRun && !flags.force) throw new Error('Retention prune requires --force. Run with --dry-run first.');
  const deleted = [];
  if (!dryRun) {
    for (const item of eligible) {
      fs.rmSync(item.filePath, { force: true });
      const sessionPath = item.filePath.replace(/\.jsonl$/, '.json');
      const session = readJson(sessionPath, null);
      if (session) {
        writeJsonAtomic(sessionPath, {
          ...session,
          rawObservationsPrunedAt: nowIso(),
          prunedObservationCount: item.observationCount,
          prunedMalformedLineCount: item.malformedLineCount,
          retainedSummary: session.summary || ''
        });
      }
      deleted.push(item);
    }
  }
  const result = {
    dryRun: !!dryRun,
    cutoff: plan.cutoff,
    retentionDays: plan.days,
    matched: eligible.length,
    deleted: deleted.length,
    bytes: eligible.reduce((sum, item) => sum + item.bytes, 0),
    sessions: eligible.map((item) => item.sessionId),
    protected: { approvedMemory: true, policies: true, failureLessons: plan.config.keepFailureEvidence }
  };
  audit(dryRun ? 'retention.prune.dry-run' : 'retention.prune', {
    targetType: 'session-observations',
    summary: dryRun ? 'Previewed raw observation prune' : 'Pruned raw session observations',
    metadata: result
  });
  if (flags.json) return printJson(result);
  process.stdout.write(`${dryRun ? 'Would prune' : 'Pruned'} ${eligible.length} raw session log(s), ${result.bytes} byte(s)\n`);
  if (eligible.length) process.stdout.write(`Sessions: ${result.sessions.join(', ')}\n`);
}

function compactList(values, limit = 12) {
  return [...new Set(values.filter(Boolean))].slice(0, limit);
}

function deterministicSummary(session, observations, malformedLineCount) {
  const files = compactList(observations.flatMap((item) => Array.isArray(item.files) ? item.files : []));
  const commands = compactList(observations.map((item) => item.command));
  const failures = observations.filter((item) => /failure|error|blocked/i.test(String(item.type || '')) || Number(item.exitCode) > 0);
  const task = observations.find((item) => item.type === 'user_prompt')?.text || observations[0]?.text || session.summary || 'No task text captured.';
  const latest = observations.at(-1)?.text || '';
  const stableTimestamp = session.endedAt || session.updatedAt || session.startedAt || session.createdAt || null;
  return {
    sourceSessionId: session.id,
    generatedAt: stableTimestamp,
    method: 'deterministic-local',
    mainTask: String(task).replace(/\s+/g, ' ').trim().slice(0, 500),
    outcome: String(latest).replace(/\s+/g, ' ').trim().slice(0, 500),
    files,
    commands,
    failureCount: failures.length,
    failureTypes: compactList(failures.map((item) => item.type)),
    observationCount: observations.length,
    malformedLineCount,
    linkedFailures: session.linkedFailures || [],
    linkedEpisodes: session.linkedEpisodes || [],
    linkedCommits: session.linkedCommits || []
  };
}

function commandSessionCompact(flags) {
  const sessionId = requireSafeFileId(flags._[0] || flags.session, 'session ID');
  const sessionPath = path.join(paths().sessions, `${sessionId}.json`);
  const session = readJson(sessionPath, null);
  if (!session) throw new Error(`Session not found: ${sessionId}`);
  const parsed = readObservations(sessionId);
  const compacted = deterministicSummary(session, parsed.records, parsed.malformed);
  const dryRun = flags['dry-run'] || flags.dryRun;
  if (!dryRun) {
    const compactedAt = nowIso();
    writeJsonAtomic(sessionPath, {
      ...session,
      summary: compacted.mainTask,
      compactSummary: compacted,
      compactedAt,
      compactedObservationCount: parsed.records.length,
      compactedMalformedLineCount: parsed.malformed
    });
    audit('session.compact', {
      targetType: 'session',
      targetId: sessionId,
      agentId: session.agentId || null,
      summary: 'Compacted session locally without approving memory',
      metadata: { observationCount: parsed.records.length, malformedLineCount: parsed.malformed, rawLogRetained: exists(path.join(paths().sessions, `${sessionId}.jsonl`)) }
    });
  }
  const result = { dryRun: !!dryRun, rawLogRetained: exists(path.join(paths().sessions, `${sessionId}.jsonl`)), summary: compacted };
  if (flags.json) return printJson(result);
  process.stdout.write(`${dryRun ? 'Compaction preview' : 'Compacted session'} ${sessionId}: ${parsed.records.length} observation(s), raw log retained\n`);
}

function memoryBuckets(scope = 'all') {
  const dir = paths().memories;
  const result = {};
  if (!exists(dir)) return result;
  for (const name of fs.readdirSync(dir).sort()) {
    if (!name.endsWith('.json')) continue;
    const bucket = name.replace(/\.json$/, '');
    if (!SAFE_FILE_ID.test(bucket)) continue;
    const records = readJson(path.join(dir, name), []);
    if (!Array.isArray(records)) continue;
    result[bucket] = scope === 'approved' ? records.filter((item) => item?.status === 'approved') : records;
  }
  return result;
}

function episodes() {
  const p = paths();
  if (exists(p.episodesArchive)) {
    const records = fs.readdirSync(p.episodesArchive).sort()
      .filter((name) => name.endsWith('.json'))
      .map((name) => readJson(path.join(p.episodesArchive, name), null))
      .filter(Boolean);
    if (records.length) return records;
  }
  const index = readJson(p.episodeIndex, { episodes: [] });
  return Array.isArray(index) ? index : (Array.isArray(index?.episodes) ? index.episodes : []);
}

function observationsBySession() {
  const result = {};
  for (const filePath of observationFiles()) {
    const id = path.basename(filePath, '.jsonl');
    result[id] = readObservations(id).records;
  }
  return result;
}

function exportBundle(flags) {
  const scope = String(flags.scope || 'all');
  if (!['all', 'approved'].includes(scope)) throw new Error(`Unsupported export scope: ${scope}`);
  const includeSessions = scope !== 'approved' && flags['no-sessions'] !== true;
  const includeObservations = scope !== 'approved' && flags['include-observations'] === true;
  const p = paths();
  return sanitize({
    schemaVersion: EXPORT_SCHEMA_VERSION,
    format: 'agent-kernel-export',
    kernelVersion: VERSION,
    exportedAt: nowIso(),
    scope,
    redactionMode: flags.redact ? 'explicit' : 'default',
    exclusions: ['secrets', 'credentials', 'runtime daemon PID files', 'temporary cache files'],
    data: {
      memories: memoryBuckets(scope),
      policies: readJson(p.policies, {}),
      failures: scope === 'approved' ? [] : readJson(p.failures, []),
      episodes: scope === 'approved' ? [] : episodes(),
      agents: readJson(p.agents, { version: 1, agents: [] }),
      projects: readJson(p.projects, { version: 1, projects: [] }),
      sessions: includeSessions ? sessionRecords() : [],
      observations: includeObservations ? observationsBySession() : {},
      commitLinks: scope === 'approved' ? { version: 1, commits: {} } : readJson(p.commits, { version: 1, commits: {} })
    }
  });
}

function commandExport(flags) {
  if (!flags._[0] && !flags.out) throw new Error('Usage: agent-kernel export <file.json> [--redact] [--scope approved]');
  const target = path.resolve(String(flags._[0] || flags.out));
  const bundle = exportBundle(flags);
  writeJsonAtomic(target, bundle);
  audit('export.create', {
    targetType: 'export', targetId: target, summary: 'Created redacted local export',
    metadata: { scope: bundle.scope, schemaVersion: bundle.schemaVersion, observationsIncluded: Object.keys(bundle.data.observations).length > 0 }
  });
  const result = { ok: true, path: target, schemaVersion: bundle.schemaVersion, scope: bundle.scope, redactionMode: bundle.redactionMode };
  if (flags.json) return printJson(result);
  process.stdout.write(`Exported Agent Kernel data to ${target}\n`);
}

function validateBundle(bundle) {
  if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) throw new Error('Import file must contain a JSON object.');
  if (bundle.format !== 'agent-kernel-export') throw new Error('Import file has an unsupported format.');
  if (bundle.schemaVersion !== EXPORT_SCHEMA_VERSION) throw new Error(`Unsupported export schema version: ${bundle.schemaVersion}`);
  if (!bundle.data || typeof bundle.data !== 'object' || Array.isArray(bundle.data)) throw new Error('Import file is missing data.');
  const memories = bundle.data.memories;
  if (!memories || typeof memories !== 'object' || Array.isArray(memories)) throw new Error('Import file is missing memory buckets.');
  for (const [bucket, records] of Object.entries(memories)) {
    requireSafeFileId(bucket, 'memory bucket');
    if (!Array.isArray(records)) throw new Error(`Memory bucket ${bucket} must contain an array.`);
  }
  for (const key of ['failures', 'episodes', 'sessions']) {
    if (bundle.data[key] !== undefined && !Array.isArray(bundle.data[key])) throw new Error(`Import data.${key} must be an array.`);
  }
  if (bundle.data.observations !== undefined && (!bundle.data.observations || typeof bundle.data.observations !== 'object' || Array.isArray(bundle.data.observations))) {
    throw new Error('Import data.observations must be an object.');
  }
  for (const [sessionId, records] of Object.entries(bundle.data.observations || {})) {
    requireSafeFileId(sessionId, 'observation session ID');
    if (!Array.isArray(records)) throw new Error(`Observations for ${sessionId} must be an array.`);
  }
  for (const session of bundle.data.sessions || []) requireSafeFileId(session?.id, 'session ID');
  return bundle;
}

function importedRecords(bundle) {
  return Object.entries(bundle.data.memories || {}).flatMap(([bucket, values]) => values.map((item) => ({ bucket, item })));
}

function currentMemoryRecords() {
  return Object.values(memoryBuckets('all')).flat();
}

function pendingRecords() {
  const dir = paths().pending;
  if (!exists(dir)) return [];
  return fs.readdirSync(dir).filter((name) => name.endsWith('.json')).map((name) => readJson(path.join(dir, name), null)).filter(Boolean);
}

function importedProposal(record, sourcePath) {
  const item = sanitize(record.item);
  const sourceId = String(item.id || 'imported-memory');
  const hash = crypto.createHash('sha256').update(`${record.bucket}\n${sourceId}\n${item.text || ''}`).digest('hex').slice(0, 12);
  const timestamp = nowIso();
  return {
    id: `import_${Date.now()}_${hash}`,
    type: item.type || 'project-note',
    scope: item.scope || 'global',
    level: item.level || 'standard',
    text: String(item.text || item.summary || item.title || `Imported ${record.bucket} record ${sourceId}`).slice(0, 2000),
    targets: Array.isArray(item.targets) && item.targets.length ? item.targets : ['all'],
    tags: [...new Set([...(Array.isArray(item.tags) ? item.tags : []), 'imported', `bucket:${record.bucket}`])],
    status: 'pending',
    reason: `Review-first import from ${path.basename(sourcePath)}. Source record: ${sourceId}.`,
    source: { channel: 'import', importedFrom: path.basename(sourcePath), importSourceId: sourceId, importBucket: record.bucket },
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1
  };
}

function policyProposal(bundle, sourcePath) {
  const policies = sanitize(bundle.data.policies || {});
  if (!Object.keys(policies).length) return null;
  const text = `Review imported policy pack from ${path.basename(sourcePath)}. Imported policy JSON: ${JSON.stringify(policies).slice(0, 1500)}`;
  const hash = crypto.createHash('sha256').update(text).digest('hex').slice(0, 12);
  const timestamp = nowIso();
  return {
    id: `import_${Date.now()}_${hash}`,
    type: 'policy', scope: 'global', level: 'critical', text, targets: ['all'], tags: ['imported', 'policy-pack'], status: 'pending',
    reason: 'Imported policy packs require explicit review before replacing local policy configuration.',
    source: { channel: 'import', importedFrom: path.basename(sourcePath), importSourceId: `policy-pack:${hash}`, importBucket: 'policies' },
    createdAt: timestamp, updatedAt: timestamp, version: 1
  };
}

function isImportConflict(record, current, pending) {
  const sourceId = record.item?.id;
  const text = record.item?.text;
  return current.some((item) => item.id === sourceId || (text && item.text === text)) ||
    pending.some((item) => item.source?.importSourceId === sourceId || (text && item.text === text));
}

function importInspection(bundle, sourcePath) {
  const incoming = importedRecords(bundle);
  const current = currentMemoryRecords();
  const pending = pendingRecords();
  const conflicts = incoming.filter((record) => isImportConflict(record, current, pending));
  return {
    path: sourcePath,
    schemaVersion: bundle.schemaVersion,
    sourceKernelVersion: bundle.kernelVersion || null,
    scope: bundle.scope || 'all',
    memoryRecords: incoming.length,
    policyPack: Object.keys(bundle.data.policies || {}).length > 0,
    failureLessons: bundle.data.failures?.length || 0,
    episodes: bundle.data.episodes?.length || 0,
    sessions: bundle.data.sessions?.length || 0,
    observationSessions: Object.keys(bundle.data.observations || {}).length,
    conflicts: conflicts.map(({ bucket, item }) => ({ bucket, id: item.id || null, text: String(item.text || '').slice(0, 160) }))
  };
}

function copyPath(source, destination) {
  if (!exists(source)) return;
  if (fs.statSync(source).isDirectory()) fs.cpSync(source, destination, { recursive: true });
  else { ensureDir(path.dirname(destination)); fs.copyFileSync(source, destination); }
}

function backupCurrentState() {
  const p = paths();
  const target = path.join(p.importBackups, `${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(3).toString('hex')}`);
  ensureDir(target);
  for (const [name, source] of [
    ['memories', p.memories], ['policies.json', p.policies], ['failures.json', p.failures], ['agents.json', p.agents],
    ['projects.json', p.projects], ['episodes', p.episodesArchive], ['sessions', p.sessions], ['commits.json', p.commits]
  ]) copyPath(source, path.join(target, name));
  return target;
}

function clearMatchingFiles(dir, predicate) {
  if (!exists(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (predicate(name)) fs.rmSync(path.join(dir, name), { force: true, recursive: true });
  }
}

function replaceFromBundle(bundle) {
  const p = paths();
  const backup = backupCurrentState();
  ensureDir(p.memories);
  clearMatchingFiles(p.memories, (name) => name.endsWith('.json'));
  for (const [bucket, records] of Object.entries(bundle.data.memories || {})) writeJsonAtomic(memoryBucketPath(bucket), sanitize(records));
  writeJsonAtomic(p.policies, sanitize(bundle.data.policies || {}));
  writeJsonAtomic(p.failures, sanitize(bundle.data.failures || []));
  if (bundle.data.agents) writeJsonAtomic(p.agents, sanitize(bundle.data.agents));
  if (bundle.data.projects) writeJsonAtomic(p.projects, sanitize(bundle.data.projects));

  ensureDir(p.episodesArchive);
  clearMatchingFiles(p.episodesArchive, (name) => name.endsWith('.json'));
  for (const episode of bundle.data.episodes || []) {
    if (!episode?.id) continue;
    const id = requireSafeFileId(episode.id, 'episode ID');
    writeJsonAtomic(path.join(p.episodesArchive, `${id}.json`), sanitize(episode));
  }

  ensureDir(p.sessions);
  clearMatchingFiles(p.sessions, (name) => name.endsWith('.json') || name.endsWith('.jsonl'));
  for (const session of bundle.data.sessions || []) {
    const id = requireSafeFileId(session.id, 'session ID');
    writeJsonAtomic(path.join(p.sessions, `${id}.json`), sanitize(session));
  }
  for (const [sessionId, observations] of Object.entries(bundle.data.observations || {})) {
    const id = requireSafeFileId(sessionId, 'observation session ID');
    writeTextAtomic(path.join(p.sessions, `${id}.jsonl`), observations.map((item) => JSON.stringify(sanitize(item))).join('\n') + (observations.length ? '\n' : ''));
  }
  writeJsonAtomic(p.commits, sanitize(bundle.data.commitLinks || { version: 1, commits: {} }));
  return {
    backup,
    restored: {
      memoryBuckets: Object.keys(bundle.data.memories || {}).length,
      sessions: bundle.data.sessions?.length || 0,
      observationSessions: Object.keys(bundle.data.observations || {}).length,
      commitLinks: Object.keys(bundle.data.commitLinks?.commits || {}).length
    }
  };
}

function commandImport(flags) {
  rejectFlagCombination(flags, [['inspect', 'replace']]);
  if (flags.replace && flags.to) throw new Error('Flags --replace and --to cannot be used together.');
  if (!flags._[0] && !flags.file) throw new Error('Usage: agent-kernel import <file.json> [--inspect|--to inbox|--replace]');
  const sourcePath = path.resolve(String(flags._[0] || flags.file));
  if (!exists(sourcePath)) throw new Error(`Import file not found: ${sourcePath}`);
  const bundle = validateBundle(sanitize(readJson(sourcePath, null)));
  const inspection = importInspection(bundle, sourcePath);
  if (flags.inspect) {
    if (flags.json) return printJson(inspection);
    process.stdout.write(`Import inspection: ${inspection.memoryRecords} memory record(s), ${inspection.conflicts.length} conflict(s)\n`);
    return;
  }
  if (flags.replace) {
    const replacement = replaceFromBundle(bundle);
    const result = { ok: true, mode: 'replace', backup: replacement.backup, restored: replacement.restored, inspection };
    audit('import.replace', {
      targetType: 'kernel-state', targetId: kernelHome(), summary: 'Replaced local state from validated import',
      metadata: { source: path.basename(sourcePath), backup: replacement.backup, conflicts: inspection.conflicts.length, restored: replacement.restored }
    });
    if (flags.json) return printJson(result);
    process.stdout.write(`Replaced local state from ${sourcePath}. Backup: ${replacement.backup}\n`);
    return;
  }

  const destination = String(flags.to || 'inbox');
  if (destination !== 'inbox') throw new Error('Review-first import supports --to inbox. Use --replace explicitly for replacement.');
  ensureDir(paths().pending);
  const current = currentMemoryRecords();
  const pending = pendingRecords();
  const created = [];
  const conflicts = [];
  for (const record of importedRecords(bundle)) {
    if (isImportConflict(record, current, pending)) {
      conflicts.push({ bucket: record.bucket, id: record.item?.id || null });
      continue;
    }
    const proposal = importedProposal(record, sourcePath);
    writeJsonAtomic(path.join(paths().pending, `${proposal.id}.json`), proposal);
    pending.push(proposal);
    created.push(proposal.id);
  }
  const policy = policyProposal(bundle, sourcePath);
  if (policy && !pending.some((item) => item.source?.importSourceId === policy.source.importSourceId || item.text === policy.text)) {
    writeJsonAtomic(path.join(paths().pending, `${policy.id}.json`), policy);
    created.push(policy.id);
  }
  const result = { ok: true, mode: 'inbox', created: created.length, proposalIds: created, conflicts: [...inspection.conflicts, ...conflicts] };
  audit('import.inbox', {
    targetType: 'proposal', summary: 'Imported records to pending review inbox',
    metadata: { source: path.basename(sourcePath), created: created.length, conflicts: result.conflicts.length }
  });
  if (flags.json) return printJson(result);
  process.stdout.write(`Imported ${created.length} proposal(s) to inbox; ${result.conflicts.length} conflict(s) skipped\n`);
}

function recentFailures(limit = 5) {
  const values = readJson(paths().failures, []);
  return (Array.isArray(values) ? values : []).filter((item) => item && item.status !== 'rejected')
    .sort((a, b) => String(b.updatedAt || b.lastSeenAt || '').localeCompare(String(a.updatedAt || a.lastSeenAt || '')))
    .slice(0, limit);
}

function recentSessions(limit = 5) {
  return sessionRecords().sort((a, b) => String(b.updatedAt || b.startedAt || '').localeCompare(String(a.updatedAt || a.startedAt || ''))).slice(0, limit);
}

function inboxItems(limit = 10) {
  const dir = paths().pending;
  if (!exists(dir)) return [];
  return fs.readdirSync(dir).filter((name) => name.endsWith('.json')).sort().reverse()
    .map((name) => readJson(path.join(dir, name), null)).filter(Boolean).slice(0, limit);
}

function fileHotspots() {
  const counts = new Map();
  for (const session of sessionRecords()) {
    if (!session.id) continue;
    for (const observation of readObservations(session.id).records) {
      for (const file of Array.isArray(observation.files) ? observation.files : []) counts.set(file, (counts.get(file) || 0) + 1);
    }
  }
  for (const failure of recentFailures(100)) {
    for (const file of [...(failure.files || []), ...(failure.evidence?.filesTouched || [])]) {
      counts.set(file, (counts.get(file) || 0) + Number(failure.occurrences || 1));
    }
  }
  return [...counts.entries()].map(([file, count]) => ({ file, count }))
    .sort((a, b) => b.count - a.count || a.file.localeCompare(b.file)).slice(0, 8);
}

function memoryCount() {
  return Object.values(memoryBuckets('approved')).flat().length;
}

function viewData() {
  return {
    home: kernelHome(),
    runtime: exists(paths().daemon) ? readJson(paths().daemon, { running: false }) : { running: false },
    approvedMemory: memoryCount(),
    pending: inboxItems(),
    failures: recentFailures(),
    sessions: recentSessions(),
    hotspots: fileHotspots(),
    agents: readJson(paths().agents, { agents: [] }).agents || []
  };
}

function commandView(flags) {
  const section = String(flags._[0] || 'summary');
  const allowed = new Set(['summary', 'sessions', 'failures', 'inbox', 'agents']);
  if (!allowed.has(section)) throw new Error(`Unknown view section: ${section}`);
  const data = viewData();
  if (flags.json) return printJson(data);
  if (section === 'sessions') {
    if (!data.sessions.length) return process.stdout.write('No sessions found\n');
    return data.sessions.forEach((item) => process.stdout.write(`${item.id}\t${item.status}\t${item.agentId || item.agent || '-'}\t${item.projectId || '-'}\n`));
  }
  if (section === 'failures') {
    if (!data.failures.length) return process.stdout.write('No Failure Lessons found\n');
    return data.failures.forEach((item) => process.stdout.write(`${item.id}\t${item.errorSignature || '-'}\t${item.occurrences || 1}\n`));
  }
  if (section === 'inbox') {
    if (!data.pending.length) return process.stdout.write('Inbox is empty\n');
    return data.pending.forEach((item) => process.stdout.write(`${item.id}\t${item.type}\t${String(item.text || '').replace(/\s+/g, ' ').slice(0, 70)}\n`));
  }
  if (section === 'agents') return data.agents.forEach((item) => process.stdout.write(`${item.agentId}\t${item.trustLevel}\t${item.surface}\n`));
  process.stdout.write('Agent Kernel local view\n');
  process.stdout.write(`Home: ${data.home}\nApproved memory: ${data.approvedMemory}\nPending proposals: ${data.pending.length}\n`);
  process.stdout.write(`Recent failures: ${data.failures.length}\nRecent sessions: ${data.sessions.length}\n`);
  process.stdout.write(`Runtime: ${data.runtime?.pid ? `pid ${data.runtime.pid}` : 'stopped'}\nHot files:\n`);
  if (!data.hotspots.length) process.stdout.write('  none\n');
  else data.hotspots.forEach((item) => process.stdout.write(`  ${item.count}\t${item.file}\n`));
  process.stdout.write('Next: agent-kernel inbox | agent-kernel retention status | agent-kernel report ./agent-kernel-report.html\n');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function rows(items, cells) {
  if (!items.length) return '<p class="empty">No records.</p>';
  return `<table><tbody>${items.map((item) => `<tr>${cells(item).map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function commandReport(flags) {
  if (!flags._[0] && !flags.out) throw new Error('Usage: agent-kernel report <file.html>');
  const target = path.resolve(String(flags._[0] || flags.out));
  const data = sanitize(viewData());
  const commits = sanitize(Object.values(readJson(paths().commits, { commits: {} }).commits || {})
    .sort((a, b) => String(b.timestamp || b.committedAt || '').localeCompare(String(a.timestamp || a.committedAt || ''))).slice(0, 20));
  const generatedAt = nowIso();
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Agent Kernel Local Report</title><style>
body{font-family:system-ui,-apple-system,sans-serif;margin:0;background:#f6f6f2;color:#151515}main{max-width:1040px;margin:auto;padding:32px}header{border-bottom:2px solid #151515;margin-bottom:28px}h1{margin:0 0 8px}h2{margin-top:32px}section{background:#fff;border:1px solid #d8d8d0;border-radius:10px;padding:18px;margin:16px 0}table{width:100%;border-collapse:collapse}td{padding:8px;border-bottom:1px solid #ecece6;vertical-align:top}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}.metric{background:#fff;border:1px solid #d8d8d0;padding:14px;border-radius:10px}.metric strong{display:block;font-size:28px}.muted,.empty{color:#666}code{font-family:ui-monospace,monospace;font-size:12px}footer{margin-top:32px;color:#666}
</style></head><body><main>
<header><h1>Agent Kernel Local Report</h1><p class="muted">Generated ${escapeHtml(generatedAt)} | Kernel ${escapeHtml(VERSION)} | ${escapeHtml(kernelHome())}</p></header>
<div class="grid"><div class="metric"><strong>${data.approvedMemory}</strong>Approved memory</div><div class="metric"><strong>${data.pending.length}</strong>Pending proposals</div><div class="metric"><strong>${data.failures.length}</strong>Recent failures</div><div class="metric"><strong>${data.sessions.length}</strong>Recent sessions</div></div>
<section><h2>Pending proposals</h2>${rows(data.pending, (item) => [item.id, item.type, String(item.text || '').slice(0, 180)])}</section>
<section><h2>Recent Failure Lessons</h2>${rows(data.failures, (item) => [item.id, item.errorSignature || '', item.rootCause || '', item.occurrences || 1])}</section>
<section><h2>Recent sessions</h2>${rows(data.sessions, (item) => [item.id, item.agentId || item.agent || '', item.projectId || '', item.status || ''])}</section>
<section><h2>File hotspots</h2>${rows(data.hotspots, (item) => [item.count, item.file])}</section>
<section><h2>Agent activity</h2>${rows(data.agents, (item) => [item.agentId, item.trustLevel, item.surface])}</section>
<section><h2>Commit links</h2>${rows(commits, (item) => [item.shortSha || String(item.sha || '').slice(0, 7), item.subject || '', (item.sessions || []).length])}</section>
<section><h2>Recommended cleanup</h2><p>Review pending proposals, run <code>agent-kernel retention prune --dry-run</code>, and export a redacted backup before removing local evidence.</p></section>
<footer>Static local file. No external assets, scripts, or network requests.</footer>
</main></body></html>`;
  writeTextAtomic(target, redactText(html));
  audit('report.generate', {
    targetType: 'report', targetId: target, summary: 'Generated static local HTML report',
    metadata: { generatedAt, pending: data.pending.length, failures: data.failures.length, sessions: data.sessions.length }
  });
  const result = { ok: true, path: target, generatedAt, externalAssets: false };
  if (flags.json) return printJson(result);
  process.stdout.write(`Generated static report: ${target}\n`);
}

function usage() {
  process.stdout.write(`agent-kernel-portability ${VERSION}\n\nUsage:\n  agent-kernel retention status [--json]\n  agent-kernel retention prune --dry-run [--older-than 30d]\n  agent-kernel retention prune --force [--older-than 30d]\n  agent-kernel session compact <session-id> [--dry-run] [--json]\n  agent-kernel export <file.json> [--redact] [--scope approved] [--include-observations]\n  agent-kernel import <file.json> [--inspect|--to inbox|--replace]\n  agent-kernel view [sessions|failures|inbox|agents] [--json]\n  agent-kernel report <file.html> [--json]\n`);
}

function main() {
  const argv = process.argv.slice(2);
  const family = argv.shift();
  if (!family || family === 'help' || family === '--help' || family === '-h') return usage();
  if (family === 'retention') {
    const action = argv.shift() || 'status';
    const flags = parseFlags(argv);
    if (action === 'status') return commandRetentionStatus(flags);
    if (action === 'prune') return commandRetentionPrune(flags);
    throw new Error(`Unknown retention command: ${action}`);
  }
  if (family === 'session' && argv[0] === 'compact') {
    argv.shift();
    return commandSessionCompact(parseFlags(argv));
  }
  const flags = parseFlags(argv);
  if (family === 'export') return commandExport(flags);
  if (family === 'import') return commandImport(flags);
  if (family === 'view') return commandView(flags);
  if (family === 'report') return commandReport(flags);
  throw new Error(`Unknown portability command: ${family}`);
}

try { main(); }
catch (error) {
  process.stderr.write(`${error?.message || String(error)}\n`);
  process.exitCode = 1;
}
