#!/usr/bin/env node
import childProcess from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const distCliPath = path.resolve(here, '..', 'dist', 'cli.mjs');
const failurePath = path.resolve(here, 'agent-kernel-failure.mjs');
const sessionPath = path.resolve(here, 'agent-kernel-session.mjs');
const fileContextPath = path.resolve(here, 'agent-kernel-file-context.mjs');
const VERSION = '1.8.0';

function kernelHome() {
  return process.env.AGENT_KERNEL_HOME || path.join(os.homedir(), '.agent-kernel');
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

function writeText(filePath, text) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, text, 'utf8');
}

function readJson(filePath, fallback) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return fallback; }
}

function writeJson(filePath, value) {
  writeText(filePath, JSON.stringify(value, null, 2) + '\n');
}

function projectRoot(cwd = process.cwd()) {
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
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

function realpathOrSelf(value) {
  if (!value) return value;
  try { return fs.realpathSync.native(value); } catch { /* fall through */ }
  const parent = path.dirname(value);
  const base = path.basename(value);
  try { return path.join(fs.realpathSync.native(parent), base); } catch { return value; }
}

function normalizeFile(value, root = projectRoot(), base = process.cwd()) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const resolved = path.isAbsolute(raw) ? path.normalize(raw) : path.resolve(base, raw);
  const realRoot = realpathOrSelf(root);
  const realResolved = realpathOrSelf(resolved);
  if (inside(realRoot, realResolved)) {
    const relative = slash(path.relative(realRoot, realResolved));
    return relative || '.';
  }
  return slash(resolved);
}

function collectFileFlagValues(args) {
  const values = [];
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--file' || arg === '--files') {
      if (args[index + 1] && !args[index + 1].startsWith('-')) values.push(args[++index]);
      continue;
    }
    if (arg.startsWith('--file=')) values.push(arg.slice('--file='.length));
    if (arg.startsWith('--files=')) values.push(arg.slice('--files='.length));
  }
  return values.flatMap((value) => String(value).split(',')).map((value) => value.trim()).filter(Boolean);
}

function stripFileFlags(args) {
  const output = [];
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--file' || arg === '--files') {
      if (args[index + 1] && !args[index + 1].startsWith('-')) index++;
      continue;
    }
    if (arg.startsWith('--file=') || arg.startsWith('--files=')) continue;
    output.push(arg);
  }
  return output;
}

function normalizedFiles(args, cwd = process.cwd()) {
  const root = projectRoot(cwd);
  return [...new Set(collectFileFlagValues(args).map((value) => normalizeFile(value, root, cwd)).filter(Boolean))];
}

function withNormalizedFileFlags(args, files) {
  const output = stripFileFlags(args);
  if (files.length) output.push('--files', files.join(','));
  return output;
}

function run(scriptPath, args, options = {}) {
  const result = childProcess.spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: options.cwd || process.cwd(),
    env: process.env,
    encoding: 'utf8',
    input: options.input,
    stdio: options.input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe']
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const message = (result.stderr || result.stdout || `command failed with status ${result.status}`).trim();
    const error = new Error(message);
    error.status = result.status;
    error.stdout = result.stdout || '';
    error.stderr = result.stderr || '';
    throw error;
  }
  return { stdout: result.stdout || '', stderr: result.stderr || '' };
}

function printCaptured(result) {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

function parseBooleanFlag(args, flag) {
  return args.includes(flag) || args.some((arg) => arg === `${flag}=true`);
}

function parseValueFlag(args, name, fallback = '') {
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === name && args[index + 1] && !args[index + 1].startsWith('-')) return args[index + 1];
    if (arg.startsWith(name + '=')) return arg.slice(name.length + 1);
  }
  return fallback;
}

function positionalArgs(args) {
  const values = [];
  const flagsWithValues = new Set([
    '--file', '--files', '--query', '--type', '--level', '--status', '--limit', '--budget',
    '--from', '--agent', '--text', '--reason', '--scope', '--targets', '--tags', '--title',
    '--summary', '--project', '--command', '--exit-code', '--root-cause', '--fix', '--as', '--to'
  ]);
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg.startsWith('--')) {
      if (!arg.includes('=') && flagsWithValues.has(arg) && args[index + 1] && !args[index + 1].startsWith('-')) index++;
      continue;
    }
    values.push(arg);
  }
  return values;
}

