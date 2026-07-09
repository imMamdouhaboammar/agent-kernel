#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const VERSION = '1.0.0';

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
  return raw.split('\n').map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
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

function usage() {
  process.stdout.write(`agent-kernel-session ${VERSION}\n\nUsage:\n  agent-kernel session start --agent <agent-id> [--project .] [--json]\n  agent-kernel session end <session-id> [--json]\n  agent-kernel session list [--json]\n  agent-kernel session show <session-id> [--json]\n`);
}

function main() {
  const [command, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);
  if (!command || command === 'help' || command === '--help' || command === '-h') return usage();
  if (command === 'start') return commandStart(flags);
  if (command === 'end') return commandEnd(flags);
  if (command === 'list') return commandList(flags);
  if (command === 'show') return commandShow(flags);
  process.stderr.write(`Unknown session command: ${command}\n`);
  usage();
  process.exitCode = 1;
}

main();
