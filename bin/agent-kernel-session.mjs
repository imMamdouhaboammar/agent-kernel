#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const VERSION = '1.8.0';
const COMPACT_WIDTH = 120;
const OBSERVATION_TYPES = new Set([
  'user_prompt',
  'assistant_plan',
  'tool_use',
  'tool_result',
  'tool_failure',
  'file_read',
  'file_edit',
  'command_run',
  'command_failure',
  'test_failure',
  'guard_block',
  'permission_prompt',
  'session_summary',
  'manual_note'
]);

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

function appendJsonl(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, JSON.stringify(value) + '\n');
}

function sessionPaths() {
  const root = kernelHome();
  const sessions = path.join(root, 'runtime', 'sessions');
  return { root, runtime: path.join(root, 'runtime'), sessions };
}

function parseFlags(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const raw = arg.slice(2);
      const eq = raw.indexOf('=');
      if (eq >= 0) out[raw.slice(0, eq)] = raw.slice(eq + 1);
      else if (argv[i + 1] && !argv[i + 1].startsWith('-')) out[raw] = argv[++i];
      else out[raw] = true;
    } else {
      out._.push(arg);
    }
  }
  return out;
}

function sessionId() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  return `session_${stamp}_${crypto.randomBytes(4).toString('hex')}`;
}

function observationId() {
  return `obs_${crypto.randomBytes(8).toString('hex')}`;
}

function projectIdFrom(projectPath) {
  return path.basename(path.resolve(projectPath || '.')) || 'project';
}

function sessionFile(id) {
  return path.join(sessionPaths().sessions, `${id}.json`);
}

function sessionLogFile(id) {
  return path.join(sessionPaths().sessions, `${id}.jsonl`);
}

function readSession(id) {
  return readJson(sessionFile(id), null);
}

function listSessions() {
  const p = sessionPaths();
  if (!exists(p.sessions)) return [];
  return fs.readdirSync(p.sessions)
    .filter((name) => name.endsWith('.json') && !name.endsWith('.jsonl'))
    .map((name) => readJson(path.join(p.sessions, name), null))
    .filter(Boolean)
    .sort((a, b) => String(b.updatedAt || b.startedAt || '').localeCompare(String(a.updatedAt || a.startedAt || '')));
}

function readObservations(id) {
  const raw = readText(sessionLogFile(id), '').trim();
  if (!raw) return [];
  return raw.split(/\r?\n/).map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function slash(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function normalizeFiles(flags) {
  const files = [];
  const add = (value) => {
    if (Array.isArray(value)) value.forEach(add);
    else if (typeof value === 'string') value.split(',').forEach((item) => {
      const normalized = slash(item.trim());
      if (normalized) files.push(normalized);
    });
  };
  add(flags.file);
  add(flags.files);
  return [...new Set(files)];
}

function observationMatchesFiles(observation, requestedFiles) {
  if (!requestedFiles.length) return true;
  const observedFiles = (Array.isArray(observation.files) ? observation.files : [])
    .map(slash)
    .filter(Boolean);
  return requestedFiles.some((requested) => observedFiles.some((observed) => (
    observed === requested ||
    observed.endsWith('/' + requested) ||
    requested.endsWith('/' + observed)
  )));
}

function filterObservations(observations, flags) {
  let out = observations;
  if (flags.type) out = out.filter((obs) => obs.type === flags.type);
  const files = normalizeFiles(flags);
  if (files.length) out = out.filter((obs) => observationMatchesFiles(obs, files));
  if (flags.command) out = out.filter((obs) => String(obs.command || '').includes(String(flags.command)));
  if (flags.query) {
    const q = String(flags.query).toLowerCase();
    out = out.filter((obs) => JSON.stringify(obs).toLowerCase().includes(q));
  }
  return out;
}

function chronologicalObservations(observations) {
  return observations
    .map((observation, sourceIndex) => ({
      observation,
      sourceIndex,
      time: Date.parse(observation.timestamp || observation.createdAt || '')
    }))
    .sort((a, b) => {
      const aValid = Number.isFinite(a.time);
      const bValid = Number.isFinite(b.time);
      if (aValid && bValid && a.time !== b.time) return a.time - b.time;
      if (aValid !== bValid) return aValid ? -1 : 1;
      return a.sourceIndex - b.sourceIndex;
    })
    .map(({ observation }, index) => ({ sequence: index + 1, ...observation }));
}

function compactText(value, limit = 500) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= limit) return text;
  if (limit <= 3) return text.slice(0, limit);
  return text.slice(0, limit - 3) + '...';
}

function compactTimestamp(value) {
  const text = String(value || 'unknown-time');
  const match = text.match(/T(\d{2}:\d{2}:\d{2})/);
  return match ? match[1] : compactText(text, 19);
}

