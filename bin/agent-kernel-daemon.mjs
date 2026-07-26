#!/usr/bin/env node
import childProcess from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '1.15.1';
const MAX_REQUEST_BODY_BYTES = 1024 * 1024;
const MIN_REMOTE_TOKEN_BYTES = 32;
const SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const REQUEST_BODY_TOO_LARGE = Symbol('request-body-too-large');
const here = path.dirname(fileURLToPath(import.meta.url));
const selfPath = path.join(here, 'agent-kernel-daemon.mjs');

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

function runtimePaths() {
  const root = kernelHome();
  const runtime = path.join(root, 'runtime');
  return {
    root,
    runtime,
    sessions: path.join(runtime, 'sessions'),
    observations: path.join(runtime, 'observations'),
    logs: path.join(runtime, 'logs'),
    status: path.join(runtime, 'daemon.json'),
    sourceMemories: path.join(root, 'source', 'memories'),
    failures: path.join(root, 'source', 'failures', 'failure-lessons.json'),
    episodeIndex: path.join(root, 'episodes', 'index.json')
  };
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

function isPidAlive(pid) {
  if (!pid || !Number.isInteger(Number(pid))) return false;
  try { process.kill(Number(pid), 0); return true; } catch { return false; }
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function listSessions() {
  const p = runtimePaths();
  if (!exists(p.sessions)) return [];
  return fs.readdirSync(p.sessions)
    .filter((name) => name.endsWith('.json') && !name.endsWith('.jsonl'))
    .map((name) => readJson(path.join(p.sessions, name), null))
    .filter(Boolean)
    .sort((a, b) => String(b.updatedAt || b.startedAt || '').localeCompare(String(a.updatedAt || a.startedAt || '')));
}

function sessionStats() {
  const sessions = listSessions();
  const activeSessions = sessions.filter((session) => session.status === 'active').length;
  const lastObservationAt = sessions
    .map((session) => session.updatedAt || session.startedAt || '')
    .filter(Boolean)
    .sort()
    .at(-1) || null;
  return { sessionCount: sessions.length, activeSessions, lastObservationAt };
}

function withRuntimeMetrics(status) {
  const stats = sessionStats();
  const startedAtMs = Date.parse(status.startedAt || '');
  const uptimeMs = Number.isFinite(startedAtMs) ? Math.max(0, Date.now() - startedAtMs) : null;
  return { ...status, ...stats, uptimeMs, uptimeSeconds: uptimeMs === null ? null : Math.floor(uptimeMs / 1000) };
}

function readDaemonStatus() {
  const p = runtimePaths();
  const status = readJson(p.status, null);
  if (!status || !isPidAlive(status.pid)) return { running: false, statusPath: p.status };
  return withRuntimeMetrics({ running: true, statusPath: p.status, ...status });
}

function sendJson(res, statusCode, body, headers = {}) {
  const text = JSON.stringify(body, null, 2) + '\n';
  res.writeHead(statusCode, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
    'x-content-type-options': 'nosniff',
    ...headers
  });
  res.end(text);
}

function readRequestJson(req) {
  return new Promise((resolve) => {
    let body = '';
    let bytes = 0;
    let tooLarge = false;
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      if (tooLarge) return;
      bytes += Buffer.byteLength(chunk);
      if (bytes > MAX_REQUEST_BODY_BYTES) {
        tooLarge = true;
        body = '';
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      if (tooLarge) return resolve(REQUEST_BODY_TOO_LARGE);
      if (!body.trim()) return resolve({});
      try { resolve(JSON.parse(body)); } catch { resolve(null); }
    });
    req.on('error', () => resolve(null));
  });
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validSessionId(value) {
  return SESSION_ID_PATTERN.test(value);
}

function isLocalHost(host) {
  const normalized = String(host || '').trim().toLowerCase();
  return normalized === '127.0.0.1' || normalized === 'localhost' || normalized === '::1';
}

function daemonSecurity(host) {
  if (isLocalHost(host)) return { authentication: 'local-only', token: '' };
  if (process.env.AGENT_KERNEL_DAEMON_ALLOW_REMOTE !== '1') {
    return { error: 'Refusing non-local daemon host. Set AGENT_KERNEL_DAEMON_ALLOW_REMOTE=1 to override.' };
  }
  const token = String(process.env.AGENT_KERNEL_DAEMON_TOKEN || '');
  if (Buffer.byteLength(token, 'utf8') < MIN_REMOTE_TOKEN_BYTES) {
    return { error: `Remote daemon access requires AGENT_KERNEL_DAEMON_TOKEN with at least ${MIN_REMOTE_TOKEN_BYTES} bytes.` };
  }
  return { authentication: 'bearer', token };
}

function requestAuthorized(req, expectedToken) {
  if (!expectedToken) return true;
  const authorization = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
  if (!authorization.startsWith('Bearer ')) return false;
  const provided = Buffer.from(authorization.slice('Bearer '.length), 'utf8');
  const expected = Buffer.from(expectedToken, 'utf8');
  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
}

function appendJsonl(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, JSON.stringify(value) + '\n');
}

