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
const SENSITIVE_KEY = /(token|password|secret|credential|authorization|cookie|api.?key|private.?key)/i;

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
  const temporary = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporary, text, 'utf8');
  fs.renameSync(temporary, filePath);
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
    if (arg.startsWith('--')) {
      const raw = arg.slice(2);
      const eq = raw.indexOf('=');
      if (eq >= 0) flags[raw.slice(0, eq)] = raw.slice(eq + 1);
      else if (argv[i + 1] && !argv[i + 1].startsWith('-')) flags[raw] = argv[++i];
      else flags[raw] = true;
    } else flags._.push(arg);
  }
  return flags;
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
    approvedInbox: path.join(home, 'inbox', 'approved'),
    rejectedInbox: path.join(home, 'inbox', 'rejected'),
    audit: path.join(home, 'logs', 'audit.jsonl'),
    importBackups: path.join(home, 'imports', 'backups')
  };
}

function redactText(value) {
  let text = String(value || '');
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

function retentionConfig() {
  const config = readJson(paths().config, {});
  return {
    runtimeRetentionDays: Math.max(1, Number(config.runtimeRetentionDays || DEFAULT_RETENTION_DAYS)),
    keepFailureEvidence: config.keepFailureEvidence !== false,
    keepApprovedMemoryForever: config.keepApprovedMemoryForever !== false,
    autoPruneRawObservations: config.autoPruneRawObservations === true
  };
}

function parseDurationDays(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const text = String(value).trim().toLowerCase();
  const match = text.match(/^(\d+)(d|day|days)?$/);
  if (!match) throw new Error(`Invalid duration: ${value}. Use a value such as 30d.`);
  return Math.max(1, Number(match[1]));
}

function sessionRecords() {
  const p = paths();
  if (!exists(p.sessions)) return [];
  return fs.readdirSync(p.sessions).sort()
    .filter((name) => name.endsWith('.json') && !name.endsWith('.jsonl'))
    .map((name) => readJson(path.join(p.sessions, name), null))
    .filter(Boolean);
}

function observationFiles() {
  const p = paths();
  if (!exists(p.sessions)) return [];
  return fs.readdirSync(p.sessions).sort()
    .filter((name) => name.endsWith('.jsonl'))
    .map((name) => path.join(p.sessions, name));
}

function sessionForLog(filePath) {
  return readJson(filePath.replace(/\.jsonl$/, '.json'), null);
}

function fileTimestamp(filePath, session) {
  const candidates = [session?.updatedAt, session?.endedAt, session?.startedAt].map((value) => Date.parse(value || '')).filter(Number.isFinite);
  if (candidates.length) return Math.max(...candidates);
  try { return fs.statSync(filePath).mtimeMs; } catch { return Date.now(); }
}

function retentionPlan(flags = {}) {
  const config = retentionConfig();
  const days = parseDurationDays(flags['older-than'] || flags.olderThan, config.runtimeRetentionDays);
  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const logs = observationFiles().map((filePath) => {
    const session = sessionForLog(filePath);
    const timestampMs = fileTimestamp(filePath, session);
    let observationCount = 0;
    const raw = readText(filePath, '').trim();
    if (raw) observationCount = raw.split(/\r?\n/).filter(Boolean).length;
    return {
      sessionId: path.basename(filePath, '.jsonl'),
      filePath,
      updatedAt: new Date(timestampMs).toISOString(),
      bytes: (() => { try { return fs.statSync(filePath).size; } catch { return 0; } })(),
      observationCount,
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
  process.stdout.write(`Approved memory protected: ${plan.config.keepApprovedMemoryForever ? 'yes' : 'no'}\n`);
  process.stdout.write(`Failure evidence protected: ${plan.config.keepFailureEvidence ? 'yes' : 'no'}\n`);
}

function commandRetentionPrune(flags) {
  const plan = retentionPlan(flags);
  const eligible = plan.logs.filter((item) => item.eligible);
  const dryRun = flags['dry-run'] || flags.dryRun;
  if (!dryRun && !flags.force) {
    throw new Error('Retention prune requires --force. Run with --dry-run first.');
  }
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
    protected: {
      approvedMemory: true,
      policies: true,
      failureLessons: plan.config.keepFailureEvidence
    }
  };
  audit(dryRun ? 'retention.prune.dry-run' : 'retention.prune', {
    targetType: 'session-observations',
    summary: dryRun ? 'Previewed raw observation prune' : 'Pruned raw session observations',
    metadata: result
  });
  if (flags.json) printJson(result);
  else {
    process.stdout.write(`${dryRun ? 'Would prune' : 'Pruned'} ${eligible.length} raw session log(s), ${result.bytes} byte(s)\n`);
    if (eligible.length) process.stdout.write(`Sessions: ${result.sessions.join(', ')}\n`);
  }
}

function readObservations(sessionId) {
  const raw = readText(path.join(paths().sessions, `${sessionId}.jsonl`), '').trim();
  if (!raw) return [];
  return raw.split(/\r?\n/).map((line) => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
}

function compactList(values, limit = 12) {
  return [...new Set(values.filter(Boolean))].slice(0, limit);
}

function deterministicSummary(session, observations) {
  const files = compactList(observations.flatMap((item) => Array.isArray(item.files) ? item.files : []));
  const commands = compactList(observations.map((item) => item.command));
  const failures = observations.filter((item) => /failure|error|blocked/i.test(String(item.type || '')) || Number(item.exitCode) > 0);
  const task = observations.find((item) => item.type === 'user_prompt')?.text || observations[0]?.text || session.summary || 'No task text captured.';
  const latest = observations.at(-1)?.text || '';
  return {
    sourceSessionId: session.id,
    generatedAt: nowIso(),
    method: 'deterministic-local',
    mainTask: String(task).replace(/\s+/g, ' ').trim().slice(0, 500),
    outcome: String(latest).replace(/\s+/g, ' ').trim().slice(0, 500),
    files,
    commands,
    failureCount: failures.length,
    failureTypes: compactList(failures.map((item) => item.type)),
    observationCount: observations.length,
    linkedFailures: session.linkedFailures || [],
    linkedEpisodes: session.linkedEpisodes || [],
    linkedCommits: session.linkedCommits || []
  };
}

function commandSessionCompact(flags) {
  const sessionId = String(flags._[0] || flags.session || '').trim();
  if (!sessionId) throw new Error('Usage: agent-kernel session compact <session-id> [--dry-run]');
  const sessionPath = path.join(paths().sessions, `${sessionId}.json`);
  const session = readJson(sessionPath, null);
  if (!session) throw new Error(`Session not found: ${sessionId}`);
  const observations = readObservations(sessionId);
  const compacted = deterministicSummary(session, observations);
  const dryRun = flags['dry-run'] || flags.dryRun;
  if (!dryRun) {
    writeJsonAtomic(sessionPath, {
      ...session,
      summary: compacted.mainTask,
      compactSummary: compacted,
      compactedAt: compacted.generatedAt,
      compactedObservationCount: observations.length
    });
    audit('session.compact', {
      targetType: 'session',
      targetId: sessionId,
      agentId: session.agentId || null,
      summary: 'Compacted session locally without approving memory',
      metadata: { observationCount: observations.length, rawLogRetained: exists(path.join(paths().sessions, `${sessionId}.jsonl`)) }
    });
  }
  const result = { dryRun: !!dryRun, rawLogRetained: exists(path.join(paths().sessions, `${sessionId}.jsonl`)), summary: compacted };
  if (flags.json) printJson(result);
  else process.stdout.write(`${dryRun ? 'Compaction preview' : 'Compacted session'} ${sessionId}: ${observations.length} observation(s), raw log retained\n`);
}

function memoryBuckets(scope = 'all') {
  const p = paths();
  const result = {};
  if (!exists(p.memories)) return result;
  for (const name of fs.readdirSync(p.memories).sort()) {
    if (!name.endsWith('.json')) continue;
    const records = readJson(path.join(p.memories, name), []);
    if (!Array.isArray(records)) continue;
    result[name.replace(/\.json$/, '')] = scope === 'approved'
      ? records.filter((item) => item?.status === 'approved')
      : records;
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
    result[id] = readObservations(id);
  }
  return result;
}

function exportBundle(flags) {
  const scope = String(flags.scope || 'all');
  if (!['all', 'approved'].includes(scope)) throw new Error(`Unsupported export scope: ${scope}`);
  const includeSessions = scope !== 'approved' && flags['no-sessions'] !== true;
  const includeObservations = scope !== 'approved' && flags['include-observations'] === true;
  const p = paths();
  const data = {
    memories: memoryBuckets(scope),
    policies: readJson(p.policies, {}),
    failures: scope === 'approved' ? [] : readJson(p.failures, []),
    episodes: scope === 'approved' ? [] : episodes(),
    agents: readJson(p.agents, { version: 1, agents: [] }),
    projects: readJson(p.projects, { version: 1, projects: [] }),
    sessions: includeSessions ? sessionRecords() : [],
    observations: includeObservations ? observationsBySession() : {},
    commitLinks: scope === 'approved' ? {} : readJson(p.commits, { version: 1, commits: {} })
  };
  return sanitize({
    schemaVersion: EXPORT_SCHEMA_VERSION,
    format: 'agent-kernel-export',
    kernelVersion: VERSION,
    exportedAt: nowIso(),
    scope,
    redactionMode: flags.redact ? 'explicit' : 'default',
    exclusions: ['secrets', 'credentials', 'runtime daemon PID files', 'temporary cache files'],
    data
  });
}

function commandExport(flags) {
  const target = path.resolve(String(flags._[0] || flags.out || ''));
  if (!flags._[0] && !flags.out) throw new Error('Usage: agent-kernel export <file.json> [--redact] [--scope approved]');
  const bundle = exportBundle(flags);
  writeJsonAtomic(target, bundle);
  audit('export.create', {
    targetType: 'export',
    targetId: target,
    summary: 'Created redacted local export',
    metadata: { scope: bundle.scope, schemaVersion: bundle.schemaVersion, observationsIncluded: Object.keys(bundle.data.observations).length > 0 }
  });
  const result = { ok: true, path: target, schemaVersion: bundle.schemaVersion, scope: bundle.scope, redactionMode: bundle.redactionMode };
  if (flags.json) printJson(result);
  else process.stdout.write(`Exported Agent Kernel data to ${target}\n`);
}

function validateBundle(bundle) {
  if (!bundle || typeof bundle !== 'object') throw new Error('Import file must contain a JSON object.');
  if (bundle.format !== 'agent-kernel-export') throw new Error('Import file has an unsupported format.');
  if (bundle.schemaVersion !== EXPORT_SCHEMA_VERSION) throw new Error(`Unsupported export schema version: ${bundle.schemaVersion}`);
  if (!bundle.data || typeof bundle.data !== 'object') throw new Error('Import file is missing data.');
  if (!bundle.data.memories || typeof bundle.data.memories !== 'object') throw new Error('Import file is missing memory buckets.');
  return bundle;
}

function importedRecords(bundle) {
  const records = [];
  for (const [bucket, values] of Object.entries(bundle.data.memories || {})) {
    for (const item of Array.isArray(values) ? values : []) records.push({ bucket, item });
  }
  return records;
}

function currentMemoryRecords() {
  return Object.values(memoryBuckets('all')).flat();
}

function pendingRecords() {
  const p = paths();
  if (!exists(p.pending)) return [];
  return fs.readdirSync(p.pending).filter((name) => name.endsWith('.json')).map((name) => readJson(path.join(p.pending, name), null)).filter(Boolean);
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
    source: {
      channel: 'import',
      importedFrom: path.basename(sourcePath),
      importSourceId: sourceId,
      importBucket: record.bucket
    },
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
    type: 'policy',
    scope: 'global',
    level: 'critical',
    text,
    targets: ['all'],
    tags: ['imported', 'policy-pack'],
    status: 'pending',
    reason: 'Imported policy packs require explicit review before replacing local policy configuration.',
    source: { channel: 'import', importedFrom: path.basename(sourcePath), importSourceId: 'policy-pack', importBucket: 'policies' },
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1
  };
}

function importInspection(bundle, sourcePath) {
  const incoming = importedRecords(bundle);
  const current = currentMemoryRecords();
  const pending = pendingRecords();
  const conflicts = incoming.filter(({ item }) => current.some((existing) => existing.id === item.id || (item.text && existing.text === item.text)) || pending.some((proposal) => proposal.source?.importSourceId === item.id));
  return {
    path: sourcePath,
    schemaVersion: bundle.schemaVersion,
    sourceKernelVersion: bundle.kernelVersion || null,
    scope: bundle.scope || 'all',
    memoryRecords: incoming.length,
    policyPack: Object.keys(bundle.data.policies || {}).length > 0,
    failureLessons: Array.isArray(bundle.data.failures) ? bundle.data.failures.length : 0,
    episodes: Array.isArray(bundle.data.episodes) ? bundle.data.episodes.length : 0,
    sessions: Array.isArray(bundle.data.sessions) ? bundle.data.sessions.length : 0,
    conflicts: conflicts.map(({ bucket, item }) => ({ bucket, id: item.id || null, text: String(item.text || '').slice(0, 160) }))
  };
}

function backupCurrentState() {
  const p = paths();
  const target = path.join(p.importBackups, new Date().toISOString().replace(/[:.]/g, '-'));
  ensureDir(target);
  for (const [name, source] of [['memories', p.memories], ['policies.json', p.policies], ['failures.json', p.failures], ['agents.json', p.agents], ['projects.json', p.projects]]) {
    if (!exists(source)) continue;
    const destination = path.join(target, name);
    if (fs.statSync(source).isDirectory()) fs.cpSync(source, destination, { recursive: true });
    else { ensureDir(path.dirname(destination)); fs.copyFileSync(source, destination); }
  }
  return target;
}

function replaceFromBundle(bundle) {
  const p = paths();
  const backup = backupCurrentState();
  ensureDir(p.memories);
  for (const [bucket, records] of Object.entries(bundle.data.memories || {})) {
    writeJsonAtomic(path.join(p.memories, `${bucket}.json`), sanitize(Array.isArray(records) ? records : []));
  }
  writeJsonAtomic(p.policies, sanitize(bundle.data.policies || {}));
  writeJsonAtomic(p.failures, sanitize(Array.isArray(bundle.data.failures) ? bundle.data.failures : []));
  if (bundle.data.agents) writeJsonAtomic(p.agents, sanitize(bundle.data.agents));
  if (bundle.data.projects) writeJsonAtomic(p.projects, sanitize(bundle.data.projects));
  if (Array.isArray(bundle.data.episodes)) {
    ensureDir(p.episodesArchive);
    for (const episode of bundle.data.episodes) {
      if (!episode?.id) continue;
      writeJsonAtomic(path.join(p.episodesArchive, `${episode.id}.json`), sanitize(episode));
    }
  }
  return backup;
}

function commandImport(flags) {
  const sourcePath = path.resolve(String(flags._[0] || flags.file || ''));
  if (!flags._[0] && !flags.file) throw new Error('Usage: agent-kernel import <file.json> [--inspect|--to inbox|--replace]');
  const bundle = validateBundle(sanitize(readJson(sourcePath, null)));
  const inspection = importInspection(bundle, sourcePath);
  if (flags.inspect) {
    if (flags.json) printJson(inspection);
    else process.stdout.write(`Import inspection: ${inspection.memoryRecords} memory record(s), ${inspection.conflicts.length} conflict(s)\n`);
    return;
  }
  if (flags.replace) {
    const backup = replaceFromBundle(bundle);
    const result = { ok: true, mode: 'replace', backup, inspection };
    audit('import.replace', {
      targetType: 'kernel-state',
      targetId: kernelHome(),
      summary: 'Replaced local state from validated import',
      metadata: { source: path.basename(sourcePath), backup, conflicts: inspection.conflicts.length }
    });
    if (flags.json) printJson(result);
    else process.stdout.write(`Replaced local state from ${sourcePath}. Backup: ${backup}\n`);
    return;
  }
  const destination = String(flags.to || 'inbox');
  if (destination !== 'inbox') throw new Error('Review-first import supports --to inbox. Use --replace explicitly for replacement.');
  ensureDir(paths().pending);
  const current = currentMemoryRecords();
  const existingPending = pendingRecords();
  const created = [];
  const conflicts = [];
  for (const record of importedRecords(bundle)) {
    const sourceId = record.item?.id;
    const conflict = current.some((item) => item.id === sourceId || (record.item?.text && item.text === record.item.text)) || existingPending.some((item) => item.source?.importSourceId === sourceId);
    if (conflict) {
      conflicts.push({ bucket: record.bucket, id: sourceId || null });
      continue;
    }
    const proposal = importedProposal(record, sourcePath);
    writeJsonAtomic(path.join(paths().pending, `${proposal.id}.json`), proposal);
    created.push(proposal.id);
  }
  const policy = policyProposal(bundle, sourcePath);
  if (policy && !existingPending.some((item) => item.source?.importSourceId === 'policy-pack')) {
    writeJsonAtomic(path.join(paths().pending, `${policy.id}.json`), policy);
    created.push(policy.id);
  }
  const result = { ok: true, mode: 'inbox', created: created.length, proposalIds: created, conflicts: [...inspection.conflicts, ...conflicts] };
  audit('import.inbox', {
    targetType: 'proposal',
    summary: 'Imported records to pending review inbox',
    metadata: { source: path.basename(sourcePath), created: created.length, conflicts: result.conflicts.length }
  });
  if (flags.json) printJson(result);
  else process.stdout.write(`Imported ${created.length} proposal(s) to inbox; ${result.conflicts.length} conflict(s) skipped\n`);
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
  const p = paths();
  if (!exists(p.pending)) return [];
  return fs.readdirSync(p.pending).filter((name) => name.endsWith('.json')).sort().reverse().map((name) => readJson(path.join(p.pending, name), null)).filter(Boolean).slice(0, limit);
}

function fileHotspots() {
  const counts = new Map();
  for (const session of sessionRecords()) {
    const id = session.id;
    if (!id) continue;
    for (const observation of readObservations(id)) {
      for (const file of Array.isArray(observation.files) ? observation.files : []) counts.set(file, (counts.get(file) || 0) + 1);
    }
  }
  for (const failure of recentFailures(100)) {
    const files = [...(failure.files || []), ...(failure.evidence?.filesTouched || [])];
    for (const file of files) counts.set(file, (counts.get(file) || 0) + Number(failure.occurrences || 1));
  }
  return [...counts.entries()].map(([file, count]) => ({ file, count })).sort((a, b) => b.count - a.count || a.file.localeCompare(b.file)).slice(0, 8);
}

function memoryCount() {
  return Object.values(memoryBuckets('approved')).flat().length;
}

function commandView(flags) {
  const section = String(flags._[0] || 'summary');
  const data = {
    home: kernelHome(),
    runtime: exists(paths().daemon) ? readJson(paths().daemon, { running: false }) : { running: false },
    approvedMemory: memoryCount(),
    pending: inboxItems(),
    failures: recentFailures(),
    sessions: recentSessions(),
    hotspots: fileHotspots(),
    agents: readJson(paths().agents, { agents: [] }).agents || []
  };
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
  if (section === 'agents') {
    return data.agents.forEach((item) => process.stdout.write(`${item.agentId}\t${item.trustLevel}\t${item.surface}\n`));
  }
  process.stdout.write(`Agent Kernel local view\n`);
  process.stdout.write(`Home: ${data.home}\n`);
  process.stdout.write(`Approved memory: ${data.approvedMemory}\n`);
  process.stdout.write(`Pending proposals: ${data.pending.length}\n`);
  process.stdout.write(`Recent failures: ${data.failures.length}\n`);
  process.stdout.write(`Recent sessions: ${data.sessions.length}\n`);
  process.stdout.write(`Runtime: ${data.runtime?.pid ? `pid ${data.runtime.pid}` : 'stopped'}\n`);
  process.stdout.write('Hot files:\n');
  if (!data.hotspots.length) process.stdout.write('  none\n');
  else data.hotspots.forEach((item) => process.stdout.write(`  ${item.count}\t${item.file}\n`));
  process.stdout.write('Next: agent-kernel inbox | agent-kernel retention status | agent-kernel report ./agent-kernel-report.html\n');
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function rows(items, cells) {
  if (!items.length) return '<p class="empty">No records.</p>';
  return `<table><tbody>${items.map((item) => `<tr>${cells(item).map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function commandReport(flags) {
  const target = path.resolve(String(flags._[0] || flags.out || ''));
  if (!flags._[0] && !flags.out) throw new Error('Usage: agent-kernel report <file.html>');
  const pending = sanitize(inboxItems(20));
  const failures = sanitize(recentFailures(20));
  const sessions = sanitize(recentSessions(20));
  const hotspots = sanitize(fileHotspots());
  const agents = sanitize(readJson(paths().agents, { agents: [] }).agents || []);
  const commits = sanitize(Object.values(readJson(paths().commits, { commits: {} }).commits || {}).slice(0, 20));
  const generatedAt = nowIso();
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Agent Kernel Local Report</title><style>
body{font-family:system-ui,-apple-system,sans-serif;margin:0;background:#f6f6f2;color:#151515}main{max-width:1040px;margin:auto;padding:32px}header{border-bottom:2px solid #151515;margin-bottom:28px}h1{margin:0 0 8px}h2{margin-top:32px}section{background:#fff;border:1px solid #d8d8d0;border-radius:10px;padding:18px;margin:16px 0}table{width:100%;border-collapse:collapse}td{padding:8px;border-bottom:1px solid #ecece6;vertical-align:top}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}.metric{background:#fff;border:1px solid #d8d8d0;padding:14px;border-radius:10px}.metric strong{display:block;font-size:28px}.muted,.empty{color:#666}code{font-family:ui-monospace,monospace;font-size:12px}footer{margin-top:32px;color:#666}
</style></head><body><main>
<header><h1>Agent Kernel Local Report</h1><p class="muted">Generated ${escapeHtml(generatedAt)} | Kernel ${escapeHtml(VERSION)} | ${escapeHtml(kernelHome())}</p></header>
<div class="grid"><div class="metric"><strong>${memoryCount()}</strong>Approved memory</div><div class="metric"><strong>${pending.length}</strong>Pending proposals</div><div class="metric"><strong>${failures.length}</strong>Recent failures</div><div class="metric"><strong>${sessions.length}</strong>Recent sessions</div></div>
<section><h2>Pending proposals</h2>${rows(pending, (item) => [item.id, item.type, String(item.text || '').slice(0, 180)])}</section>
<section><h2>Recent Failure Lessons</h2>${rows(failures, (item) => [item.id, item.errorSignature || '', item.rootCause || '', item.occurrences || 1])}</section>
<section><h2>Recent sessions</h2>${rows(sessions, (item) => [item.id, item.agentId || item.agent || '', item.projectId || '', item.status || ''])}</section>
<section><h2>File hotspots</h2>${rows(hotspots, (item) => [item.count, item.file])}</section>
<section><h2>Agent activity</h2>${rows(agents, (item) => [item.agentId, item.trustLevel, item.surface])}</section>
<section><h2>Commit links</h2>${rows(commits, (item) => [item.shortSha || String(item.sha || '').slice(0, 7), item.subject || '', (item.sessions || []).length])}</section>
<section><h2>Recommended cleanup</h2><p>Review pending proposals, run <code>agent-kernel retention prune --dry-run</code>, and export a redacted backup before removing local evidence.</p></section>
<footer>Static local file. No external assets, scripts, or network requests.</footer>
</main></body></html>`;
  writeTextAtomic(target, redactText(html));
  audit('report.generate', {
    targetType: 'report',
    targetId: target,
    summary: 'Generated static local HTML report',
    metadata: { generatedAt, pending: pending.length, failures: failures.length, sessions: sessions.length }
  });
  const result = { ok: true, path: target, generatedAt, externalAssets: false };
  if (flags.json) printJson(result);
  else process.stdout.write(`Generated static report: ${target}\n`);
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
