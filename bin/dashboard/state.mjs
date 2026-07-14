import fs from 'node:fs';
import path from 'node:path';
import {
  DashboardError,
  SAFE_ID,
  VERSION,
  dashboardPaths,
  exists,
  nowIso,
  sanitize
} from './common.mjs';

function diagnosticState() {
  return { skippedMalformed: 0, messages: [] };
}

function readJson(filePath, fallback, state, label) {
  if (!exists(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    state.skippedMalformed++;
    state.messages.push(`Skipped malformed ${label}`);
    return fallback;
  }
}

function readDirectory(dir, state, label) {
  if (!exists(dir)) return [];
  const records = [];
  for (const name of fs.readdirSync(dir).sort()) {
    if (!name.endsWith('.json')) continue;
    const value = readJson(path.join(dir, name), null, state, label);
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
  const location = dashboardPaths().memories;
  if (!exists(location)) return [];
  const records = [];
  for (const name of fs.readdirSync(location).sort()) {
    if (!name.endsWith('.json')) continue;
    const values = readJson(path.join(location, name), [], state, 'memory file');
    if (!Array.isArray(values)) continue;
    for (const value of values) {
      const record = baseRecord(value, 'memory');
      record.bucket = name.slice(0, -5);
      records.push(record);
    }
  }
  return records;
}

function policyRecords(state) {
  return asArray(readJson(dashboardPaths().policies, [], state, 'policy file'), ['policies']).map((value) => {
    const record = baseRecord(value, 'policy');
    record.text = String(value?.title || value?.description || value?.text || value?.id || 'Policy');
    record.details = { mode: value?.mode, owner: value?.owner };
    return record;
  });
}

function episodeRecords(state) {
  return readDirectory(dashboardPaths().episodes, state, 'episode file').map((value) => {
    const record = baseRecord(value, 'episode');
    record.text = String(value?.summary || value?.title || value?.text || value?.id || 'Episode');
    return record;
  });
}

function failureRecords(state) {
  return asArray(readJson(dashboardPaths().failures, [], state, 'failure file'), ['failures', 'lessons']).map((value) => {
    const record = baseRecord(value, 'failure-lesson');
    record.text = String(value?.errorSignature || value?.title || value?.summary || value?.id || 'Failure Lesson');
    record.reason = String(value?.rootCause || value?.reason || '');
    record.details = { fix: value?.fix, occurrences: value?.occurrences };
    return record;
  });
}

function sessionRecords(state) {
  return readDirectory(dashboardPaths().sessions, state, 'session file')
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
  return asArray(readJson(filePath, [], state, `${type} registry`), [key]).map((value) => {
    const record = baseRecord(value, type);
    record.text = String(value?.name || value?.description || value?.surface || record.id || type);
    record.details = type === 'agent'
      ? { trustLevel: value?.trustLevel, surface: value?.surface }
      : { status: value?.status, defaultBranch: value?.defaultBranch };
    return record;
  });
}

function commitRecords(state) {
  const data = readJson(dashboardPaths().commits, {}, state, 'commit index');
  const values = data?.commits && typeof data.commits === 'object' ? Object.values(data.commits) : asArray(data, ['items']);
  return values.map((value) => {
    const record = baseRecord(value, 'commit');
    record.id = String(value.shortSha || value.sha || value.id || '');
    record.text = String(value.subject || value.summary || record.id || 'Commit');
    record.details = { sessionCount: Array.isArray(value.sessions) ? value.sessions.length : 0 };
    return record;
  });
}

function updaterRecords(state) {
  const locations = dashboardPaths();
  const config = readJson(locations.config, {}, state, 'config file');
  const cache = readJson(locations.updateCache, null, state, 'update cache');
  if (!config?.updates && !cache) return [];
  return [{
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
  }];
}

function retentionRecords() {
  const sessions = dashboardPaths().sessions;
  let rawLogs = 0;
  let rawBytes = 0;
  if (exists(sessions)) {
    for (const name of fs.readdirSync(sessions)) {
      if (!name.endsWith('.jsonl')) continue;
      rawLogs++;
      try { rawBytes += fs.statSync(path.join(sessions, name)).size; } catch {}
    }
  }
  return [{ id: 'retention-status', type: 'retention', status: rawLogs ? 'observed' : 'clean', text: `${rawLogs} raw session log${rawLogs === 1 ? '' : 's'}`, details: { rawLogs, rawBytes } }];
}

function auditRecords(state) {
  const location = dashboardPaths().audit;
  if (!exists(location)) return [];
  const rows = [];
  for (const line of fs.readFileSync(location, 'utf8').split(/\r?\n/)) {
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
  const resolved = path.resolve(projectPath);
  if (!exists(resolved) || !fs.statSync(resolved).isDirectory()) {
    throw new DashboardError('invalid-project', `Dashboard project does not exist or is not a directory: ${resolved}`);
  }
  const dir = path.join(resolved, '.agent-kernel', 'architecture');
  if (!exists(dir)) return [];
  const policy = readJson(path.join(dir, 'policy.json'), {}, state, 'architecture policy');
  const map = readJson(path.join(dir, 'map.json'), {}, state, 'architecture map');
  const contract = readJson(path.join(dir, 'contract.json'), {}, state, 'architecture contract');
  const exceptions = readJson(path.join(dir, 'exceptions.json'), {}, state, 'architecture exceptions');
  const report = readJson(path.join(dir, 'reports', 'latest.json'), {}, state, 'architecture report');
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

export function dashboardSnapshot(projectPath) {
  const state = diagnosticState();
  const locations = dashboardPaths();
  const pending = readDirectory(locations.pending, state, 'pending proposal').map((value) => proposalRecord(value, 'pending'));
  const approved = readDirectory(locations.approved, state, 'approved proposal').map((value) => proposalRecord(value, 'approved'));
  const rejected = readDirectory(locations.rejected, state, 'rejected proposal').map((value) => proposalRecord(value, 'rejected'));
  const memories = memoryRecords(state);
  const rules = memories.filter((item) => item.type === 'rule');
  const skillTriggers = memories.filter((item) => item.type === 'skill-trigger');
  const policies = policyRecords(state);
  const episodes = episodeRecords(state);
  const failures = failureRecords(state);
  const sessions = sessionRecords(state);
  const agents = registryRecords(locations.agents, 'agents', 'agent', state);
  const projects = registryRecords(locations.projects, 'projects', 'project', state);
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
    projectName: path.basename(path.resolve(projectPath)),
    diagnostics: state,
    metrics: { pending: pending.length, approved: approved.length, memories: memories.length, episodes: episodes.length, failures: failures.length, sessions: sessions.length },
    sections
  });
}