function observationFromBody(body) {
  const sessionId = normalizeString(body.sessionId);
  const agentId = normalizeString(body.agentId);
  const type = normalizeString(body.type);
  const projectId = normalizeString(body.projectId);
  const cwd = normalizeString(body.cwd);
  const text = normalizeString(body.text);
  if (sessionId && !validSessionId(sessionId)) return { error: 'invalid sessionId' };
  if (!sessionId || !agentId || !type || !projectId || !cwd || !text) {
    return { error: 'sessionId, agentId, type, projectId, cwd, and text are required strings' };
  }
  return {
    observation: {
      id: `obs_${crypto.randomBytes(8).toString('hex')}`,
      sessionId,
      timestamp: normalizeString(body.timestamp) || nowIso(),
      agentId,
      type,
      projectId,
      cwd,
      files: normalizeStringArray(body.files),
      command: normalizeString(body.command),
      exitCode: Number.isFinite(Number(body.exitCode)) ? Number(body.exitCode) : null,
      text,
      metadata: body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata) ? body.metadata : {}
    }
  };
}

function updateSessionForObservation(observation) {
  const p = runtimePaths();
  const sessionPath = path.join(p.sessions, `${observation.sessionId}.json`);
  const existing = readJson(sessionPath, null);
  const session = existing || {
    id: observation.sessionId,
    projectId: observation.projectId,
    cwd: observation.cwd,
    agentId: observation.agentId,
    startedAt: observation.timestamp,
    status: 'active',
    observationCount: 0,
    linkedCommits: [],
    linkedFailures: [],
    linkedEpisodes: []
  };
  session.projectId ||= observation.projectId;
  session.cwd ||= observation.cwd;
  session.agentId ||= observation.agentId;
  session.status ||= 'active';
  session.observationCount = Number(session.observationCount || 0) + 1;
  session.updatedAt = observation.timestamp;
  writeJson(sessionPath, session);
  return session;
}

function loadApprovedMemory() {
  const p = runtimePaths();
  if (!exists(p.sourceMemories)) return [];
  const items = [];
  for (const name of fs.readdirSync(p.sourceMemories)) {
    if (!name.endsWith('.json')) continue;
    const value = readJson(path.join(p.sourceMemories, name), []);
    if (!Array.isArray(value)) continue;
    for (const item of value) {
      if (item && item.status === 'approved') items.push({ ...item, bucket: name.replace(/\.json$/, '') });
    }
  }
  return items;
}

function loadFailureLessons() {
  const p = runtimePaths();
  const value = readJson(p.failures, []);
  return Array.isArray(value) ? value : [];
}

function loadEpisodes() {
  const p = runtimePaths();
  const value = readJson(p.episodeIndex, []);
  return Array.isArray(value) ? value : [];
}

function itemText(item) {
  return JSON.stringify(item || {}).toLowerCase();
}

