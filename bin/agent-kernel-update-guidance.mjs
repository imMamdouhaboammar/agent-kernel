#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const START = '<!-- agent-kernel-update:start -->';
const END = '<!-- agent-kernel-update:end -->';

function kernelHome() {
  return process.env.AGENT_KERNEL_HOME || path.join(os.homedir(), '.agent-kernel');
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function atomicWrite(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporary, text, 'utf8');
  fs.renameSync(temporary, filePath);
}

function removeBlocks(text) {
  let next = text;
  while (true) {
    const start = next.indexOf(START);
    if (start < 0) return { ok: true, text: next };
    const end = next.indexOf(END, start);
    if (end < 0) return { ok: false, text };
    next = next.slice(0, start) + next.slice(end + END.length);
  }
}

function renderBlock(config, cache) {
  if (!cache || cache.updateAvailable !== true || !cache.currentVersion || !cache.targetVersion) return '';
  const updates = {
    mode: 'disabled',
    channel: cache.channel || 'latest',
    trustedAgents: [],
    ...(config?.updates || {})
  };
  const trusted = Array.isArray(updates.trustedAgents) && updates.trustedAgents.length
    ? updates.trustedAgents.join(', ')
    : 'none';
  return `${START}\n## Agent Kernel update available\n\n- Installed: ${cache.currentVersion}\n- Available: ${cache.targetVersion}\n- Channel: ${cache.channel || updates.channel}\n- Mode: ${updates.mode}\n- Trusted agents: ${trusted}\n\nTrusted agents may run:\n\n\`agent-kernel update apply --agent <agent-id>\`\n${END}\n`;
}

function targetFiles(projectPath) {
  const home = kernelHome();
  const userHome = process.env.HOME || process.env.USERPROFILE || os.homedir();
  const files = [
    path.join(home, 'dist', 'AGENTS.md'),
    path.join(home, 'dist', 'CLAUDE.md'),
    path.join(home, 'dist', 'cursor-rule.mdc'),
    path.join(home, 'dist', 'antigravity-agents.md'),
    path.join(home, 'dist', 'GEMINI.md'),
    path.join(userHome, '.codex', 'AGENTS.md'),
    path.join(userHome, '.claude', 'CLAUDE.md'),
    path.join(userHome, '.gemini', 'GEMINI.md')
  ];
  if (projectPath) {
    const project = path.resolve(projectPath);
    files.push(
      path.join(project, 'AGENTS.md'),
      path.join(project, 'CLAUDE.md'),
      path.join(project, '.cursor', 'rules', '00-agent-kernel.mdc'),
      path.join(project, '.agents', 'agents.md'),
      path.join(project, 'GEMINI.md')
    );
  }
  return [...new Set(files)];
}

function publish(projectPath) {
  const home = kernelHome();
  const config = readJson(path.join(home, 'config.json'), {});
  const cache = readJson(path.join(home, 'runtime', 'update-status.json'), null);
  const block = renderBlock(config, cache);
  let changed = 0;
  let skippedMalformed = 0;
  let skippedSymlinks = 0;
  for (const filePath of targetFiles(projectPath)) {
    if (!fs.existsSync(filePath)) continue;
    try {
      if (fs.lstatSync(filePath).isSymbolicLink()) {
        skippedSymlinks++;
        continue;
      }
    } catch {
      continue;
    }
    const original = fs.readFileSync(filePath, 'utf8');
    const cleaned = removeBlocks(original);
    if (!cleaned.ok) {
      skippedMalformed++;
      continue;
    }
    const base = cleaned.text.trimEnd();
    const next = block ? `${base}\n\n${block}` : `${base}\n`;
    if (next !== original) {
      atomicWrite(filePath, next);
      changed++;
    }
  }
  return { changed, skippedMalformed, skippedSymlinks };
}

const args = process.argv.slice(2);
const projectIndex = args.indexOf('--project');
const projectPath = projectIndex >= 0 ? args[projectIndex + 1] : null;
const result = publish(projectPath);
if (args.includes('--json')) process.stdout.write(JSON.stringify({ ok: true, ...result }) + '\n');
