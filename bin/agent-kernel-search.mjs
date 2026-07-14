#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const VERSION = '1.10.1';
const INDEX_VERSION = 1;

function homeDir() {
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

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function paths() {
  const root = homeDir();
  return {
    root,
    index: path.join(root, 'index'),
    memoryIndex: path.join(root, 'index', 'memory-index.json'),
    failureIndex: path.join(root, 'index', 'failure-index.json'),
    episodeIndex: path.join(root, 'index', 'episode-index.json'),
    sessionIndex: path.join(root, 'index', 'session-index.json'),
    memories: path.join(root, 'source', 'memories'),
    failures: path.join(root, 'source', 'failures', 'failure-lessons.json'),
    episodes: path.join(root, 'episodes', 'archive'),
    sessions: path.join(root, 'runtime', 'sessions')
  };
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

function slash(value) {
  return String(value || '').replace(/\\/g, '/');
}

function stringArray(value) {
  if (Array.isArray(value)) return value.map(String).map(slash).filter(Boolean);
  return String(value || '').split(',').map((item) => slash(item.trim())).filter(Boolean);
}

function compact(value, limit = 500) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function tokens(value) {
  return String(value || '').toLowerCase().match(/[\p{L}\p{N}_./:-]+/gu) || [];
}

function normalizedRecord(type, item, source) {
  const files = stringArray(item.files || item.evidence?.filesTouched);
  const commands = stringArray(item.commands || item.command || item.evidence?.command);
  const commits = stringArray(item.commits || item.linkedCommits || item.commit || item.commitSha);
  const title = item.title || item.errorSignature || item.text || item.summary || item.id || type;
  const body = [
    item.text,
    item.summary,
    item.reason,
    item.rootCause,
    item.preventionRule,
    ...(Array.isArray(item.symptoms) ? item.symptoms : []),
    ...(Array.isArray(item.fixRecipe) ? item.fixRecipe : []),
    item.evidence?.outputExcerpt
  ].filter(Boolean).join('\n');
  return {
    id: String(item.id || `${type}:${source}`),
    type,
    source,
    status: item.status || null,
    title: compact(title, 180),
    text: compact(body, 4000),
    files,
    commands,
    commits,
    errorSignature: compact(item.errorSignature || '', 180),
    tags: stringArray(item.tags),
    project: item.project || item.projectId || '',
    agent: item.agent || item.agentId || item.source?.proposedBy || item.source?.createdBy || '',
    occurrences: Math.max(0, Number(item.occurrences || 0)),
    createdAt: item.createdAt || item.startedAt || item.timestamp || null,
    updatedAt: item.updatedAt || item.lastSeenAt || item.endedAt || item.timestamp || item.createdAt || null
  };
}

function readJsonl(filePath) {
  const raw = readText(filePath, '').trim();
  if (!raw) return [];
  const out = [];
  for (const line of raw.split(/\r?\n/)) {
    try { out.push(JSON.parse(line)); } catch { /* corrupted line stays isolated */ }
  }
  return out;
}

function memoryRecords() {
  const p = paths();
  if (!exists(p.memories)) return [];
  const records = [];
  for (const name of fs.readdirSync(p.memories).sort()) {
    if (!name.endsWith('.json') || name === 'skills.json') continue;
    const items = readJson(path.join(p.memories, name), []);
    if (!Array.isArray(items)) continue;
    for (const item of items) records.push(normalizedRecord('memory', item, `source/memories/${name}`));
  }
  return records;
}

function failureRecords() {
  const p = paths();
  const items = readJson(p.failures, []);
  return Array.isArray(items) ? items.map((item) => normalizedRecord('failure', item, 'source/failures/failure-lessons.json')) : [];
}

function episodeRecords() {
  const p = paths();
  if (!exists(p.episodes)) return [];
  const records = [];
  for (const name of fs.readdirSync(p.episodes).sort()) {
    if (!name.endsWith('.json')) continue;
    const item = readJson(path.join(p.episodes, name), null);
    if (item) records.push(normalizedRecord('episode', item, `episodes/archive/${name}`));
  }
  return records;
}

function sessionRecords() {
  const p = paths();
  if (!exists(p.sessions)) return [];
  const records = [];
  for (const name of fs.readdirSync(p.sessions).sort()) {
    if (name.endsWith('.jsonl')) {
      const observations = readJsonl(path.join(p.sessions, name));
      for (const item of observations) records.push(normalizedRecord('session', item, `runtime/sessions/${name}`));
      continue;
    }
    if (!name.endsWith('.json')) continue;
    const item = readJson(path.join(p.sessions, name), null);
    if (item) records.push(normalizedRecord('session', item, `runtime/sessions/${name}`));
  }
  return records;
}

function indexEnvelope(type, records) {
  return { version: INDEX_VERSION, type, builtAt: nowIso(), count: records.length, records };
}

function rebuild(write = true) {
  const p = paths();
  const indexes = {
    memory: indexEnvelope('memory', memoryRecords()),
    failure: indexEnvelope('failure', failureRecords()),
    episode: indexEnvelope('episode', episodeRecords()),
    session: indexEnvelope('session', sessionRecords())
  };
  if (write) {
    ensureDir(p.index);
    writeJson(p.memoryIndex, indexes.memory);
    writeJson(p.failureIndex, indexes.failure);
    writeJson(p.episodeIndex, indexes.episode);
    writeJson(p.sessionIndex, indexes.session);
  }
  return indexes;
}

function validIndex(value, type) {
  return value && value.version === INDEX_VERSION && value.type === type && Array.isArray(value.records);
}

function loadIndex(filePath, type, fallbackBuilder) {
  const value = readJson(filePath, null);
  if (validIndex(value, type)) return { records: value.records, source: 'index' };
  return { records: fallbackBuilder(), source: exists(filePath) ? 'source-fallback-corrupt-index' : 'source-fallback-missing-index' };
}

function loadAll() {
  const p = paths();
  const groups = {
    memory: loadIndex(p.memoryIndex, 'memory', memoryRecords),
    failure: loadIndex(p.failureIndex, 'failure', failureRecords),
    episode: loadIndex(p.episodeIndex, 'episode', episodeRecords),
    session: loadIndex(p.sessionIndex, 'session', sessionRecords)
  };
  return {
    records: Object.values(groups).flatMap((group) => group.records),
    sources: Object.fromEntries(Object.entries(groups).map(([key, group]) => [key, group.source]))
  };
}

function addSignal(signals, name, points, detail) {
  signals.push({ name, points, detail });
  return points;
}

function exactOrContains(values, query) {
  const wanted = String(query || '').toLowerCase();
  const normalized = values.map((value) => String(value).toLowerCase());
  if (normalized.includes(wanted)) return 'exact';
  if (normalized.some((value) => value.includes(wanted))) return 'partial';
  return null;
}

function scoreRecord(record, query, flags) {
  const terms = tokens(query).filter((term) => term.length > 1);
  const fileOnly = flags.files === true;
  const commandOnly = flags.commands === true;
  const signals = [];
  const hay = `${record.id} ${record.title} ${record.text}`.toLowerCase();
  const queryLower = String(query).toLowerCase();
  let score = 0;

  for (const term of terms) {
    let matched = false;
    if (!fileOnly && !commandOnly && hay.includes(term)) {
      score += addSignal(signals, 'text-match', 3, term);
      matched = true;
    }
    if (!commandOnly && record.files.some((value) => value.toLowerCase().includes(term))) {
      score += addSignal(signals, 'file-match', 7, term);
      matched = true;
    }
    if (!fileOnly && record.commands.some((value) => value.toLowerCase().includes(term))) {
      score += addSignal(signals, 'command-match', 6, term);
      matched = true;
    }
    if (!fileOnly && !commandOnly && record.errorSignature.toLowerCase().includes(term)) {
      score += addSignal(signals, 'error-match', 8, term);
      matched = true;
    }
    if (!fileOnly && !commandOnly && record.tags.some((value) => value.toLowerCase().includes(term))) {
      score += addSignal(signals, 'tag-match', 4, term);
      matched = true;
    }
    if (!fileOnly && !commandOnly && String(record.project).toLowerCase().includes(term)) {
      score += addSignal(signals, 'project-match', 3, term);
      matched = true;
    }
    if (!fileOnly && !commandOnly && String(record.agent).toLowerCase().includes(term)) {
      score += addSignal(signals, 'agent-match', 2, term);
      matched = true;
    }
    if (!fileOnly && !commandOnly && record.commits.some((value) => value.toLowerCase().includes(term))) {
      score += addSignal(signals, 'commit-match', 5, term);
      matched = true;
    }
    if (!matched) return { score: 0, signals: [] };
  }

  const fileMatch = exactOrContains(record.files, queryLower);
  if (!commandOnly && fileMatch === 'exact') score += addSignal(signals, 'exact-file', 18, query);
  const commandMatch = exactOrContains(record.commands, queryLower);
  if (!fileOnly && commandMatch === 'exact') score += addSignal(signals, 'exact-command', 16, query);
  if (!fileOnly && !commandOnly && record.errorSignature.toLowerCase() === queryLower) score += addSignal(signals, 'exact-error', 20, query);
  if (!fileOnly && !commandOnly && record.tags.some((value) => value.toLowerCase() === queryLower)) score += addSignal(signals, 'exact-tag', 10, query);
  if (!fileOnly && !commandOnly && String(record.project).toLowerCase() === queryLower) score += addSignal(signals, 'exact-project', 8, query);
  if (!fileOnly && !commandOnly && String(record.agent).toLowerCase() === queryLower) score += addSignal(signals, 'exact-agent', 5, query);
  if (!fileOnly && !commandOnly && record.commits.some((value) => value.toLowerCase() === queryLower)) score += addSignal(signals, 'exact-commit', 12, query);

  if (record.type === 'memory' && record.status === 'approved') score += addSignal(signals, 'approved-memory', 6, 'approved');
  if (record.type === 'failure' && record.occurrences > 1) {
    const recurrence = Math.min(record.occurrences, 10);
    score += addSignal(signals, 'failure-recurrence', recurrence, String(record.occurrences));
  }
  if (record.type === 'session' && record.updatedAt) {
    const ageDays = Math.max(0, (Date.now() - Date.parse(record.updatedAt)) / 86400000);
    if (Number.isFinite(ageDays) && ageDays <= 30) score += addSignal(signals, 'recent-session', ageDays <= 7 ? 4 : 2, `${Math.round(ageDays)}d`);
  }
  if (!terms.length) score = addSignal(signals, 'default', 1, 'empty-token-query');
  return { score, signals };
}

function resultSections(results) {
  return {
    approvedMemory: results.filter((item) => item.type === 'memory' && item.status === 'approved'),
    failureLessons: results.filter((item) => item.type === 'failure'),
    episodes: results.filter((item) => item.type === 'episode'),
    rawObservations: results.filter((item) => item.type === 'session' || (item.type === 'memory' && item.status !== 'approved'))
  };
}

function renderResults(results, explain) {
  const lines = [];
  for (const item of results) {
    lines.push(`[${item.type}] ${item.title}`);
    lines.push(`id=${item.id} score=${item.score} updated=${item.updatedAt || ''}`);
    if (item.files.length) lines.push(`files=${item.files.join(', ')}`);
    if (item.commands.length) lines.push(`commands=${item.commands.join(' | ')}`);
    if (explain) lines.push(`why=${item.signals.map((signal) => `${signal.name}+${signal.points}(${signal.detail})`).join(', ')}`);
    if (item.text) lines.push(compact(item.text, 320));
    lines.push('');
  }
  return lines.join('\n').trim();
}

function applyBudget(results, budget, explain) {
  if (!Number.isFinite(budget)) return results;
  const accepted = [];
  for (const result of results) {
    const candidate = [...accepted, result];
    if (renderResults(candidate, explain).length > budget) break;
    accepted.push(result);
  }
  return accepted;
}

function search(flags) {
  const query = String(flags.query || flags.q || flags._.join(' ')).trim();
  if (!query) throw new Error('Usage: agent-kernel search <query> [--type memory|failure|episode|session] [--files|--commands]');
  const loaded = loadAll();
  let records = loaded.records;
  if (flags.type) records = records.filter((record) => record.type === String(flags.type));
  const limit = Math.max(1, Math.min(Number(flags.limit || 20), 100));
  const explain = flags.debug === true || flags.explain === true;
  const budget = flags.budget === undefined ? Infinity : Math.max(100, Math.min(Number(flags.budget || 1200), 12000));
  let results = records
    .map((record) => ({ ...record, ...scoreRecord(record, query, flags) }))
    .filter((record) => record.score > 0)
    .sort((a, b) => b.score - a.score || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')) || a.id.localeCompare(b.id))
    .slice(0, limit);
  results = applyBudget(results, budget, explain);
  const rendered = renderResults(results, explain);
  return {
    version: VERSION,
    query,
    filters: { type: flags.type || null, files: flags.files === true, commands: flags.commands === true },
    budget: Number.isFinite(budget) ? budget : null,
    budgetUsed: rendered.length,
    explain,
    indexSources: loaded.sources,
    count: results.length,
    sections: resultSections(results),
    results,
    rendered
  };
}

function printResults(result) {
  process.stdout.write((result.rendered || 'No matching local records.') + '\n');
}

function usage() {
  process.stdout.write(`agent-kernel-search ${VERSION}\n\nUsage:\n  agent-kernel reindex\n  agent-kernel search "ERR_MODULE_NOT_FOUND"\n  agent-kernel search "safe-link duplicate block" --type failure\n  agent-kernel search "src/cli.mjs" --files\n  agent-kernel search "npm test" --commands\n  agent-kernel search "src/cli.mjs" --explain --budget 1200\n`);
}

function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === 'help' || command === '--help' || command === '-h') return usage();
  if (command === 'reindex') {
    const indexes = rebuild(true);
    const counts = Object.fromEntries(Object.entries(indexes).map(([key, value]) => [key, value.count]));
    process.stdout.write(JSON.stringify({ ok: true, indexDir: paths().index, counts }, null, 2) + '\n');
    return;
  }
  if (command === 'search') {
    const flags = parseFlags(rest);
    const result = search(flags);
    if (flags.json) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    else printResults(result);
    return;
  }
  process.stderr.write(`Unknown search command: ${command}\n`);
  usage();
  process.exitCode = 1;
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error?.message || String(error)}\n`);
  process.exitCode = 1;
}