function recordPaths() {
  const root = kernelHome();
  return {
    root,
    memories: path.join(root, 'source', 'memories'),
    pending: path.join(root, 'inbox', 'pending'),
    failures: path.join(root, 'source', 'failures', 'failure-lessons.json'),
    episodeArchive: path.join(root, 'episodes', 'archive'),
    episodeIndex: path.join(root, 'episodes', 'index.json'),
    schemas: path.join(root, 'source', 'schemas'),
    dist: path.join(root, 'dist')
  };
}

function addFilesProperty(schema) {
  if (!schema || typeof schema !== 'object') return schema;
  schema.properties ||= {};
  schema.properties.files = {
    type: 'array',
    items: { type: 'string', minLength: 1 },
    uniqueItems: true,
    description: 'Normalized project-relative file references when possible.'
  };
  return schema;
}

function ensureFileReferenceSchemas() {
  const paths = recordPaths();
  ensureDir(paths.schemas);
  for (const name of ['memory.schema.json', 'proposal.schema.json', 'episode.schema.json']) {
    const filePath = path.join(paths.schemas, name);
    if (!exists(filePath)) continue;
    const schema = readJson(filePath, null);
    if (schema) writeJson(filePath, addFilesProperty(schema));
  }
  const optionalFiles = {
    files: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
      uniqueItems: true,
      description: 'Normalized project-relative file references when possible.'
    }
  };
  const schemas = {
    'failure-lesson.schema.json': {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'https://agent-kernel.local/schemas/failure-lesson.schema.json',
      title: 'Agent Kernel Failure Lesson',
      type: 'object',
      additionalProperties: true,
      required: ['id', 'errorSignature', 'failureType', 'status', 'createdAt'],
      properties: { id: { type: 'string' }, status: { type: 'string' }, errorSignature: { type: 'string' }, failureType: { type: 'string' }, ...optionalFiles, createdAt: { type: 'string' }, updatedAt: { type: 'string' } }
    },
    'session-observation.schema.json': {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'https://agent-kernel.local/schemas/session-observation.schema.json',
      title: 'Agent Kernel Session Observation',
      type: 'object',
      additionalProperties: true,
      required: ['id', 'sessionId', 'type', 'timestamp'],
      properties: { id: { type: 'string' }, sessionId: { type: 'string' }, type: { type: 'string' }, timestamp: { type: 'string' }, ...optionalFiles }
    },
    'commit-record.schema.json': {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'https://agent-kernel.local/schemas/commit-record.schema.json',
      title: 'Agent Kernel Commit Record',
      type: 'object',
      additionalProperties: true,
      required: ['id', 'sha', 'createdAt'],
      properties: { id: { type: 'string' }, sha: { type: 'string' }, message: { type: 'string' }, ...optionalFiles, createdAt: { type: 'string' } }
    }
  };
  for (const [name, schema] of Object.entries(schemas)) writeJson(path.join(paths.schemas, name), schema);
}

function memoryFiles() {
  const dir = recordPaths().memories;
  if (!exists(dir)) return [];
  return fs.readdirSync(dir).sort().filter((name) => name.endsWith('.json')).map((name) => path.join(dir, name));
}

function updateArrayRecord(filePath, wantedId, updater) {
  const records = readJson(filePath, []);
  if (!Array.isArray(records)) return false;
  const index = records.findIndex((item) => item?.id === wantedId);
  if (index < 0) return false;
  records[index] = updater(records[index]);
  writeJson(filePath, records);
  return true;
}

function addFilesToRecord(record, files) {
  if (!files.length) return record;
  return { ...record, files: [...new Set([...(Array.isArray(record.files) ? record.files : []), ...files])] };
}

function updateMemoryRecord(id, files) {
  for (const filePath of memoryFiles()) {
    if (updateArrayRecord(filePath, id, (record) => addFilesToRecord(record, files))) return true;
  }
  return false;
}

