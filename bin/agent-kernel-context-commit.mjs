#!/usr/bin/env node
import childProcess from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '1.20.1';
const SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const SAFE_PROPOSAL_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/u;
const FAILURE_TYPES = new Set(['tool_failure', 'command_failure', 'test_failure', 'guard_block']);
const LOCK_STALE_MS = 30 * 60 * 1000;
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

function kernelHome() {
  return process.env.AGENT_KERNEL_HOME || path.join(os.homedir(), '.agent-kernel');
}

function requireSafeSessionId(value) {
  const id = String(value || '').trim();
  if (!SESSION_ID_PATTERN.test(id) || id === '.' || id === '..') {
    throw new Error(`Invalid session ID: ${id || '(empty)'}`);
  }
  return id;
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

function readJson(filePath, fallback = null) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return fallback; }
}

function readJsonl(filePath) {
  let raw = '';
  try { raw = fs.readFileSync(filePath, 'utf8'); } catch { return []; }
  return raw.split(/\r?\n/u).filter((line) => line.trim()).map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
}

function arrayValue(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.records)) return value.records;
  return [];
}

function safeText(value) {
  let text = String(value ?? '');
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    text = text.replace(pattern, '[REDACTED_SECRET]');
  }
  return text;
}

function normalizeText(value) {
  return safeText(value).replace(/\s+/gu, ' ').trim();
}

function normalizedHash(value) {
  return crypto.createHash('sha256').update(normalizeText(value).toLowerCase()).digest('hex');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function sessionPaths(sessionId) {
  const sessions = path.join(kernelHome(), 'runtime', 'sessions');
  return {
    record: path.join(sessions, `${sessionId}.json`),
    log: path.join(sessions, `${sessionId}.jsonl`),
    commit: path.join(sessions, `${sessionId}.context-commit.json`),
    progress: path.join(sessions, `${sessionId}.context-commit.in-progress.json`),
    lock: path.join(sessions, `${sessionId}.context-commit.lock`)
  };
}

function memoryTexts() {
  const dir = path.join(kernelHome(), 'source', 'memories');
  if (!fs.existsSync(dir)) return [];
  const texts = [];
  for (const name of fs.readdirSync(dir).sort()) {
    if (!name.endsWith('.json')) continue;
    const value = readJson(path.join(dir, name), []);
    for (const item of arrayValue(value)) {
      if (!item || item.status !== 'approved') continue;
      const text = normalizeText(item.text || item.summary || item.title || '');
      if (text) texts.push(text);
    }
  }
  return texts;
}

function pendingProposals() {
  const dir = path.join(kernelHome(), 'inbox', 'pending');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).sort().filter((name) => name.endsWith('.json')).map((name) => {
    const item = readJson(path.join(dir, name), null);
    return item && typeof item === 'object' && item.status !== 'rejected' ? item : null;
  }).filter(Boolean);
}

function extractCandidates(session, observations) {
  const byHash = new Map();
  const contextUris = unique(observations
    .filter((observation) => observation.type === 'context_used')
    .map((observation) => normalizeText(observation.contextUri)));

  const add = (text, sourceType, observationId = null) => {
    const normalized = normalizeText(text);
    if (normalized.length < 16 || normalized.length > 2000) return;
    const hash = normalizedHash(normalized);
    const current = byHash.get(hash) || {
      id: `candidate_${hash.slice(0, 16)}`,
      hash,
      text: normalized,
      sourceTypes: [],
      sourceObservationIds: [],
      contextUris
    };
    current.sourceTypes = unique([...current.sourceTypes, sourceType]);
    current.sourceObservationIds = unique([...current.sourceObservationIds, observationId]);
    byHash.set(hash, current);
  };

  add(session.summary, 'session.summary');
  for (const observation of observations) {
    if (observation.type === 'session_summary') add(observation.text, 'session_summary', observation.id);
    else if (FAILURE_TYPES.has(observation.type)) add(observation.text, observation.type, observation.id);
  }
  return [...byHash.values()].sort((a, b) => a.hash.localeCompare(b.hash));
}

