#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { identifyProject } from './agent-kernel-project-model.mjs';

const VERSION = '1.20.0';
const SECRET_PATTERNS = [
  /OPENAI_API_KEY\s*=\s*["'][^"']+["']/gi,
  /ANTHROPIC_API_KEY\s*=\s*["'][^"']+["']/gi,
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*["'][^"']+["']/gi,
  /AIza[0-9A-Za-z\-_]{35}/g,
  /sk-[A-Za-z0-9]{20,}/g,
  /ghp_[A-Za-z0-9]{20,}/g,
  /xox[abposr]-[A-Za-z0-9-]{10,}/g
];

function kernelHome() {
  return process.env.AGENT_KERNEL_HOME || path.join(os.homedir(), '.agent-kernel');
}

function exists(filePath) {
  try { fs.accessSync(filePath); return true; } catch { return false; }
}

function readJson(filePath, fallback) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return fallback; }
}

function contextPaths() {
  const root = kernelHome();
  return {
    root,
    memories: path.join(root, 'source', 'memories'),
    failures: path.join(root, 'source', 'failures', 'failure-lessons.json'),
    episodeIndex: path.join(root, 'episodes', 'index.json'),
    pending: path.join(root, 'inbox', 'pending'),
    rejected: path.join(root, 'inbox', 'rejected')
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
    } else out._.push(arg);
  }
  return out;
}

function redact(text) {
  let out = String(text || '');
  for (const pattern of SECRET_PATTERNS) out = out.replace(pattern, '[REDACTED_SECRET]');
  return out;
}

function normalizeFiles(flags) {
  const files = [];
  const add = (value) => {
    if (Array.isArray(value)) value.forEach(add);
    else if (typeof value === 'string') value.split(',').forEach((item) => { if (item.trim()) files.push(item.trim()); });
  };
  add(flags.file);
  add(flags.files);
  return [...new Set(files)];
}

function projectCandidates(item) {
  return [
    item?.projectId,
    item?.project,
    item?.metadata?.projectId,
    item?.source?.projectId,
    item?.evidence?.projectId
  ].filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim().toLowerCase());
}

function matchesProject(item, projectId) {
  if (!projectId) return true;
  const wanted = projectId.toLowerCase();
  const candidates = projectCandidates(item);
  if (candidates.length) return candidates.includes(wanted);
  return item?.scope === 'global';
}

function loadApprovedMemory(projectId) {
  const p = contextPaths();
  if (!exists(p.memories)) return [];
  const items = [];
  for (const name of fs.readdirSync(p.memories).sort()) {
    if (!name.endsWith('.json')) continue;
    const value = readJson(path.join(p.memories, name), []);
    if (!Array.isArray(value)) continue;
    for (const item of value) {
      if (item && item.status === 'approved' && matchesProject(item, projectId)) items.push({ ...item, bucket: name.replace(/\.json$/, '') });
    }
  }
  return items;
}

function loadPendingProposals(projectId) {
  const p = contextPaths();
  if (!exists(p.pending)) return [];
  return fs.readdirSync(p.pending).sort()
    .filter((name) => name.endsWith('.json'))
    .map((name) => readJson(path.join(p.pending, name), null))
    .filter((item) => item && item.status !== 'rejected' && matchesProject(item, projectId))
    .map((item) => ({ ...item, status: 'pending', approved: false }));
}

function loadFailureLessons(projectId) {
  const value = readJson(contextPaths().failures, []);
  return Array.isArray(value) ? value.filter((item) => item && item.status !== 'rejected' && matchesProject(item, projectId)) : [];
}

function loadEpisodes(projectId) {
  const value = readJson(contextPaths().episodeIndex, []);
  const items = Array.isArray(value) ? value : (Array.isArray(value?.episodes) ? value.episodes : []);
  return items.filter((item) => item && item.status !== 'rejected' && matchesProject(item, projectId));
}

function itemText(item) {
  return JSON.stringify(item || {}).toLowerCase();
}

function scoreItem(item, query, files) {
  const text = itemText(item);
  const q = String(query || '').toLowerCase();
  let score = 0;
  if (q && text.includes(q)) score += 4;
  for (const file of files.map((f) => f.toLowerCase())) if (text.includes(file)) score += 6;
  if (!q && files.length === 0) score += 1;
  if (item.level === 'critical') score += 2;
  if (item.status === 'approved') score += 1;
  return score;
}

function relevant(items, query, files, limit = 8) {
  return items
    .map((item) => ({ item, score: scoreItem(item, query, files) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || String(a.item.id || a.item.title || '').localeCompare(String(b.item.id || b.item.title || '')))
    .slice(0, limit)
    .map((entry) => entry.item);
}

function compactItem(item) {
  return redact(item.text || item.fix || item.rootCause || item.summary || item.title || item.reason || item.id || JSON.stringify(item));
}

function buildContext(flags) {
  const query = String(flags.query || flags.q || flags._.join(' ') || '');
  const files = normalizeFiles(flags);
  const limit = Math.max(1, Math.min(Number(flags.limit || 8), 20));
  const budget = Math.max(100, Math.min(Number(flags.budget || 1200), 12000));
  let projectId = String(flags.projectId || flags['project-id'] || '').trim();
  if (!projectId && flags.project) projectId = identifyProject(String(flags.project)).projectId;
  const sections = {
    approvedRules: relevant(loadApprovedMemory(projectId), query, files, limit),
    failureLessons: relevant(loadFailureLessons(projectId), query, files, limit),
    episodes: relevant(loadEpisodes(projectId), query, files, limit),
    guardWarnings: [],
    pendingProposals: relevant(loadPendingProposals(projectId), query, files, limit)
  };
  const context = renderContext(sections, budget);
  return { version: VERSION, home: kernelHome(), projectId: projectId || null, query, files, budget, budgetUsed: context.length, context, sections };
}

function renderContext(sections, budget) {
  const lines = [];
  const push = (title, items, pending = false) => {
    if (!items.length) return;
    lines.push(`## ${title}`);
    for (const item of items) {
      const marker = pending ? '[PENDING, UNAPPROVED] ' : '';
      lines.push(`- ${marker}${compactItem(item)}`.slice(0, 700));
    }
    lines.push('');
  };
  push('Approved Rules', sections.approvedRules);
  push('Failure Lessons', sections.failureLessons);
  push('Related Episodes', sections.episodes);
  push('Guard Warnings', sections.guardWarnings);
  push('Pending Proposals', sections.pendingProposals, true);
  return lines.join('\n').trim().slice(0, budget);
}

function printMarkdown(result) {
  process.stdout.write((result.context || 'No matching local context found.') + '\n');
}

function usage() {
  process.stdout.write(`agent-kernel-context ${VERSION}\n\nUsage:\n  agent-kernel context --query <text> [--project-id id] [--file path] [--budget 1200] [--json]\n  agent-kernel context <query text> [--project .] [--files a,b] [--limit 8]\n`);
}

function main() {
  const argv = process.argv.slice(2);
  const flags = parseFlags(argv);
  if (flags.help || flags.h) return usage();
  const result = buildContext(flags);
  if (flags.json) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  else printMarkdown(result);
}

main();