function compactTimelineLine(observation) {
  const time = compactTimestamp(observation.timestamp || observation.createdAt);
  const type = compactText(observation.type || 'unknown', 20);
  const files = (observation.files || []).map(slash).filter(Boolean);
  const file = files.length ? compactText(files.join(','), 28) : '-';
  const command = observation.command ? ` ${compactText(observation.command, 28)}` : '';
  const prefix = `${time} ${type} ${file}${command}`;
  const remaining = Math.max(12, COMPACT_WIDTH - prefix.length - 3);
  return compactText(`${prefix} | ${compactText(observation.text, remaining)}`, COMPACT_WIDTH);
}

function timelineFilters(flags) {
  return {
    type: flags.type || null,
    files: normalizeFiles(flags),
    command: flags.command || null,
    query: flags.query || null
  };
}

function printJson(value) {
  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}

function commandStart(flags) {
  const agentId = String(flags.agent || flags.from || flags._[0] || 'unknown-agent');
  const projectArg = String(flags.project || flags.cwd || flags._[1] || '.');
  const cwd = path.resolve(projectArg);
  if (!exists(cwd)) {
    process.stderr.write(`Project path not found: ${cwd}\n`);
    process.exitCode = 1;
    return;
  }
  const id = sessionId();
  const createdAt = nowIso();
  const session = {
    id,
    projectId: String(flags.projectId || projectIdFrom(cwd)),
    cwd,
    agentId,
    agentRole: String(flags.role || 'coding-agent'),
    trustLevel: String(flags.trust || 'propose-only'),
    startedAt: createdAt,
    endedAt: null,
    updatedAt: createdAt,
    status: 'active',
    observationCount: 0,
    linkedCommits: [],
    linkedFailures: [],
    linkedEpisodes: [],
    summary: ''
  };
  writeJson(sessionFile(id), session);
  if (flags.json) printJson(session);
  else process.stdout.write(`Started session ${id}\n`);
}

function commandEnd(flags) {
  const id = flags._[0];
  if (!id) {
    process.stderr.write('Usage: agent-kernel session end <session-id>\n');
    process.exitCode = 1;
    return;
  }
  const session = readSession(id);
  if (!session) {
    process.stderr.write(`Session not found: ${id}\n`);
    process.exitCode = 1;
    return;
  }
  const endedAt = nowIso();
  const observations = readObservations(id);
  const next = {
    ...session,
    endedAt,
    updatedAt: endedAt,
    status: 'completed',
    observationCount: observations.length || Number(session.observationCount || 0)
  };
  writeJson(sessionFile(id), next);
  if (flags.json) printJson(next);
  else process.stdout.write(`Ended session ${id}\n`);
}

function commandList(flags) {
  const sessions = listSessions();
  if (flags.json) {
    printJson({ sessions });
    return;
  }
  if (!sessions.length) {
    process.stdout.write('No sessions found\n');
    return;
  }
  for (const session of sessions) {
    process.stdout.write(`${session.id}\t${session.status}\t${session.agentId}\t${session.projectId}\t${session.updatedAt || session.startedAt}\n`);
  }
}

function commandShow(flags) {
  const id = flags._[0];
  if (!id) {
    process.stderr.write('Usage: agent-kernel session show <session-id>\n');
    process.exitCode = 1;
    return;
  }
  const session = readSession(id);
  if (!session) {
    process.stderr.write(`Session not found: ${id}\n`);
    process.exitCode = 1;
    return;
  }
  const observations = readObservations(id);
  if (flags.json) {
    printJson({ session, observations });
    return;
  }
  process.stdout.write(`Session: ${session.id}\n`);
  process.stdout.write(`Status: ${session.status}\n`);
  process.stdout.write(`Agent: ${session.agentId}\n`);
  process.stdout.write(`Project: ${session.projectId}\n`);
  process.stdout.write(`CWD: ${session.cwd}\n`);
  process.stdout.write(`Started: ${session.startedAt}\n`);
  process.stdout.write(`Ended: ${session.endedAt || 'not ended'}\n`);
  process.stdout.write(`Observations: ${observations.length || session.observationCount || 0}\n`);
}

function commandObserve(flags) {
  const id = flags._[0] || flags.session || flags.sessionId;
  if (!id) {
    process.stderr.write('Usage: agent-kernel session observe <session-id> --type <type> --text <text>\n');
    process.exitCode = 1;
    return;
  }
  const session = readSession(id);
  if (!session) {
    process.stderr.write(`Session not found: ${id}\n`);
    process.exitCode = 1;
    return;
  }
  const type = String(flags.type || 'manual_note');
  if (!OBSERVATION_TYPES.has(type)) {
    process.stderr.write(`Invalid observation type: ${type}\n`);
    process.exitCode = 1;
    return;
  }
  const text = normalizeString(flags.text || flags._.slice(1).join(' '));
  if (!text) {
    process.stderr.write('Observation text is required. Use --text <text>.\n');
    process.exitCode = 1;
    return;
  }
  const timestamp = nowIso();
  const observation = {
    id: observationId(),
    sessionId: id,
    timestamp,
    agentId: String(flags.agent || session.agentId || 'unknown-agent'),
    type,
    projectId: String(flags.projectId || session.projectId || 'project'),
    cwd: String(flags.cwd || session.cwd || process.cwd()),
    files: normalizeFiles(flags),
    command: normalizeString(flags.command),
    exitCode: Number.isFinite(Number(flags.exitCode)) ? Number(flags.exitCode) : null,
    text,
    metadata: {}
  };
  appendJsonl(sessionLogFile(id), observation);
  const next = { ...session, updatedAt: timestamp, observationCount: readObservations(id).length };
  writeJson(sessionFile(id), next);
  if (flags.json) printJson({ observation, session: next });
  else process.stdout.write(`Captured observation ${observation.id}\n`);
}