function deduplicate(candidates) {
  const approvedHashes = new Set(memoryTexts().map(normalizedHash));
  const pending = pendingProposals();
  const pendingByHash = new Map();
  for (const proposal of pending) {
    const text = normalizeText(proposal.text || proposal.summary || proposal.title || '');
    if (text) pendingByHash.set(normalizedHash(text), proposal);
  }

  const novel = [];
  const existing = [];
  for (const candidate of candidates) {
    if (approvedHashes.has(candidate.hash)) {
      existing.push({ candidate, state: 'approved' });
      continue;
    }
    const pendingProposal = pendingByHash.get(candidate.hash);
    if (pendingProposal) {
      existing.push({ candidate, state: 'pending', proposal: pendingProposal });
      continue;
    }
    novel.push(candidate);
  }
  return { novel, existing };
}

function coreCliPath() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..', 'dist', 'cli.mjs');
}

function createPendingProposal(candidate, session) {
  const cli = coreCliPath();
  if (!fs.existsSync(cli)) throw new Error(`Agent Kernel core CLI not found: ${cli}`);
  const reason = `Candidate extracted from session ${session.id}; requires explicit review before publication.`;
  const output = childProcess.execFileSync(process.execPath, [
    cli,
    'propose',
    '--from', 'contextfs-session-commit',
    '--type', 'project-note',
    '--scope', 'project',
    '--level', 'standard',
    '--targets', 'all',
    '--tags', 'contextfs,session-commit',
    '--text', candidate.text,
    '--reason', reason
  ], {
    cwd: session.cwd || process.cwd(),
    env: process.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30000,
    maxBuffer: 1024 * 1024
  });
  const proposalId = String(output).match(/Created pending memory proposal:\s*(\S+)/u)?.[1] || '';
  if (!SAFE_PROPOSAL_ID.test(proposalId)) throw new Error(`Core proposal command returned invalid proposal ID: ${proposalId || '(empty)'}`);
  const proposalPath = path.join(kernelHome(), 'inbox', 'pending', `${proposalId}.json`);
  const proposal = readJson(proposalPath, null);
  if (!proposal || proposal.id !== proposalId || proposal.status !== 'pending') {
    throw new Error(`Pending proposal ${proposalId} could not be verified after creation.`);
  }
  return proposal;
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', 'utf8');
    fs.renameSync(temporary, filePath);
  } finally {
    try { fs.rmSync(temporary, { force: true }); } catch {}
  }
}

function processAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

function lockIsStale(lockPath) {
  const lock = readJson(lockPath, null);
  const createdAt = Date.parse(lock?.createdAt || '');
  if (processAlive(Number(lock?.pid))) return false;
  if (Number.isFinite(createdAt) && Date.now() - createdAt < LOCK_STALE_MS) return false;
  return true;
}

function acquireCommitLock(paths, sessionId) {
  fs.mkdirSync(path.dirname(paths.lock), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt++) {
    let handle;
    try {
      handle = fs.openSync(paths.lock, 'wx', 0o600);
      fs.writeFileSync(handle, JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }) + '\n', 'utf8');
      fs.closeSync(handle);
      return;
    } catch (error) {
      if (handle !== undefined) {
        try { fs.closeSync(handle); } catch {}
      }
      if (error?.code !== 'EEXIST') throw error;
      if (attempt === 0 && lockIsStale(paths.lock)) {
        fs.rmSync(paths.lock, { force: true });
        continue;
      }
      throw new Error(`Context commit already in progress for ${sessionId}`);
    }
  }
}

function releaseCommitLock(paths) {
  try { fs.rmSync(paths.lock, { force: true }); } catch {}
}

function proposalById(proposalId) {
  if (!SAFE_PROPOSAL_ID.test(String(proposalId || ''))) return null;
  const proposal = readJson(path.join(kernelHome(), 'inbox', 'pending', `${proposalId}.json`), null);
  return proposal?.id === proposalId && proposal.status === 'pending' ? proposal : null;
}