function relevantItems(items, query, files, limit = 8) {
  const q = String(query || '').toLowerCase();
  const fileTokens = files.map((f) => f.toLowerCase());
  return items
    .map((item) => {
      const text = itemText(item);
      let score = 0;
      if (q && text.includes(q)) score += 4;
      for (const file of fileTokens) if (text.includes(file)) score += 6;
      if (!q && !fileTokens.length) score += 1;
      return { item, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.item);
}

function renderContext(sections, budget) {
  const lines = [];
  const pushSection = (title, items, getText) => {
    if (!items.length) return;
    lines.push(`## ${title}`);
    for (const item of items) lines.push(`- ${getText(item)}`.slice(0, 500));
    lines.push('');
  };
  pushSection('Approved Rules', sections.approvedRules, (item) => item.text || item.title || item.id || 'approved memory');
  pushSection('Failure Lessons', sections.failureLessons, (item) => item.fix || item.rootCause || item.text || item.id || 'failure lesson');
  pushSection('Related Episodes', sections.episodes, (item) => item.title || item.summary || item.id || 'episode');
  const text = lines.join('\n').trim();
  return text.slice(0, Math.max(100, Number(budget || 1200)));
}

function buildContext(body) {
  const query = normalizeString(body.query);
  const files = normalizeStringArray(body.files);
  const budget = Number.isFinite(Number(body.budget)) ? Number(body.budget) : 1200;
  const sections = {
    approvedRules: relevantItems(loadApprovedMemory(), query, files),
    failureLessons: relevantItems(loadFailureLessons(), query, files),
    episodes: relevantItems(loadEpisodes(), query, files),
    guardWarnings: [],
    pendingProposals: []
  };
  const context = renderContext(sections, budget);
  return { context, sections, budgetUsed: context.length };
}

function readSession(sessionId) {
  const p = runtimePaths();
  const session = readJson(path.join(p.sessions, `${sessionId}.json`), null);
  if (!session) return null;
  const jsonl = readText(path.join(p.sessions, `${sessionId}.jsonl`), '').trim();
  const observations = jsonl ? jsonl.split('\n').map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean) : [];
  return { session, observations };
}

async function requestHandler(req, res, expectedToken = '') {
  if (!requestAuthorized(req, expectedToken)) {
    return sendJson(res, 401, { error: 'unauthorized' }, { 'www-authenticate': 'Bearer realm="agent-kernel-daemon"' });
  }
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  if (req.method === 'GET' && (url.pathname === '/ak/health' || url.pathname === '/ak/status')) {
    return sendJson(res, 200, { ok: true, service: 'agent-kernel-daemon', version: VERSION, status: readDaemonStatus() });
  }
  if (req.method === 'GET' && url.pathname === '/ak/sessions') {
    return sendJson(res, 200, { sessions: listSessions() });
  }
  if (req.method === 'GET' && url.pathname.startsWith('/ak/sessions/')) {
    let sessionId;
    try { sessionId = decodeURIComponent(url.pathname.slice('/ak/sessions/'.length)); }
    catch { return sendJson(res, 400, { error: 'invalid sessionId' }); }
    if (!validSessionId(sessionId)) return sendJson(res, 400, { error: 'invalid sessionId' });
    const result = readSession(sessionId);
    return result ? sendJson(res, 200, result) : sendJson(res, 404, { error: 'session not found' });
  }
  if (req.method === 'POST' && url.pathname === '/ak/observe') {
    const body = await readRequestJson(req);
    if (body === REQUEST_BODY_TOO_LARGE) return sendJson(res, 413, { error: 'request body too large' });
    if (!body) return sendJson(res, 400, { error: 'invalid json body' });
    const parsed = observationFromBody(body);
    if (parsed.error) return sendJson(res, 400, { error: parsed.error });
    const p = runtimePaths();
    appendJsonl(path.join(p.sessions, `${parsed.observation.sessionId}.jsonl`), parsed.observation);
    const session = updateSessionForObservation(parsed.observation);
    return sendJson(res, 201, { ok: true, observation: parsed.observation, session });
  }
  if (req.method === 'POST' && url.pathname === '/ak/context') {
    const body = await readRequestJson(req);
    if (body === REQUEST_BODY_TOO_LARGE) return sendJson(res, 413, { error: 'request body too large' });
    if (!body) return sendJson(res, 400, { error: 'invalid json body' });
    return sendJson(res, 200, buildContext(body));
  }
  return sendJson(res, 404, { error: 'not found' });
}

function commandServe(flags) {
  const p = runtimePaths();
  const host = String(flags.host || process.env.AGENT_KERNEL_DAEMON_HOST || '127.0.0.1');
  const port = Number(flags.port ?? process.env.AGENT_KERNEL_DAEMON_PORT ?? 3999);
  const security = daemonSecurity(host);
  if (security.error) {
    process.stderr.write(`${security.error}\n`);
    process.exitCode = 1;
    return;
  }
  ensureDir(p.sessions);
  ensureDir(p.logs);
  const server = http.createServer((req, res) => {
    requestHandler(req, res, security.token).catch((err) => sendJson(res, 500, { error: err.message }));
  });
  server.listen(Number.isFinite(port) ? port : 3999, host, () => {
    const address = server.address();
    const actualPort = typeof address === 'object' && address ? address.port : port;
    writeJson(p.status, {
      pid: process.pid,
      host,
      port: actualPort,
      startedAt: nowIso(),
      version: VERSION,
      runtime: p.runtime,
      authentication: security.authentication
    });
  });
  const shutdown = () => {
    try { fs.rmSync(p.status, { force: true }); } catch {}
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 500).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

function commandStart(flags) {
  const current = readDaemonStatus();
  if (current.running) {
    process.stdout.write(`Agent Kernel daemon already running on ${current.host}:${current.port} (pid ${current.pid})\n`);
    return;
  }
  const host = String(flags.host || process.env.AGENT_KERNEL_DAEMON_HOST || '127.0.0.1');
  const security = daemonSecurity(host);
  if (security.error) {
    process.stderr.write(`${security.error}\n`);
    process.exitCode = 1;
    return;
  }
  const args = [selfPath, '_serve'];
  if (flags.host) args.push('--host', String(flags.host));
  if (flags.port !== undefined) args.push('--port', String(flags.port));
  const child = childProcess.spawn(process.execPath, args, {
    detached: true,
    stdio: 'ignore',
    env: process.env,
    cwd: process.cwd()
  });
  child.unref();
  for (let i = 0; i < 40; i++) {
    sleep(50);
    const next = readDaemonStatus();
    if (next.running) {
      process.stdout.write(`Started Agent Kernel daemon on ${next.host}:${next.port} (pid ${next.pid})\n`);
      return;
    }
  }
  process.stderr.write('Daemon process started but did not become ready. Run: agent-kernel-daemon status --json\n');
  process.exitCode = 1;
}

function commandStop() {
  const current = readDaemonStatus();
  if (!current.running) {
    try { fs.rmSync(runtimePaths().status, { force: true }); } catch {}
    process.stdout.write('Agent Kernel daemon is not running\n');
    return;
  }
  try { process.kill(Number(current.pid), 'SIGTERM'); } catch {}
  for (let i = 0; i < 20; i++) {
    sleep(50);
    if (!isPidAlive(current.pid)) break;
  }
  try { fs.rmSync(runtimePaths().status, { force: true }); } catch {}
  process.stdout.write(`Stopped Agent Kernel daemon pid ${current.pid}\n`);
}

function commandRestart(flags) {
  commandStop();
  sleep(100);
  commandStart(flags);
}

function commandStatus(flags) {
  const status = readDaemonStatus();
  if (flags.json) {
    process.stdout.write(JSON.stringify(status, null, 2) + '\n');
    return;
  }
  if (!status.running) {
    process.stdout.write('Agent Kernel daemon: stopped\n');
    process.stdout.write(`Status file: ${status.statusPath}\n`);
    return;
  }
  process.stdout.write('Agent Kernel daemon: running\n');
  process.stdout.write(`PID: ${status.pid}\n`);
  process.stdout.write(`URL: http://${status.host}:${status.port}\n`);
  process.stdout.write(`Runtime: ${status.runtime}\n`);
  process.stdout.write(`Started: ${status.startedAt}\n`);
  process.stdout.write(`Uptime: ${status.uptimeSeconds}s\n`);
  process.stdout.write(`Sessions: ${status.sessionCount}\n`);
  process.stdout.write(`Active sessions: ${status.activeSessions}\n`);
  process.stdout.write(`Last observation: ${status.lastObservationAt || 'none'}\n`);
  process.stdout.write(`Authentication: ${status.authentication || 'local-only'}\n`);
}

function usage() {
  process.stdout.write(`agent-kernel-daemon ${VERSION}\n\nUsage:\n  agent-kernel-daemon start [--host 127.0.0.1] [--port 3999]\n  agent-kernel-daemon stop\n  agent-kernel-daemon restart [--host 127.0.0.1] [--port 3999]\n  agent-kernel-daemon status [--json]\n\nThe daemon is optional and local-only by default. Remote binds require AGENT_KERNEL_DAEMON_ALLOW_REMOTE=1 and a 32-byte AGENT_KERNEL_DAEMON_TOKEN.\n`);
}

function main() {
  const argv = process.argv.slice(2);
  const command = argv[0];
  const flags = parseFlags(argv.slice(1));
  if (!command || command === 'help' || command === '--help' || command === '-h') return usage();
  if (command === 'start') return commandStart(flags);
  if (command === 'stop') return commandStop(flags);
  if (command === 'restart') return commandRestart(flags);
  if (command === 'status') return commandStatus(flags);
  if (command === '_serve') return commandServe(flags);
  process.stderr.write(`Unknown daemon command: ${command}\n`);
  usage();
  process.exitCode = 1;
}

main();
