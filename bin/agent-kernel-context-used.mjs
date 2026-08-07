#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const VERSION = '1.20.1';
const SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
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

function kernelHome() {
  return process.env.AGENT_KERNEL_HOME || path.join(os.homedir(), '.agent-kernel');
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

function safeText(value) {
  let text = String(value ?? '');
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    text = text.replace(pattern, '[REDACTED_SECRET]');
  }
  return text;
}

function requireSafeSessionId(value) {
  const id = String(value || '').trim();
  if (!SESSION_ID_PATTERN.test(id) || id === '.' || id === '..') {
    throw new Error(`Invalid session ID: ${id || '(empty)'}`);
  }
  return id;
}

function invalidContextUri(value, reason) {
  throw new Error(`Invalid ContextFS URI: ${String(value || '(empty)')}${reason ? ` (${reason})` : ''}`);
}

function canonicalContextUri(value) {
  const raw = String(value || '').trim();
  if (!raw.startsWith('ak://')) invalidContextUri(raw, 'scheme must be ak://');
  if (raw.includes('\\') || raw.includes('\0') || raw.includes('?') || raw.includes('#') || raw.includes('@')) {
    invalidContextUri(raw, 'unsafe URI syntax');
  }
  const remainder = raw.slice(5);
  if (!remainder) return 'ak://';
  const trailing = remainder.endsWith('/');
  const body = trailing ? remainder.slice(0, -1) : remainder;
  if (!body) return 'ak://';
  const segments = body.split('/').map((segment) => {
    if (!segment) invalidContextUri(raw, 'empty path segment');
    let decoded;
    try { decoded = decodeURIComponent(segment); } catch { invalidContextUri(raw, 'malformed percent encoding'); }
    if (!decoded || decoded === '.' || decoded === '..') invalidContextUri(raw, 'dot segments are not allowed');
    if (decoded.includes('/') || decoded.includes('\\') || decoded.includes('\0')) invalidContextUri(raw, 'path separators are not allowed inside segments');
    if (/[\u0000-\u001f\u007f]/u.test(decoded)) invalidContextUri(raw, 'control characters are not allowed');
    return encodeURIComponent(decoded);
  });
  return `ak://${segments.join('/')}${trailing ? '/' : ''}`;
}

function sessionPaths(id) {
  const sessions = path.join(kernelHome(), 'runtime', 'sessions');
  return {
    record: path.join(sessions, `${id}.json`),
    log: path.join(sessions, `${id}.jsonl`)
  };
}

function readJson(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return null; }
}

function observationCount(logPath) {
  try {
    return fs.readFileSync(logPath, 'utf8').split(/\r?\n/u).filter((line) => line.trim()).length;
  } catch {
    return 0;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function printJson(value) {
  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}

function main() {
  const flags = parseFlags(process.argv.slice(2));
  const sessionId = requireSafeSessionId(flags._[0] || flags.session || flags.sessionId);
  const contextUri = canonicalContextUri(flags._[1] || flags.context || flags.uri);
  if (contextUri.endsWith('/')) throw new Error(`ContextFS used expects a record URI, received directory: ${contextUri}`);

  const paths = sessionPaths(sessionId);
  const session = readJson(paths.record);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  const timestamp = new Date().toISOString();
  const observation = {
    id: `obs_${crypto.randomBytes(8).toString('hex')}`,
    sessionId,
    timestamp,
    agentId: String(session.agentId || 'unknown-agent'),
    type: 'context_used',
    projectId: String(session.projectId || 'project'),
    cwd: String(session.cwd || process.cwd()),
    files: [],
    command: '',
    exitCode: null,
    text: `Used context ${contextUri}`,
    contextUri,
    metadata: {
      reason: safeText(flags.reason || ''),
      result: safeText(flags.result || '')
    }
  };

  fs.appendFileSync(paths.log, JSON.stringify(observation) + '\n', 'utf8');
  const next = {
    ...session,
    updatedAt: timestamp,
    observationCount: observationCount(paths.log)
  };
  writeJson(paths.record, next);

  const output = { version: VERSION, observation, session: next };
  if (flags.json) printJson(output);
  else process.stdout.write(`Recorded ContextFS usage ${observation.id}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error?.message || error}\n`);
  process.exitCode = 1;
}