#!/usr/bin/env node
import childProcess from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const VERSION = String(pkg.version || '0.0.0');
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;
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
const ALLOWED_FLAGS = new Set(['out', 'project', 'open', 'no-open', 'json', 'help']);

function kernelHome() {
  return process.env.AGENT_KERNEL_HOME || path.join(os.homedir(), '.agent-kernel');
}

function paths() {
  const home = kernelHome();
  return {
    home,
    config: path.join(home, 'config.json'),
    memories: path.join(home, 'source', 'memories'),
    policies: path.join(home, 'source', 'policies', 'policies.json'),
    failures: path.join(home, 'source', 'failures', 'failure-lessons.json'),
    agents: path.join(home, 'source', 'agents', 'agents.json'),
    projects: path.join(home, 'source', 'projects', 'projects.json'),
    pending: path.join(home, 'inbox', 'pending'),
    approved: path.join(home, 'inbox', 'approved'),
    rejected: path.join(home, 'inbox', 'rejected'),
    episodes: path.join(home, 'episodes', 'archive'),
    sessions: path.join(home, 'runtime', 'sessions'),
    commits: path.join(home, 'runtime', 'commits', 'index.json'),
    updateCache: path.join(home, 'runtime', 'update-status.json'),
    reports: path.join(home, 'reports'),
    audit: path.join(home, 'logs', 'audit.jsonl')
  };
}

function nowIso() {
  return new Date().toISOString();
}

function exists(filePath) {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function parseFlags(argv) {
  const flags = { _: [] };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg.startsWith('--')) {
      flags._.push(arg);
      continue;
    }
    const raw = arg.slice(2);
    const equals = raw.indexOf('=');
    const name = equals >= 0 ? raw.slice(0, equals) : raw;
    if (!ALLOWED_FLAGS.has(name)) throw new Error(`Unknown dashboard flag: --${name}`);
    if (Object.hasOwn(flags, name)) throw new Error(`Duplicate flag: --${name}`);
    if (equals >= 0) {
      flags[name] = raw.slice(equals + 1);
      continue;
    }
    const next = argv[index + 1];
    if (['out', 'project'].includes(name)) {
      if (!next || next.startsWith('--')) throw new Error(`Flag --${name} requires a value.`);
      flags[name] = next;
      index++;
    } else {
      flags[name] = true;
    }
  }
  if (flags._.length) throw new Error(`Unexpected dashboard argument: ${flags._[0]}`);
  return flags;
}

function enabled(value) {
  return value === true || String(value || '').toLowerCase() === 'true' || value === '1';
}

function redactText(value) {
  let text = String(value ?? '');
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    text = text.replace(pattern, '[REDACTED_SECRET]');
  }
  return text;
}