function updatePendingProposal(id, files) {
  const filePath = path.join(recordPaths().pending, `${id}.json`);
  if (!exists(filePath)) return false;
  const proposal = readJson(filePath, null);
  if (!proposal) return false;
  writeJson(filePath, addFilesToRecord(proposal, files));
  return true;
}

function updateFailureLesson(id, files) {
  const filePath = recordPaths().failures;
  return updateArrayRecord(filePath, id, (record) => {
    const next = addFilesToRecord(record, files);
    next.evidence = { ...(next.evidence || {}), filesTouched: next.files || files };
    return next;
  });
}

function updateEpisode(id, files) {
  const paths = recordPaths();
  const archivePath = path.join(paths.episodeArchive, `${id}.json`);
  if (!exists(archivePath)) return false;
  const episode = readJson(archivePath, null);
  if (!episode) return false;
  writeJson(archivePath, addFilesToRecord(episode, files));
  const index = readJson(paths.episodeIndex, { version: 1, episodes: [] });
  if (Array.isArray(index?.episodes)) {
    const position = index.episodes.findIndex((item) => item?.id === id);
    if (position >= 0) index.episodes[position] = addFilesToRecord(index.episodes[position], files);
    writeJson(paths.episodeIndex, index);
  }
  return true;
}

function hydrateEpisodeIndexFiles() {
  const paths = recordPaths();
  const index = readJson(paths.episodeIndex, { version: 1, episodes: [] });
  if (!Array.isArray(index?.episodes)) return;
  index.episodes = index.episodes.map((item) => {
    const archived = readJson(path.join(paths.episodeArchive, `${item.id}.json`), null);
    return archived?.files?.length ? addFilesToRecord(item, archived.files) : item;
  });
  writeJson(paths.episodeIndex, index);
}

function recordFiles(record, cwd = process.cwd()) {
  const root = projectRoot(cwd);
  const base = record?.cwd || record?.source?.cwd || record?.evidence?.cwd || cwd;
  const values = [
    ...(Array.isArray(record?.files) ? record.files : []),
    ...(Array.isArray(record?.evidence?.filesTouched) ? record.evidence.filesTouched : [])
  ];
  return [...new Set(values.map((value) => normalizeFile(value, root, base)).filter(Boolean))];
}

function matchesFiles(record, wanted, cwd = process.cwd()) {
  if (!wanted.length) return true;
  const stored = recordFiles(record, cwd).map((value) => value.toLowerCase());
  return wanted.some((file) => stored.includes(file.toLowerCase()));
}

function textMatches(record, query) {
  if (!query) return true;
  return JSON.stringify(record || {}).toLowerCase().includes(String(query).toLowerCase());
}

function outputRecords(records, options = {}) {
  if (options.json) {
    process.stdout.write(JSON.stringify(records, null, 2) + '\n');
    return;
  }
  if (!records.length) {
    process.stdout.write((options.empty || 'No matching records.') + '\n');
    return;
  }
  for (const record of records) {
    const header = `[${record.id}] ${record.type || record.failureType || 'record'}${record.status ? `/${record.status}` : ''}`;
    const body = record.text || record.title || record.errorSignature || record.summary || '';
    process.stdout.write(`${header}\n${body}\nfiles=${(record.files || recordFiles(record)).join(',')}\n\n`);
  }
}

function handleRememberOrPropose(command, args) {
  const files = normalizedFiles(args);
  const result = run(distCliPath, [command, ...stripFileFlags(args)]);
  const pattern = command === 'remember'
    ? /Saved approved [^:]+:\s*(\S+)/
    : /Created pending memory proposal:\s*(\S+)/;
  const id = result.stdout.match(pattern)?.[1];
  if (id && files.length) {
    if (command === 'remember') updateMemoryRecord(id, files);
    else updatePendingProposal(id, files);
  }
  printCaptured(result);
}

function loadMemories() {
  const records = [];
  for (const filePath of memoryFiles()) {
    const bucket = path.basename(filePath, '.json');
    const value = readJson(filePath, []);
    if (Array.isArray(value)) records.push(...value.map((record) => ({ ...record, bucket })));
  }
  return records;
}