function commandObservations(flags) {
  const id = flags._[0] || flags.session || flags.sessionId;
  if (!id) {
    process.stderr.write('Usage: agent-kernel session observations <session-id> [--type type] [--file path] [--command text] [--query text]\n');
    process.exitCode = 1;
    return;
  }
  if (!readSession(id)) {
    process.stderr.write(`Session not found: ${id}\n`);
    process.exitCode = 1;
    return;
  }
  const observations = filterObservations(readObservations(id), flags);
  if (flags.json) {
    printJson({ observations });
    return;
  }
  if (!observations.length) {
    process.stdout.write('No observations found\n');
    return;
  }
  for (const obs of observations) {
    process.stdout.write(`${obs.timestamp}\t${obs.type}\t${obs.agentId}\t${obs.text}\n`);
  }
}

function commandTimeline(flags) {
  const id = flags._[0] || flags.session || flags.sessionId;
  if (!id) {
    process.stderr.write('Usage: agent-kernel session timeline <session-id> [--type type] [--files path] [--compact] [--json]\n');
    process.exitCode = 1;
    return;
  }
  const session = readSession(id);
  if (!session) {
    process.stderr.write(`Session not found: ${id}\n`);
    process.exitCode = 1;
    return;
  }

  const observations = chronologicalObservations(filterObservations(readObservations(id), flags));
  const result = {
    session,
    filters: timelineFilters(flags),
    count: observations.length,
    observations
  };

  if (flags.json) {
    printJson(result);
    return;
  }

  if (!observations.length) {
    process.stdout.write(`No timeline events found for session ${id}\n`);
    return;
  }

  if (flags.compact) {
    for (const observation of observations) {
      process.stdout.write(compactTimelineLine(observation) + '\n');
    }
    return;
  }

  process.stdout.write(`Session timeline: ${session.id}\n`);
  process.stdout.write(`Agent: ${session.agentId}\n`);
  process.stdout.write(`Project: ${session.projectId}\n`);
  process.stdout.write(`Events: ${observations.length}\n\n`);

  for (const observation of observations) {
    process.stdout.write(`${observation.sequence}. ${observation.timestamp || 'unknown time'}  ${observation.type || 'unknown'}\n`);
    process.stdout.write(`   Agent: ${observation.agentId || session.agentId || 'unknown-agent'}\n`);
    if (observation.files?.length) process.stdout.write(`   Files: ${observation.files.map(slash).join(', ')}\n`);
    if (observation.command) process.stdout.write(`   Command: ${compactText(observation.command, 500)}\n`);
    if (observation.exitCode !== null && observation.exitCode !== undefined) process.stdout.write(`   Exit: ${observation.exitCode}\n`);
    process.stdout.write(`   ${compactText(observation.text, 800) || '(no text)'}\n\n`);
  }
}

function usage() {
  process.stdout.write(`agent-kernel-session ${VERSION}\n\nUsage:\n  agent-kernel session start --agent <agent-id> [--project .] [--json]\n  agent-kernel session end <session-id> [--json]\n  agent-kernel session list [--json]\n  agent-kernel session show <session-id> [--json]\n  agent-kernel session observe <session-id> --type <type> --text <text> [--file path] [--command cmd] [--exit-code n] [--json]\n  agent-kernel session observations <session-id> [--type type] [--file path] [--command text] [--query text] [--json]\n  agent-kernel session timeline <session-id> [--type type] [--file path|--files a,b] [--compact] [--json]\n`);
}

function main() {
  const [command, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);
  if (!command || command === 'help' || command === '--help' || command === '-h') return usage();
  if (command === 'start') return commandStart(flags);
  if (command === 'end') return commandEnd(flags);
  if (command === 'list') return commandList(flags);
  if (command === 'show') return commandShow(flags);
  if (command === 'observe') return commandObserve(flags);
  if (command === 'observations') return commandObservations(flags);
  if (command === 'timeline') return commandTimeline(flags);
  process.stderr.write(`Unknown session command: ${command}\n`);
  usage();
  process.exitCode = 1;
}

main();