function redactLocalPaths(value, projectPath = '') {
  let text = String(value ?? '');
  const replacements = [
    [kernelHome(), '[AGENT_KERNEL_HOME]'],
    [projectPath, '[PROJECT]'],
    [process.env.HOME || '', '~'],
    [process.env.USERPROFILE || '', '~']
  ].filter(([candidate]) => candidate && candidate.length > 1)
    .sort((left, right) => right[0].length - left[0].length);
  for (const [candidate, replacement] of replacements) text = text.split(candidate).join(replacement);
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

function diagnostics() {
  return { skippedMalformed: 0, messages: [] };
}

function readJsonDiagnostic(filePath, fallback, state, label) {
  if (!exists(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    state.skippedMalformed++;
    state.messages.push(`Skipped malformed ${label}`);
    return fallback;
  }
}

function readJsonDirectory(dir, state, label) {
  if (!exists(dir)) return [];
  const records = [];
  for (const name of fs.readdirSync(dir).sort()) {
    if (!name.endsWith('.json')) continue;
    const value = readJsonDiagnostic(path.join(dir, name), null, state, label);
    if (value !== null) records.push(value);
  }
  return records;
}

function asArray(value, keys = []) {
  if (Array.isArray(value)) return value;
  for (const key of keys) if (Array.isArray(value?.[key])) return value[key];
  if (value && typeof value === 'object') return Object.values(value);
  return [];
}

function textValue(item) {
  return String(item.text || item.summary || item.title || item.description || item.task || item.errorSignature || item.subject || item.name || '');
}

function baseRecord(value, fallbackType = 'record') {
  const item = sanitize(value || {});
  return {
    id: String(item.id || item.agentId || item.projectId || item.shortSha || item.sha || item.name || ''),
    type: String(item.type || fallbackType),
    status: String(item.status || item.mode || ''),
    scope: String(item.scope || ''),
    level: String(item.level || item.trustLevel || ''),
    text: textValue(item),
    reason: String(item.reason || item.rootCause || ''),
    targets: Array.isArray(item.targets) ? item.targets.map(String) : [],
    tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
    agentId: String(item.source?.proposedBy || item.source?.agentId || item.agentId || item.createdBy || ''),
    createdAt: String(item.createdAt || item.startedAt || item.timestamp || ''),
    updatedAt: String(item.updatedAt || item.checkedAt || item.generatedAt || ''),
    validActionId: SAFE_ID.test(String(item.id || '')),
    details: {}
  };
}

function proposalRecord(value, status) {
  const record = baseRecord({ ...value, status: value?.status || status }, 'proposal');
  record.validActionId = SAFE_ID.test(record.id);
  return record;
}

function memoryRecords(state) {
  if (!exists(paths().memories)) return [];
  const records = [];
  for (const name of fs.readdirSync(paths().memories).sort()) {
    if (!name.endsWith('.json')) continue;
    const bucket = name.slice(0, -5);
    const values = readJsonDiagnostic(path.join(paths().memories, name), [], state, 'memory file');
    if (!Array.isArray(values)) continue;
    for (const value of values) {
      const record = baseRecord(value, 'memory');
      record.bucket = bucket;
      records.push(record);
    }
  }
  return records;
}

function policyRecords(state) {
  return asArray(readJsonDiagnostic(paths().policies, [], state, 'policy file'), ['policies'])
    .map((value) => {
      const record = baseRecord(value, 'policy');
      record.text = String(value?.title || value?.description || value?.text || value?.id || 'Policy');
      record.details = { mode: value?.mode, owner: value?.owner };
      return record;
    });
}

function episodeRecords(state) {
  return readJsonDirectory(paths().episodes, state, 'episode file').map((value) => {
    const record = baseRecord(value, 'episode');
    record.text = String(value?.summary || value?.title || value?.text || value?.id || 'Episode');
    return record;
  });
}

function failureRecords(state) {
  return asArray(readJsonDiagnostic(paths().failures, [], state, 'failure file'), ['failures', 'lessons'])
    .map((value) => {
      const record = baseRecord(value, 'failure-lesson');
      record.text = String(value?.errorSignature || value?.title || value?.summary || value?.id || 'Failure Lesson');
      record.reason = String(value?.rootCause || value?.reason || '');
      record.details = { fix: value?.fix, occurrences: value?.occurrences };
      return record;
    });
}

function sessionRecords(state) {
  return readJsonDirectory(paths().sessions, state, 'session file')
    .filter((value) => value && (value.id || value.sessionId))
    .map((value) => {
      const record = baseRecord(value, 'session');
      record.id = String(value.id || value.sessionId || '');
      record.text = String(value.summary || value.task || value.status || 'Session');
      record.details = { projectId: value.projectId, observationCount: value.observationCount, endedAt: value.endedAt };
      return record;
    });
}

function registryRecords(filePath, key, type, state) {
  return asArray(readJsonDiagnostic(filePath, [], state, `${type} registry`), [key])
    .map((value) => {
      const record = baseRecord(value, type);
      record.text = String(value?.name || value?.description || value?.surface || record.id || type);
      record.details = type === 'agent'
        ? { trustLevel: value?.trustLevel, surface: value?.surface }
        : { status: value?.status, defaultBranch: value?.defaultBranch };
      return record;
    });
}

function commitRecords(state) {
  const data = readJsonDiagnostic(paths().commits, {}, state, 'commit index');
  const commits = data?.commits && typeof data.commits === 'object' ? Object.values(data.commits) : asArray(data, ['items']);
  return commits.map((value) => {
    const record = baseRecord(value, 'commit');
    record.id = String(value.shortSha || value.sha || value.id || '');
    record.text = String(value.subject || value.summary || record.id || 'Commit');
    record.details = { sessionCount: Array.isArray(value.sessions) ? value.sessions.length : 0 };
    return record;
  });
}

function updaterRecords(state) {
  const config = readJsonDiagnostic(paths().config, {}, state, 'config file');
  const cache = readJsonDiagnostic(paths().updateCache, null, state, 'update cache');
  if (!config?.updates && !cache) return [];
  const value = {
    id: 'update-status',
    type: 'updater',
    status: cache?.updateAvailable ? 'available' : config?.updates?.mode || 'disabled',
    text: cache?.updateAvailable
      ? `Update ${cache.currentVersion || VERSION} to ${cache.targetVersion || 'unknown'}`
      : `Channel ${config?.updates?.channel || cache?.channel || 'latest'}`,
    updatedAt: cache?.checkedAt || '',
    details: {
      mode: config?.updates?.mode || 'disabled',
      channel: config?.updates?.channel || cache?.channel || 'latest',
      currentVersion: cache?.currentVersion || VERSION,
      targetVersion: cache?.targetVersion || '',
      updateAvailable: Boolean(cache?.updateAvailable),
      error: cache?.error || ''
    }
  };
  return [value];
}

function retentionRecords() {
  let rawLogs = 0;
  let rawBytes = 0;
  if (exists(paths().sessions)) {
    for (const name of fs.readdirSync(paths().sessions)) {
      if (!name.endsWith('.jsonl')) continue;
      rawLogs++;
      try {
        rawBytes += fs.statSync(path.join(paths().sessions, name)).size;
      } catch {}
    }
  }
  return [{
    id: 'retention-status',
    type: 'retention',
    status: rawLogs ? 'observed' : 'clean',
    text: `${rawLogs} raw session log${rawLogs === 1 ? '' : 's'}`,
    details: { rawLogs, rawBytes }
  }];
}

function auditRecords(state) {
  if (!exists(paths().audit)) return [];
  const rows = [];
  for (const line of fs.readFileSync(paths().audit, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    let value;
    try {
      value = JSON.parse(line);
    } catch {
      state.skippedMalformed++;
      state.messages.push('Skipped malformed audit record');
      continue;
    }
    const item = sanitize(value);
    rows.push({
      id: String(item.id || `${item.operation || 'audit'}-${rows.length + 1}`),
      type: 'audit',
      status: String(item.outcome || ''),
      text: String(item.summary || item.operation || 'Audit event'),
      createdAt: String(item.timestamp || item.at || ''),
      agentId: String(item.actor || item.agent || ''),
      details: { operation: item.operation || item.action, targetType: item.targetType }
    });
  }
  return rows.slice(-50).reverse();
}

function architectureRecords(projectPath, state) {
  if (!projectPath) return [];
  const resolved = path.resolve(projectPath);
  if (!exists(resolved) || !fs.statSync(resolved).isDirectory()) throw new Error(`Dashboard project does not exist or is not a directory: ${resolved}`);
  const dir = path.join(resolved, '.agent-kernel', 'architecture');
  if (!exists(dir)) return [];
  const policy = readJsonDiagnostic(path.join(dir, 'policy.json'), {}, state, 'architecture policy');
  const map = readJsonDiagnostic(path.join(dir, 'map.json'), {}, state, 'architecture map');
  const contract = readJsonDiagnostic(path.join(dir, 'contract.json'), {}, state, 'architecture contract');
  const exceptions = readJsonDiagnostic(path.join(dir, 'exceptions.json'), {}, state, 'architecture exceptions');
  const report = readJsonDiagnostic(path.join(dir, 'reports', 'latest.json'), {}, state, 'architecture report');
  const activeExceptions = asArray(exceptions, ['exceptions']).filter((item) => {
    if (item?.status && item.status !== 'active') return false;
    const expiresAt = Date.parse(item?.expiresAt || '');
    return !Number.isFinite(expiresAt) || expiresAt > Date.now();
  }).length;
  return [{
    id: String(contract?.id || path.basename(resolved) || 'architecture'),
    type: 'architecture',
    status: String(report?.ok === false ? 'findings' : contract?.status || policy?.mode || 'review'),
    text: String(contract?.task || `Architecture summary for ${path.basename(resolved)}`),
    details: {
      project: path.basename(resolved),
      mode: policy?.mode || '',
      sourceRootCount: Array.isArray(policy?.sourceRoots) ? policy.sourceRoots.length : 0,
      layerCount: Array.isArray(policy?.layers) ? policy.layers.length : 0,
      nodeCount: Array.isArray(map?.nodes) ? map.nodes.length : 0,
      edgeCount: Array.isArray(map?.edges) ? map.edges.length : 0,
      contractOwner: contract?.owner || '',
      activeExceptions,
      blocking: report?.summary?.blocking ?? '',
      warnings: report?.summary?.warning ?? '',
      generatedAt: report?.generatedAt || map?.generatedAt || ''
    }
  }];
}

function addSection(sections, id, title, records, kind = 'record') {
  if (records.length) sections.push({ id, title, records, kind });
}

function snapshot(projectPath) {
  const state = diagnostics();
  const pending = readJsonDirectory(paths().pending, state, 'pending proposal').map((value) => proposalRecord(value, 'pending'));
  const approved = readJsonDirectory(paths().approved, state, 'approved proposal').map((value) => proposalRecord(value, 'approved'));
  const rejected = readJsonDirectory(paths().rejected, state, 'rejected proposal').map((value) => proposalRecord(value, 'rejected'));
  const memories = memoryRecords(state);
  const rules = memories.filter((item) => item.type === 'rule');
  const skillTriggers = memories.filter((item) => item.type === 'skill-trigger');
  const policies = policyRecords(state);
  const episodes = episodeRecords(state);
  const failures = failureRecords(state);
  const sessions = sessionRecords(state);
  const agents = registryRecords(paths().agents, 'agents', 'agent', state);
  const projects = registryRecords(paths().projects, 'projects', 'project', state);
  const commits = commitRecords(state);
  const architecture = architectureRecords(projectPath, state);
  const updater = updaterRecords(state);
  const retention = retentionRecords();
  const audit = auditRecords(state);
  const sections = [];
  addSection(sections, 'pending', 'Pending review', pending, 'pending');
  addSection(sections, 'approved', 'Approved proposals', approved, 'proposal');
  addSection(sections, 'rejected', 'Rejected proposals', rejected, 'proposal');
  addSection(sections, 'memories', 'Durable memories', memories, 'memory');
  addSection(sections, 'rules', 'Rules', rules, 'memory');
  addSection(sections, 'skills', 'Skill triggers', skillTriggers, 'memory');
  addSection(sections, 'policies', 'Policies', policies, 'policy');
  addSection(sections, 'episodes', 'Episodes', episodes, 'episode');
  addSection(sections, 'failures', 'Failure Lessons', failures, 'failure');
  addSection(sections, 'sessions', 'Sessions', sessions, 'session');
  addSection(sections, 'agents', 'Agents', agents, 'agent');
  addSection(sections, 'projects', 'Projects', projects, 'project');
  addSection(sections, 'commits', 'Commit links', commits, 'commit');
  addSection(sections, 'architecture', 'Architecture Guardian', architecture, 'architecture');
  addSection(sections, 'updates', 'Update status', updater, 'updater');
  addSection(sections, 'retention', 'Retention', retention, 'retention');
  addSection(sections, 'audit', 'Audit summary', audit, 'audit');
  return sanitize({
    generatedAt: nowIso(),
    kernelVersion: VERSION,
    homeLabel: process.env.AGENT_KERNEL_HOME ? 'AGENT_KERNEL_HOME' : '~/.agent-kernel',
    projectName: projectPath ? path.basename(path.resolve(projectPath)) : '',
    diagnostics: state,
    metrics: {
      pending: pending.length,
      approved: approved.length,
      memories: memories.length,
      episodes: episodes.length,
      failures: failures.length,
      sessions: sessions.length
    },
    sections
  });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

function displayValue(value) {
  if (Array.isArray(value)) return value.join(', ');
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value ?? '');
}

function metadata(record) {
  const standard = {
    ID: record.id,
    Type: record.type,
    Status: record.status,
    Scope: record.scope,
    Level: record.level,
    Agent: record.agentId,
    Targets: record.targets,
    Tags: record.tags,
    Created: record.createdAt,
    Updated: record.updatedAt,
    Bucket: record.bucket
  };
  const entries = [...Object.entries(standard), ...Object.entries(record.details || {}).map(([key, value]) => [key, value])]
    .filter(([, value]) => value !== undefined && value !== null && displayValue(value).length > 0);
  return `<dl>${entries.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(displayValue(value))}</dd></div>`).join('')}</dl>`;
}

function pendingActions(record) {
  if (!record.validActionId) return '<p class="invalid">Invalid action ID</p>';
  const controls = [
    ['Copy ID', record.id],
    ['Open inbox', 'agent-kernel inbox'],
    ['Approve + publish', `agent-kernel approve ${record.id} --publish`],
    ['Reject', `agent-kernel reject ${record.id}`]
  ];
  return `<div class="actions">${controls.map(([label, command]) => `<button type="button" data-copy="${escapeHtml(command)}">${escapeHtml(label)}</button>`).join('')}</div>`;
}

function recordCard(record, kind) {
  const searchable = [record.id, record.type, record.status, record.scope, record.level, record.text, record.reason, record.agentId, ...(record.tags || []), ...(record.targets || []), ...Object.values(record.details || {})].filter(Boolean).map(displayValue).join(' ');
  return `<article class="record" data-search="${escapeHtml(searchable.toLowerCase())}">
    <div class="record-head"><span class="pill">${escapeHtml(record.status || record.type || kind)}</span><code>${escapeHtml(record.id || record.type || 'record')}</code></div>
    ${record.text ? `<p>${escapeHtml(record.text)}</p>` : ''}
    ${record.reason ? `<p class="muted">${escapeHtml(record.reason)}</p>` : ''}
    <details><summary>Metadata</summary>${metadata(record)}</details>
    ${kind === 'pending' ? pendingActions(record) : ''}
  </article>`;
}

function renderDashboard(data) {
  const navigation = data.sections.map((section) => `<a href="#${escapeHtml(section.id)}">${escapeHtml(section.title)} <span>${section.records.length}</span></a>`).join('');
  const sections = data.sections.map((section) => `<section id="${escapeHtml(section.id)}"><div class="section-title"><h2>${escapeHtml(section.title)}</h2><span>${section.records.length}</span></div><div class="records">${section.records.map((record) => recordCard(record, section.kind)).join('')}</div></section>`).join('');
  const metrics = Object.entries(data.metrics).map(([name, value]) => `<div class="metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(name)}</span></div>`).join('');
  const diagnostic = data.diagnostics.skippedMalformed
    ? `<div class="diagnostic">Skipped malformed local records: ${escapeHtml(data.diagnostics.skippedMalformed)}</div>`
    : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Agent Kernel Memory Dashboard</title><style>
:root{color-scheme:dark;--bg:#050505;--panel:#0B0B0B;--border:#2A2A2A;--text:#F4F4F1;--muted:#8E8E88;--accent:#F8F46A}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--text);font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:14px;line-height:1.55}header{position:sticky;top:0;z-index:5;background:rgba(5,5,5,.96);border-bottom:1px solid var(--border)}.top{max-width:1440px;margin:auto;padding:18px 28px;display:flex;gap:18px;align-items:center;justify-content:space-between}.brand h1{font-size:18px;margin:0}.brand p{margin:3px 0 0;color:var(--muted);font-size:12px}.search{width:min(420px,45vw);background:var(--panel);border:1px solid var(--border);color:var(--text);padding:10px 12px;border-radius:8px}main{max-width:1440px;margin:auto;padding:28px;display:grid;grid-template-columns:220px minmax(0,1fr);gap:24px}aside{position:sticky;top:100px;align-self:start;border:1px solid var(--border);background:var(--panel);padding:10px;border-radius:10px}aside a{display:flex;justify-content:space-between;color:var(--muted);text-decoration:none;padding:9px;border-radius:6px}aside a:hover{background:#151515;color:var(--text)}.content{min-width:0}.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:16px}.metric,section,.record,.diagnostic{border:1px solid var(--border);background:var(--panel);border-radius:10px}.metric{padding:16px}.metric strong{display:block;font-size:26px;color:var(--accent)}.metric span{color:var(--muted);text-transform:capitalize}.diagnostic{padding:12px 16px;margin-bottom:18px;color:#ffd18a}.section-title{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid var(--border)}h2{font-size:16px;margin:0}.records{padding:14px;display:grid;gap:12px}.record{padding:16px;background:#090909}.record-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.pill{border:1px solid var(--border);border-radius:999px;padding:3px 8px;color:var(--accent);font-size:11px}.muted,summary,dt{color:var(--muted)}details{margin-top:12px}dl{display:grid;gap:6px;margin:10px 0 0}dl div{display:grid;grid-template-columns:130px 1fr;gap:10px}dt,dd{margin:0;overflow-wrap:anywhere}.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}button{appearance:none;border:1px solid var(--accent);background:transparent;color:var(--accent);padding:8px 10px;border-radius:6px;font:inherit;cursor:pointer}button:hover,button.copied{background:var(--accent);color:#050505}.invalid{color:#ff9c9c}.empty-search{display:none;color:var(--muted);padding:20px;text-align:center}.hidden{display:none!important}footer{color:var(--muted);font-size:12px;margin-top:22px;padding:16px 0;border-top:1px solid var(--border)}section+section{margin-top:18px}@media(max-width:820px){.top{align-items:flex-start;flex-direction:column}.search{width:100%}main{grid-template-columns:1fr;padding:18px}aside{position:static;display:flex;overflow:auto}aside a{white-space:nowrap;gap:8px}.record-head{align-items:flex-start;flex-direction:column}}
</style></head><body>
<header><div class="top"><div class="brand"><h1>Agent Kernel Memory Dashboard</h1><p>Read-only local snapshot · Kernel ${escapeHtml(data.kernelVersion)} · ${escapeHtml(data.homeLabel)}${data.projectName ? ` · ${escapeHtml(data.projectName)}` : ''} · ${escapeHtml(data.generatedAt)}</p></div><input id="dashboard-search" class="search" type="search" placeholder="Filter records" autocomplete="off"></div></header>
<main><aside aria-label="Dashboard sections">${navigation || '<span class="muted">No stored sections</span>'}</aside><div class="content"><div class="metrics">${metrics}</div>${diagnostic}${sections}<p id="empty-search" class="empty-search">No matching records.</p><footer>Static local file. No external assets or network requests. Copy buttons never execute commands.</footer></div></main>
<script>
(function(){
  const search=document.getElementById('dashboard-search');
  const records=[...document.querySelectorAll('.record')];
  const empty=document.getElementById('empty-search');
  search.addEventListener('input',function(){const query=search.value.trim().toLowerCase();let visible=0;for(const record of records){const show=!query||record.dataset.search.includes(query);record.classList.toggle('hidden',!show);if(show)visible++;}empty.style.display=records.length&&visible===0?'block':'none';});
  async function copyText(text){if(navigator.clipboard&&navigator.clipboard.writeText){await navigator.clipboard.writeText(text);return;}const area=document.createElement('textarea');area.value=text;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();document.execCommand('copy');area.remove();}
  document.addEventListener('click',async function(event){const button=event.target.closest('[data-copy]');if(!button)return;const original=button.textContent;try{await copyText(button.dataset.copy);button.textContent='Copied';button.classList.add('copied');}catch{button.textContent='Copy failed';}setTimeout(function(){button.textContent=original;button.classList.remove('copied');},1200);});
})();
</script></body></html>`;
}

function ensureSafeTarget(target) {
  const resolved = path.resolve(target);
  if (exists(resolved)) {
    const stat = fs.lstatSync(resolved);
    if (stat.isSymbolicLink()) throw new Error(`Dashboard output cannot be a symbolic link: ${resolved}`);
    if (!stat.isFile()) throw new Error(`Dashboard output must be a regular file: ${resolved}`);
  }
  let current = path.dirname(resolved);
  const missing = [];
  while (!exists(current)) {
    missing.push(current);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  while (current && current !== path.dirname(current)) {
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error(`Dashboard output parent cannot be symbolic: ${current}`);
    current = path.dirname(current);
  }
  for (const dir of missing.reverse()) fs.mkdirSync(dir);
  return resolved;
}

function writeAtomic(target, content) {
  const temporary = `${target}.tmp-${process.pid}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  try {
    fs.writeFileSync(temporary, content, 'utf8');
    fs.renameSync(temporary, target);
  } catch (error) {
    try { fs.rmSync(temporary, { force: true }); } catch {}
    throw error;
  }
}

function browserPrefix() {
  if (!process.env.AGENT_KERNEL_BROWSER_ARGS_JSON) return [];
  let parsed;
  try {
    parsed = JSON.parse(process.env.AGENT_KERNEL_BROWSER_ARGS_JSON);
  } catch {
    throw new Error('AGENT_KERNEL_BROWSER_ARGS_JSON must contain a JSON array.');
  }
  if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== 'string' || value.length > 1000)) {
    throw new Error('AGENT_KERNEL_BROWSER_ARGS_JSON must contain a bounded string array.');
  }
  return parsed;
}