function uniqueProposals(values) {
  const byId = new Map();
  for (const proposal of values.filter(Boolean)) {
    if (SAFE_PROPOSAL_ID.test(String(proposal.id || '')) && proposal.status === 'pending') byId.set(proposal.id, proposal);
  }
  return [...byId.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

function outputJson(value) {
  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}

function main() {
  const flags = parseFlags(process.argv.slice(2));
  const sessionId = requireSafeSessionId(flags._[0] || flags.session || flags.sessionId);
  const dryRun = Boolean(flags['dry-run'] || flags.dryRun);
  const paths = sessionPaths(sessionId);
  const session = readJson(paths.record, null);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  const buildState = () => {
    const observations = readJsonl(paths.log);
    const candidates = extractCandidates(session, observations);
    const { novel, existing } = deduplicate(candidates);
    const diff = { adds: novel, updates: [], deletes: [] };
    const provenance = {
      sessionId,
      projectId: session.projectId || null,
      agentId: session.agentId || null,
      observationIds: observations.map((observation) => observation.id).filter(Boolean),
      contextUris: unique(observations.map((observation) => observation.contextUri).filter(Boolean))
    };
    return { observations, novel, existing, diff, provenance };
  };

  if (dryRun) {
    const { novel, existing, diff, provenance } = buildState();
    const result = {
      version: VERSION,
      sessionId,
      dryRun: true,
      idempotent: false,
      diff,
      existing: existing.map(({ candidate, state, proposal }) => ({ candidate, state, proposalId: proposal?.id || null })),
      proposals: [],
      provenance
    };
    if (flags.json) outputJson(result);
    else process.stdout.write(`Context commit dry-run: ${novel.length} novel candidate(s)\n`);
    return;
  }

  acquireCommitLock(paths, sessionId);
  try {
    if (fs.existsSync(paths.commit)) {
      const committed = readJson(paths.commit, null);
      if (!committed || committed.sessionId !== sessionId) throw new Error(`Context commit metadata is invalid for session ${sessionId}`);
      const repeated = { ...committed, dryRun: false, idempotent: true };
      if (flags.json) outputJson(repeated);
      else process.stdout.write(`Context commit already exists for ${sessionId}\n`);
      return;
    }

    const { novel, existing, diff, provenance } = buildState();
    const progress = readJson(paths.progress, { version: VERSION, sessionId, proposals: [] });
    const recoveredFromProgress = Array.isArray(progress?.proposals)
      ? progress.proposals.map((entry) => proposalById(entry?.proposalId)).filter(Boolean)
      : [];
    const recoveredFromPending = existing
      .filter((entry) => entry.state === 'pending')
      .map((entry) => entry.proposal)
      .filter(Boolean);
    const proposals = uniqueProposals([...recoveredFromProgress, ...recoveredFromPending]);
    const knownCandidateHashes = new Set([
      ...existing.filter((entry) => entry.state === 'pending').map((entry) => entry.candidate.hash),
      ...(Array.isArray(progress?.proposals) ? progress.proposals.map((entry) => entry?.candidateHash).filter(Boolean) : [])
    ]);

    for (const candidate of novel) {
      if (knownCandidateHashes.has(candidate.hash)) continue;
      const proposal = createPendingProposal(candidate, session);
      proposals.push(proposal);
      knownCandidateHashes.add(candidate.hash);
      const nextProgress = {
        version: VERSION,
        sessionId,
        updatedAt: new Date().toISOString(),
        proposals: unique([
          ...(Array.isArray(progress?.proposals) ? progress.proposals : []).map((entry) => JSON.stringify(entry)),
          JSON.stringify({ candidateHash: candidate.hash, proposalId: proposal.id })
        ]).map((entry) => JSON.parse(entry))
      };
      progress.proposals = nextProgress.proposals;
      writeJsonAtomic(paths.progress, nextProgress);
    }

    const finalProposals = uniqueProposals(proposals);
    const metadata = {
      version: VERSION,
      sessionId,
      dryRun: false,
      idempotent: false,
      createdAt: new Date().toISOString(),
      diff,
      existing: existing.map(({ candidate, state, proposal }) => ({ candidate, state, proposalId: proposal?.id || null })),
      proposals: finalProposals,
      provenance
    };
    writeJsonAtomic(paths.commit, metadata);
    fs.rmSync(paths.progress, { force: true });
    if (flags.json) outputJson(metadata);
    else process.stdout.write(`Committed session context candidates: ${finalProposals.length} pending proposal(s)\n`);
  } finally {
    releaseCommitLock(paths);
  }
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error?.message || error}\n`);
  process.exitCode = 1;
}
