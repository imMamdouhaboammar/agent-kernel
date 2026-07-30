import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

export function getEvolutionPaths() {
  const root = process.env.AGENT_KERNEL_HOME || path.join(os.homedir(), '.agent-kernel');
  const evoDir = path.join(root, 'evolution');
  return {
    root: evoDir,
    playbooks: path.join(evoDir, 'playbooks'),
    learnings: path.join(evoDir, 'learnings.json'),
    registry: path.join(evoDir, 'hooks-registry.json')
  };
}

function ensureEvoLayout() {
  const p = getEvolutionPaths();
  fs.mkdirSync(p.playbooks, { recursive: true });
  if (!fs.existsSync(p.learnings)) fs.writeFileSync(p.learnings, JSON.stringify([], null, 2));
  if (!fs.existsSync(p.registry)) fs.writeFileSync(p.registry, JSON.stringify({ installedHooks: [] }, null, 2));
  return p;
}

export function generatePlaybook({ title, topic, steps = [], triggerPatterns = [], metadata = {} }) {
  const p = ensureEvoLayout();
  const id = 'playbook_' + crypto.createHash('sha256').update(title + Date.now()).digest('hex').slice(0, 12);
  const playbook = {
    id,
    title: title || 'Untitled Playbook',
    topic: topic || 'general',
    version: '1.0',
    triggerPatterns,
    steps,
    metrics: {
      runCount: 0,
      successCount: 0,
      failureCount: 0,
      successRate: 1.0
    },
    history: [
      {
        version: '1.0',
        timestamp: new Date().toISOString(),
        action: 'created',
        reason: 'Initial playbook synthesis'
      }
    ],
    metadata: {
      createdAt: new Date().toISOString(),
      lastEvolvedAt: new Date().toISOString(),
      ...metadata
    }
  };

  const filePath = path.join(p.playbooks, `${id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(playbook, null, 2));
  return playbook;
}

export function listPlaybooks() {
  const p = ensureEvoLayout();
  const results = [];
  if (!fs.existsSync(p.playbooks)) return results;
  
  const files = fs.readdirSync(p.playbooks);
  for (const file of files) {
    if (file.endsWith('.json')) {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(p.playbooks, file), 'utf8'));
        results.push(content);
      } catch {}
    }
  }
  return results;
}

export function inspectPlaybook(playbookId) {
  const p = ensureEvoLayout();
  const filePath = path.join(p.playbooks, `${playbookId}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

export function evolvePlaybook(playbookId, { outcome = 'success', newStep = null, reason = 'Execution evolution' } = {}) {
  const p = ensureEvoLayout();
  const playbook = inspectPlaybook(playbookId);
  if (!playbook) return null;

  playbook.metrics.runCount += 1;
  if (outcome === 'success') {
    playbook.metrics.successCount += 1;
  } else {
    playbook.metrics.failureCount += 1;
  }
  playbook.metrics.successRate = Number((playbook.metrics.successCount / playbook.metrics.runCount).toFixed(2));

  if (newStep) {
    playbook.steps.push(newStep);
  }

  const currentVer = parseFloat(playbook.version || '1.0');
  const nextVer = (currentVer + 0.1).toFixed(1);
  playbook.version = nextVer;
  playbook.metadata.lastEvolvedAt = new Date().toISOString();

  playbook.history.push({
    version: nextVer,
    timestamp: new Date().toISOString(),
    action: outcome === 'success' ? 'evolved_success' : 'evolved_repair',
    reason
  });

  const filePath = path.join(p.playbooks, `${playbookId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(playbook, null, 2));
  return playbook;
}

export function captureLearningMoment({ prompt = '', correction = '', toolResult = '', type = 'correction', agentName = 'unknown' } = {}) {
  const p = ensureEvoLayout();
  let learnings = [];
  try {
    learnings = JSON.parse(fs.readFileSync(p.learnings, 'utf8'));
  } catch {
    learnings = [];
  }

  const entry = {
    id: 'learn_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    timestamp: new Date().toISOString(),
    agentName,
    type,
    prompt,
    correction,
    toolResult
  };

  learnings.push(entry);
  fs.writeFileSync(p.learnings, JSON.stringify(learnings, null, 2));
  return entry;
}

export function getTargetHookPaths() {
  const home = os.homedir();
  return [
    { name: 'antigravity', path: path.join(home, '.gemini', 'config', 'hooks.json') },
    { name: 'claude', path: path.join(home, '.claude', 'hooks.json') },
    { name: 'codex', path: path.join(home, '.codex', 'hooks.json') },
    { name: 'opencode', path: path.join(home, '.opencode', 'hooks.json') }
  ];
}

export function installSelfEvolveHooks() {
  const p = ensureEvoLayout();
  const targets = getTargetHookPaths();
  const installed = [];

  const selfEvolveHook = {
    name: 'agent-kernel-self-evolve',
    events: ['PostToolUse', 'SessionEnd'],
    command: 'agent-kernel hook self-evolve'
  };

  for (const target of targets) {
    try {
      fs.mkdirSync(path.dirname(target.path), { recursive: true });
      let current = { hooks: [] };
      if (fs.existsSync(target.path)) {
        try { current = JSON.parse(fs.readFileSync(target.path, 'utf8')); } catch {}
      }
      if (!Array.isArray(current.hooks)) current.hooks = [];

      const exists = current.hooks.some(h => h.name === 'agent-kernel-self-evolve' || h.command === 'agent-kernel hook self-evolve');
      if (!exists) {
        current.hooks.push(selfEvolveHook);
        fs.writeFileSync(target.path, JSON.stringify(current, null, 2));
      }
      installed.push({ target: target.name, path: target.path, updated: !exists });
    } catch {
      // Safe fallback if permission restricted
    }
  }

  fs.writeFileSync(p.registry, JSON.stringify({ installedHooks: installed, updatedAt: new Date().toISOString() }, null, 2));
  return installed;
}