function handleMemory(args) {
  const action = args[0] || 'list';
  const files = normalizedFiles(args);
  if (!files.length) return printCaptured(run(distCliPath, ['memory', ...args]));
  const rest = args.slice(1);
  const query = parseValueFlag(rest, '--query', positionalArgs(rest).join(' '));
  let records = loadMemories().filter((record) => matchesFiles(record, files));
  if (action === 'search') records = records.filter((record) => textMatches(record, query));
  if (action === 'list' || action === 'search') {
    records.sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
    return outputRecords(records, { json: parseBooleanFlag(args, '--json'), empty: action === 'search' ? 'No matching memories.' : 'No memories found.' });
  }
  return printCaptured(run(distCliPath, ['memory', ...args]));
}

function parseIdFromJsonOrText(stdout, patterns) {
  try {
    const parsed = JSON.parse(stdout);
    if (parsed?.id) return parsed.id;
  } catch {
    // Human-readable command output is handled below.
  }
  for (const pattern of patterns) {
    const match = stdout.match(pattern);
    if (match?.[1]) return match[1];
  }
  return '';
}

function loadFailures() {
  const value = readJson(recordPaths().failures, []);
  return Array.isArray(value) ? value : [];
}

function handleFailure(args) {
  const action = args[0] || 'help';
  const files = normalizedFiles(args);
  if ((action === 'list' || action === 'search') && files.length) {
    const rest = args.slice(1);
    const query = action === 'search' ? parseValueFlag(rest, '--query', positionalArgs(rest).join(' ')) : '';
    let records = loadFailures().filter((record) => matchesFiles(record, files));
    if (query) records = records.filter((record) => textMatches(record, query));
    records.sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
    return outputRecords(records, { json: parseBooleanFlag(args, '--json'), empty: action === 'search' ? 'No matching failure lessons.' : 'No failure lessons found.' });
  }

  const forwarded = withNormalizedFileFlags(args.slice(1), files);
  const result = run(failurePath, [action, ...forwarded]);
  const lessonId = parseIdFromJsonOrText(result.stdout, [
    /Captured failure lesson:\s*(\S+)/,
    /Updated existing failure lesson:\s*(\S+)/
  ]);
  if (lessonId && files.length) updateFailureLesson(lessonId, files);

  const proposalId = result.stdout.match(/Created pending memory proposal:\s*(\S+)/)?.[1];
  if (proposalId) {
    const sourceLessonId = lessonId || positionalArgs(args.slice(1))[0];
    const lesson = loadFailures().find((record) => record.id === sourceLessonId || record.id?.includes(sourceLessonId));
    const proposalFiles = files.length ? files : recordFiles(lesson || {});
    if (proposalFiles.length) updatePendingProposal(proposalId, proposalFiles);
  }
  printCaptured(result);
}

function loadEpisodes() {
  const dir = recordPaths().episodeArchive;
  if (!exists(dir)) return [];
  return fs.readdirSync(dir).sort().filter((name) => name.endsWith('.json')).map((name) => readJson(path.join(dir, name), null)).filter(Boolean);
}

function episodeScore(record, query) {
  if (!query) return 1;
  const terms = String(query).toLowerCase().match(/[\p{L}\p{N}_-]+/gu) || [];
  const haystack = JSON.stringify(record || {}).toLowerCase();
  return terms.reduce((score, term) => score + (term.length > 1 && haystack.includes(term) ? 1 : 0), 0);
}

function outputEpisodes(records, json) {
  if (json) return process.stdout.write(JSON.stringify(records, null, 2) + '\n');
  if (!records.length) return process.stdout.write('No matching episodes.\n');
  for (const episode of records) {
    const excerpt = String(episode.text || '').replace(/\s+/g, ' ').slice(0, 260);
    process.stdout.write(`[${episode.id}] ${episode.title}\nagent=${episode.agent || ''} project=${episode.project || ''} updated=${episode.updatedAt || episode.createdAt}\nfiles=${(episode.files || []).join(',')}\n${excerpt}\n\n`);
  }
}

