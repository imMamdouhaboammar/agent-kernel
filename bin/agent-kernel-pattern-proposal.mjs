#!/usr/bin/env node
import childProcess from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '1.0.0';
const here = path.dirname(fileURLToPath(import.meta.url));
const proposePath = path.join(here, 'agent-kernel-agent-propose.mjs');
const TARGETS = {
  rule: { type: 'rule', level: 'standard' },
  policy: { type: 'policy', level: 'critical' },
  workflow: { type: 'workflow', level: 'standard' },
  skill: { type: 'skill-trigger', level: 'standard' },
  note: { type: 'project-note', level: 'note' }
};

function kernelHome() {
  return process.env.AGENT_KERNEL_HOME || path.join(os.homedir(), '.agent-kernel');
}

function nowIso() {
  return new Date().toISOString();
}

function parseFlags(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const raw = arg.slice(2);
      const eq = raw.indexOf('=');
      if (eq >= 0) flags[raw.slice(0, eq)] = raw.slice(eq + 1);
      else if (argv[i + 1] && !argv[i + 1].startsWith('-')) flags[raw] = argv[++i];
      else flags[raw] = true;
    } else flags._.push(arg);
  }
  return flags;
}

function readJson(filePath, fallback) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return fallback; }
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', 'utf8');
  fs.renameSync(temporary, filePath);
}

function paths() {
  const root = kernelHome();
  return {
    patterns: path.join(root, 'runtime', 'patterns', 'failure-patterns.json'),
    decisions: path.join(root, 'runtime', 'patterns', 'decisions.json'),
    lessons: path.join(root, 'source', 'failures', 'failure-lessons.json'),
    pending: path.join(root, 'inbox', 'pending'),
    memories: path.join(root, 'source', 'memories')
  };
}

function compact(value, limit = 600) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length <= limit ? text : text.slice(0, limit - 3) + '...';
}

function loadPatterns() {
  const value = readJson(paths().patterns, { patterns: [] });
  return Array.isArray(value?.patterns) ? value.patterns : [];
}

function findPattern(wanted) {
  const patterns = loadPatterns();
  const exact = patterns.find((pattern) => pattern.id === wanted);
  if (exact) return exact;
  const matches = patterns.filter((pattern) => pattern.id.includes(wanted));
  if (matches.length > 1) throw new Error(`Pattern id is ambiguous: ${wanted}`);
  return matches[0] || null;
}

function loadEvidence(pattern) {
  const lessons = readJson(paths().lessons, []);
  if (!Array.isArray(lessons)) return [];
  const wanted = new Set(pattern.evidenceReferences || []);
  return lessons.filter((lesson) => lesson && lesson.status !== 'rejected' && wanted.has(lesson.id));
}

function proposalText(pattern, evidence, targetName) {
  const causes = [...new Set(evidence.map((lesson) => compact(lesson.rootCause, 320)).filter(Boolean))].slice(0, 2);
  const fixes = [...new Set(evidence.flatMap((lesson) => Array.isArray(lesson.fixRecipe) ? lesson.fixRecipe : []).map((fix) => compact(fix, 260)).filter(Boolean))].slice(0, 3);
  const prevention = [...new Set(evidence.map((lesson) => compact(lesson.preventionRule, 320)).filter(Boolean))].slice(0, 1);
  const lines = [
    `Recurring failure pattern: ${compact(pattern.label, 220)}`,
    `Observed ${pattern.occurrenceCount} occurrence(s) across ${pattern.lessonCount} Failure Lesson(s).`,
    `Signal: ${pattern.signalType}.`,
    `Evidence: ${(pattern.evidenceReferences || []).join(', ')}.`
  ];
  if (causes.length) lines.push(`Likely cause: ${causes.join(' | ')}`);
  if (fixes.length) lines.push('Known response:', ...fixes.map((fix) => `- ${fix}`));
  if (prevention.length) lines.push(`Prevention: ${prevention[0]}`);
  else if (targetName === 'workflow') lines.push('Recommended workflow: search related Failure Lessons before retrying, apply the known response, then rerun the original failing command or test.');
  else if (targetName === 'skill') lines.push('Suggested skill trigger: use this evidence when the same signal, file, command, or error signature appears again.');
  else lines.push('Recommended rule: search the linked Failure Lessons before retrying this recurring failure.');
  return lines.join('\n').slice(0, 1900);
}

function proposalIdFrom(output) {
  return String(output || '').match(/Created pending memory proposal:\s*(\S+)/)?.[1] || '';
}

