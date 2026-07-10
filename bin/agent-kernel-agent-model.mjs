import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const TRUST_LEVELS = ['read-only', 'capture-only', 'propose-only', 'trusted-local'];

const ACTIONS_BY_TRUST = {
  'read-only': ['search', 'context'],
  'capture-only': ['search', 'context', 'observe', 'capture'],
  'propose-only': ['search', 'context', 'observe', 'capture', 'propose', 'guard'],
  'trusted-local': ['search', 'context', 'observe', 'capture', 'propose', 'guard', 'extended-local']
};

const BUILT_INS = [
  { agentId: 'claude-code', displayName: 'Claude Code', aliases: ['claude'], surface: 'cli', trustLevel: 'propose-only' },
  { agentId: 'codex', displayName: 'Codex', aliases: ['openai-codex'], surface: 'cli', trustLevel: 'propose-only' },
  { agentId: 'cursor', displayName: 'Cursor', aliases: [], surface: 'ide', trustLevel: 'propose-only' },
  { agentId: 'gemini', displayName: 'Gemini CLI', aliases: ['gemini-cli'], surface: 'cli', trustLevel: 'propose-only' },
  { agentId: 'opencode', displayName: 'OpenCode', aliases: ['open-code'], surface: 'cli', trustLevel: 'propose-only' },
  { agentId: 'antigravity', displayName: 'Antigravity', aliases: [], surface: 'ide', trustLevel: 'propose-only' },
  { agentId: 'mcp', displayName: 'MCP Client', aliases: [], surface: 'mcp', trustLevel: 'propose-only' },
  { agentId: 'failure-patterns', displayName: 'Failure Pattern Workflow', aliases: [], surface: 'local-runtime', trustLevel: 'trusted-local' },
  { agentId: 'agent-kernel', displayName: 'Agent Kernel', aliases: ['user'], surface: 'local-runtime', trustLevel: 'trusted-local' }
];

function kernelHome() {
  return process.env.AGENT_KERNEL_HOME || path.join(os.homedir(), '.agent-kernel');
}

function registryPath() {
  return path.join(kernelHome(), 'source', 'agents', 'agents.json');
}

function nowIso() {
  return new Date().toISOString();
}

export function normalizeAgentId(value) {
  return String(value || 'unknown-agent').trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown-agent';
}

function record(input, createdAt = nowIso()) {
  const trustLevel = TRUST_LEVELS.includes(input.trustLevel) ? input.trustLevel : 'read-only';
  return {
    agentId: normalizeAgentId(input.agentId),
    displayName: String(input.displayName || input.agentId || 'Unknown agent'),
    aliases: [...new Set((input.aliases || []).map(normalizeAgentId).filter(Boolean))],
    surface: String(input.surface || 'custom'),
    trustLevel,
    allowedActions: [...ACTIONS_BY_TRUST[trustLevel]],
    builtIn: input.builtIn === true,
    createdAt: input.createdAt || createdAt,
    updatedAt: input.updatedAt || createdAt
  };
}

function defaultRegistry() {
  const timestamp = nowIso();
  return {
    version: 1,
    updatedAt: timestamp,
    agents: BUILT_INS.map((item) => record({ ...item, builtIn: true }, timestamp))
  };
}

function readJson(filePath, fallback) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return fallback; }
}

export function saveAgentRegistry(value) {
  const filePath = registryPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', 'utf8');
  fs.renameSync(temporary, filePath);
}

export function loadAgentRegistry() {
  const filePath = registryPath();
  const existing = readJson(filePath, null);
  if (!existing || !Array.isArray(existing.agents)) {
    const created = defaultRegistry();
    saveAgentRegistry(created);
    return created;
  }
  const known = new Set(existing.agents.map((item) => normalizeAgentId(item.agentId)));
  let changed = false;
  for (const builtIn of BUILT_INS) {
    if (known.has(normalizeAgentId(builtIn.agentId))) continue;
    existing.agents.push(record({ ...builtIn, builtIn: true }));
    changed = true;
  }
  existing.version = 1;
  if (changed) {
    existing.updatedAt = nowIso();
    saveAgentRegistry(existing);
  }
  return existing;
}