function handleEpisode(args) {
  const action = args[0] || 'stats';
  const rest = args.slice(1);
  const files = normalizedFiles(rest);

  if (action === 'search' && files.length) {
    const query = parseValueFlag(rest, '--query', positionalArgs(rest).join(' '));
    const limit = Math.max(1, Math.min(Number(parseValueFlag(rest, '--limit', '10')), 50));
    const records = loadEpisodes()
      .filter((record) => matchesFiles(record, files))
      .map((record) => ({ record, score: episodeScore(record, query) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || String(b.record.updatedAt || b.record.createdAt || '').localeCompare(String(a.record.updatedAt || a.record.createdAt || '')))
      .slice(0, limit)
      .map((entry) => entry.record);
    return outputEpisodes(records, parseBooleanFlag(rest, '--json'));
  }

  const result = run(distCliPath, ['episode', action, ...stripFileFlags(rest)]);
  if ((action === 'add' || action === 'capture') && files.length) {
    const id = result.stdout.match(/Saved episode:\s*(\S+)/)?.[1];
    if (id) updateEpisode(id, files);
  }
  if (action === 'reindex') hydrateEpisodeIndexFiles();
  printCaptured(result);
}

function handleSession(args) {
  const action = args[0] || 'help';
  const rest = args.slice(1);
  const files = normalizedFiles(rest);
  if (action === 'observe' && files.length) {
    return printCaptured(run(sessionPath, [action, ...withNormalizedFileFlags(rest, files)]));
  }
  if (action === 'observations' && files.length) {
    const sessionId = positionalArgs(rest)[0];
    if (!sessionId) throw new Error('Usage: agent-kernel session observations <session-id> --files <path>');
    const sessionFile = path.join(kernelHome(), 'runtime', 'sessions', `${sessionId}.jsonl`);
    const raw = readText(sessionFile, '').trim();
    const records = raw ? raw.split(/\r?\n/).map((line) => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean) : [];
    const query = parseValueFlag(rest, '--query', '');
    const filtered = records.filter((record) => matchesFiles(record, files)).filter((record) => textMatches(record, query));
    if (parseBooleanFlag(rest, '--json')) return process.stdout.write(JSON.stringify({ observations: filtered }, null, 2) + '\n');
    if (!filtered.length) return process.stdout.write('No observations found\n');
    for (const record of filtered) process.stdout.write(`${record.timestamp}\t${record.type}\t${record.agentId}\t${record.text}\n`);
    return;
  }
  printCaptured(run(sessionPath, args));
}

function handleCompile(args) {
  const files = normalizedFiles(args);
  const forwarded = stripFileFlags(args);
  const result = run(distCliPath, ['compile', ...forwarded]);
  if (!files.length) return printCaptured(result);

  const contextArgs = [...files, '--budget', parseValueFlag(args, '--budget', '4000')];
  const context = run(fileContextPath, contextArgs).stdout;
  const outputPath = path.join(recordPaths().dist, 'file-context.md');
  writeText(outputPath, `# File-specific Agent Kernel context\n\nFiles: ${files.map((file) => `\`${file}\``).join(', ')}\n\n${context}`);
  printCaptured(result);
  process.stdout.write(`File context: ${outputPath}\n`);
}

function usage() {
  process.stdout.write(`agent-kernel-file-records ${VERSION}\n\nInternal public-CLI adapter for normalized file references.\n`);
}

function main() {
  const [command, ...args] = process.argv.slice(2);
  ensureFileReferenceSchemas();
  if (!command || command === 'help' || command === '--help' || command === '-h') return usage();
  try {
    if (command === 'remember' || command === 'propose') return handleRememberOrPropose(command, args);
    if (command === 'memory') return handleMemory(args);
    if (command === 'failure') return handleFailure(args);
    if (command === 'episode') return handleEpisode(args);
    if (command === 'session') return handleSession(args);
    if (command === 'compile') return handleCompile(args);
    throw new Error(`Unsupported file-record command: ${command}`);
  } catch (error) {
    process.stderr.write(`${error?.message || String(error)}\n`);
    process.exitCode = error?.status || 1;
  }
}

main();
