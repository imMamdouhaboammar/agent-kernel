#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const VERSION = '1.0.0';
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
    tags: stringArray(item.tags),
    project: item.project || item.projectId || '',
    agent: item.agent || item.agentId || item.source?.proposedBy || item.source?.createdBy || '',
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

function scoreRecord(record, query, flags) {
  const terms = tokens(query).filter((term) => term.length > 1);
  const fileOnly = flags.files === true;
  const commandOnly = flags.commands === true;
  const hay = `${record.id} ${record.title} ${record.text} ${record.tags.join(' ')} ${record.project} ${record.agent}`.toLowerCase();
  const fileHay = record.files.join(' ').toLowerCase();
  const commandHay = record.commands.join(' ').toLowerCase();
  let score = 0;
  for (const term of terms) {
    let matched = false;
    if (!fileOnly && !commandOnly && hay.includes(term)) { score += 3; matched = true; }
    if (!commandOnly && fileHay.includes(term)) { score += 7; matched = true; }
    if (!fileOnly && commandHay.includes(term)) { score += 6; matched = true; }
    if (!matched) return 0;
  }
  if (!terms.length) score = 1;
  if (record.status === 'approved') score += 1;
  return score;
}

function search(flags) {
  const query = String(flags.query || flags.q || flags._.join(' ')).trim();
  if (!query) throw new Error('Usage: agent-kernel search <query> [--type memory|failure|episode|session] [--files|--commands]');
  const loaded = loadAll();
  let records = loaded.records;
  if (flags.type) records = records.filter((record) => record.type === String(flags.type));
  const limit = Math.max(1, Math.min(Number(flags.limit || 20), 100));
  const results = records
    .map((record) => ({ ...record, score: scoreRecord(record, query, flags) }))
    .filter((record) => record.score > 0)
    .sort((a, b) => b.score - a.score || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
    .slice(0, limit);
  return { version: VERSION, query, filters: { type: flags.type || null, files: flags.files === true, commands: flags.commands === true }, indexSources: loaded.sources, count: results.length, results };
}

function printResults(result) {
  if (!result.results.length) {
    process.stdout.write('No matching local records.\n');
    return;
  }
  for (const item of result.results) {
    process.stdout.write(`[${item.type}] ${item.title}\n`);
    process.stdout.write(`id=${item.id} score=${item.score} updated=${item.updatedAt || ''}\n`);
    if (item.files.length) process.stdout.write(`files=${item.files.join(', ')}\n`);
    if (item.commands.length) process.stdout.write(`commands=${item.commands.join(' | ')}\n`);
    if (item.text) process.stdout.write(`${compact(item.text, 320)}\n`);
    process.stdout.write('\n');
  }
}

function usage() {
  process.stdout.write(`agent-kernel-search ${VERSION}\n\nUsage:\n  agent-kernel reindex\n  agent-kernel search "ERR_MODULE_NOT_FOUND"\n  agent-kernel search "safe-link duplicate block" --type failure\n  agent-kernel search "src/cli.mjs" --files\n  agent-kernel search "npm test" --commands\n`);
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