export function findAgentIdentity(registry, value) {
  const wanted = normalizeAgentId(value);
  return registry.agents.find((item) => normalizeAgentId(item.agentId) === wanted || (item.aliases || []).map(normalizeAgentId).includes(wanted));
}

export function getAgentIdentity(value) {
  const registry = loadAgentRegistry();
  const found = findAgentIdentity(registry, value);
  return found ? { ...found } : null;
}

export function upsertAgentIdentity(input, options = {}) {
  const registry = loadAgentRegistry();
  const wanted = normalizeAgentId(input.agentId);
  const existingIndex = registry.agents.findIndex((item) => normalizeAgentId(item.agentId) === wanted);
  const existing = existingIndex >= 0 ? registry.agents[existingIndex] : null;
  if (existing?.builtIn && options.allowBuiltInUpdate !== true) {
    throw new Error(`Built-in agent requires an explicit set operation: ${wanted}`);
  }
  const timestamp = nowIso();
  const next = record({
    ...existing,
    ...input,
    agentId: wanted,
    builtIn: existing?.builtIn === true,
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp
  });
  if (existingIndex >= 0) registry.agents[existingIndex] = next;
  else registry.agents.push(next);
  registry.agents.sort((a, b) => a.agentId.localeCompare(b.agentId));
  registry.updatedAt = timestamp;
  saveAgentRegistry(registry);
  return next;
}

export function removeAgentIdentity(value) {
  const registry = loadAgentRegistry();
  const wanted = normalizeAgentId(value);
  const existing = findAgentIdentity(registry, wanted);
  if (!existing) return null;
  if (existing.builtIn) throw new Error(`Built-in agent cannot be removed: ${existing.agentId}`);
  registry.agents = registry.agents.filter((item) => item.agentId !== existing.agentId);
  registry.updatedAt = nowIso();
  saveAgentRegistry(registry);
  return existing;
}

export function resolveAgentIdentity(value, options = {}) {
  const registry = loadAgentRegistry();
  const wanted = normalizeAgentId(value);
  const found = findAgentIdentity(registry, wanted);
  if (found) return { ...found, requestedId: wanted, known: true };

  const trustLevel = ['observe', 'capture', 'session'].includes(options.action) ? 'capture-only' : 'read-only';
  const created = record({
    agentId: wanted,
    displayName: String(options.displayName || value || 'Unknown agent'),
    aliases: [],
    surface: options.surface || 'custom',
    trustLevel,
    builtIn: false
  });
  registry.agents.push(created);
  registry.updatedAt = nowIso();
  saveAgentRegistry(registry);
  return { ...created, requestedId: wanted, known: false };
}

export function agentCan(identity, action) {
  return Array.isArray(identity?.allowedActions) && identity.allowedActions.includes(action);
}

export function enrichIdentityRecord(item, identity, options = {}) {
  const createdBy = identity?.agentId || normalizeAgentId(options.fallback || 'unknown-agent');
  return {
    ...item,
    agentId: item.agentId || createdBy,
    createdBy: item.createdBy || createdBy,
    trustLevel: item.trustLevel || identity?.trustLevel || 'read-only',
    agentIdentity: item.agentIdentity || {
      agentId: createdBy,
      displayName: identity?.displayName || createdBy,
      surface: identity?.surface || 'custom',
      trustLevel: identity?.trustLevel || 'read-only'
    }
  };
}

export function agentIdFromRecord(item) {
  return normalizeAgentId(
    item?.agentId ||
    item?.createdBy ||
    item?.agent ||
    item?.source?.agentId ||
    item?.source?.createdBy ||
    item?.source?.proposedBy ||
    'unknown-agent'
  );
}

export function registryFilePath() {
  return registryPath();
}
