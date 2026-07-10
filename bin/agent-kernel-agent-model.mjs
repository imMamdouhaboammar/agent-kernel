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

function normalizeId(value) {
  return String(value || 'unknown-agent').trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown-agent';
}

function record(input, createdAt = nowIso()) {
  const trustLevel = TRUST_LEVELS.includes(input.trustLevel) ? input.trustLevel : 'read-only';
  return {
    agentId: normalizeId(input.agentId),
    displayName: String(input.displayName || input.agentId || 'Unknown agent'),
    aliases: [...new Set((input.aliases || []).map(normalizeId).filter(Boolean))],
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

function writeRegistry(value) {
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
    writeRegistry(created);
    return created;
  }
  const known = new Set(existing.agents.map((item) => normalizeId(item.agentId)));
  let changed = false;
  for (const builtIn of BUILT_INS) {
    if (known.has(normalizeId(builtIn.agentId))) continue;
    existing.agents.push(record({ ...builtIn, builtIn: true }));
    changed = true;
  }
  existing.version = 1;
  if (changed) {
    existing.updatedAt = nowIso();
    writeRegistry(existing);
  }
  return existing;
}

function findAgent(registry, value) {
  const wanted = normalizeId(value);
  return registry.agents.find((item) => normalizeId(item.agentId) === wanted || (item.aliases || []).map(normalizeId).includes(wanted));
}

export function resolveAgentIdentity(value, options = {}) {
  const registry = loadAgentRegistry();
  const wanted = normalizeId(value);
  const found = findAgent(registry, wanted);
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
  writeRegistry(registry);
  return { ...created, requestedId: wanted, known: false };
}

export function agentCan(identity, action) {
  return Array.isArray(identity?.allowedActions) && identity.allowedActions.includes(action);
}

export function enrichIdentityRecord(item, identity, options = {}) {
  const createdBy = identity?.agentId || normalizeId(options.fallback || 'unknown-agent');
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
  return normalizeId(
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