function markPatternProposed(patternId, proposalId, targetName) {
  const p = paths();
  const decisions = readJson(p.decisions, { version: 1, patterns: {} });
  decisions.version = 1;
  decisions.patterns ||= {};
  decisions.patterns[patternId] = {
    ...(decisions.patterns[patternId] || {}),
    status: 'proposed',
    proposalId,
    proposalTarget: targetName,
    decidedAt: nowIso()
  };
  writeJsonAtomic(p.decisions, decisions);

  const stored = readJson(p.patterns, { version: 1, patterns: [] });
  if (Array.isArray(stored.patterns)) {
    stored.patterns = stored.patterns.map((pattern) => pattern.id === patternId
      ? { ...pattern, status: 'proposed', proposalId, proposalTarget: targetName, proposedAt: nowIso() }
      : pattern);
    writeJsonAtomic(p.patterns, stored);
  }
}

function commandProposePattern(flags) {
  const wanted = String(flags._[0] || flags.pattern || '').trim();
  if (!wanted) throw new Error('Usage: agent-kernel failure propose-pattern <pattern-id> --as rule|policy|workflow|skill|note');
  const targetName = String(flags.as || 'rule');
  const target = TARGETS[targetName];
  if (!target) throw new Error(`Unsupported proposal target: ${targetName}. Allowed: ${Object.keys(TARGETS).join(', ')}`);

  const pattern = findPattern(wanted);
  if (!pattern) throw new Error(`Failure pattern not found: ${wanted}. Run: agent-kernel failure patterns --json`);
  if (pattern.status === 'rejected') throw new Error(`Failure pattern is rejected: ${pattern.id}. Restore it before proposing.`);
  if (!pattern.evidenceReferences?.length) throw new Error(`Failure pattern has no evidence references: ${pattern.id}`);

  const evidence = loadEvidence(pattern);
  if (!evidence.length) throw new Error(`Failure pattern evidence is unavailable: ${pattern.id}`);
  const text = proposalText(pattern, evidence, targetName);
  const scope = String(flags.scope || (pattern.projects?.length === 1 ? 'project' : 'global'));
  const tags = [
    'failure-pattern',
    pattern.signalType,
    `pattern:${pattern.id}`,
    ...(pattern.files || []).slice(0, 4).map((file) => `file:${file}`)
  ].join(',');
  const args = [
    proposePath,
    '--from', String(flags.from || 'failure-patterns'),
    '--type', target.type,
    '--scope', scope,
    '--level', String(flags.level || target.level),
    '--targets', String(flags.targets || 'all'),
    '--tags', String(flags.tags || tags),
    '--reason', String(flags.reason || `Recurring failure pattern ${pattern.id}; evidence: ${pattern.evidenceReferences.join(', ')}.`),
    '--text', text
  ];
  const result = childProcess.spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || `proposal helper failed with status ${result.status}`).trim());
  const proposalId = proposalIdFrom(result.stdout);
  if (!proposalId) throw new Error(`Proposal was created but its id could not be parsed: ${result.stdout}`);
  markPatternProposed(pattern.id, proposalId, targetName);
  const output = {
    ok: true,
    patternId: pattern.id,
    proposalId,
    target: targetName,
    status: 'pending',
    evidenceReferences: pattern.evidenceReferences,
    next: {
      review: 'agent-kernel inbox',
      approve: `agent-kernel approve ${proposalId} --publish`,
      reject: `agent-kernel reject ${proposalId}`
    }
  };
  if (flags.json) process.stdout.write(JSON.stringify(output, null, 2) + '\n');
  else {
    process.stdout.write(result.stdout);
    process.stdout.write(`Pattern: ${pattern.id}\nEvidence: ${pattern.evidenceReferences.join(', ')}\n`);
  }
}

function usage() {
  process.stdout.write(`agent-kernel-pattern-proposal ${VERSION}\n\nUsage:\n  agent-kernel failure propose-pattern <pattern-id> --as rule\n  agent-kernel failure propose-pattern <pattern-id> --as workflow\n  agent-kernel failure propose-pattern <pattern-id> --as skill\n\nAllowed targets: rule, policy, workflow, skill, note. The command creates a pending proposal only.\n`);
}

function main() {
  const args = process.argv.slice(2);
  if (args[0] === 'failure') args.shift();
  if (args[0] === 'propose-pattern') args.shift();
  const flags = parseFlags(args);
  if (flags.help || flags.h) return usage();
  commandProposePattern(flags);
}

try { main(); }
catch (error) {
  process.stderr.write(`${error?.message || String(error)}\n`);
  process.exitCode = 1;
}