function browserInvocation(filePath) {
  if (process.env.AGENT_KERNEL_BROWSER_BIN) return { command: process.env.AGENT_KERNEL_BROWSER_BIN, args: [...browserPrefix(), filePath], label: 'configured' };
  if (process.platform === 'darwin') return { command: 'open', args: [filePath], label: 'open' };
  if (process.platform === 'win32') return { command: 'rundll32.exe', args: ['url.dll,FileProtocolHandler', pathToFileURL(filePath).href], label: 'rundll32' };
  return { command: 'xdg-open', args: [filePath], label: 'xdg-open' };
}

function openDashboard(filePath) {
  const invocation = browserInvocation(filePath);
  const result = childProcess.spawnSync(invocation.command, invocation.args, { cwd: process.cwd(), env: process.env, shell: false, stdio: 'ignore', timeout: 5000 });
  if (result.error) {
    const category = result.error.code === 'ENOENT' ? 'browser-not-found' : result.error.code === 'ETIMEDOUT' ? 'browser-timeout' : 'browser-error';
    return { opened: false, browser: invocation.label, error: category };
  }
  if (result.status !== 0) return { opened: false, browser: invocation.label, error: 'browser-exit' };
  return { opened: true, browser: invocation.label, error: null };
}

function audit(result) {
  fs.mkdirSync(path.dirname(paths().audit), { recursive: true });
  const record = sanitize({
    id: `audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    timestamp: nowIso(), actor: 'user', operation: 'dashboard.generate', targetType: 'dashboard',
    targetId: path.basename(result.path), summary: 'Generated read-only static memory dashboard',
    metadata: { opened: result.opened, browser: result.browser, browserError: result.browserError, sections: result.sections.length }
  });
  fs.appendFileSync(paths().audit, JSON.stringify(record) + '\n');
}

function printJson(value) {
  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}

function usage() {
  process.stdout.write(`agent-kernel dashboard ${VERSION}\n\nUsage:\n  agent-kernel dashboard [--out file.html] [--project path] [--no-open|--open] [--json]\n`);
}

function main() {
  const flags = parseFlags(process.argv.slice(2));
  if (enabled(flags.help)) return usage();
  if (enabled(flags.open) && enabled(flags['no-open'])) throw new Error('Flags --open and --no-open cannot be used together.');
  const projectPath = flags.project ? path.resolve(flags.project) : process.cwd();
  if (!exists(projectPath) || !fs.statSync(projectPath).isDirectory()) throw new Error(`Dashboard project does not exist or is not a directory: ${projectPath}`);
  const output = ensureSafeTarget(flags.out || path.join(paths().reports, 'dashboard.html'));
  const data = snapshot(projectPath);
  const html = redactLocalPaths(redactText(renderDashboard(data)), projectPath);
  writeAtomic(output, html);
  const shouldOpen = enabled(flags.open) || (!enabled(flags.json) && !enabled(flags['no-open']));
  const opened = shouldOpen ? openDashboard(output) : { opened: false, browser: null, error: null };
  const result = {
    ok: true, path: output, generatedAt: data.generatedAt, opened: opened.opened, browser: opened.browser,
    browserError: opened.error, externalAssets: false, scripts: 'inline-copy-filter-only',
    sections: data.sections.map((section) => section.id)
  };
  audit(result);
  if (enabled(flags.json)) return printJson(result);
  process.stdout.write(`Generated static dashboard: ${output}\n`);
  if (result.opened) process.stdout.write(`Opened in browser: ${result.browser}\n`);
  else if (result.browserError) process.stdout.write(`Browser did not open: ${result.browserError}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error?.message || String(error)}\n`);
  process.exitCode = 1;
}
