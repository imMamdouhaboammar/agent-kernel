#!/usr/bin/env node
import childProcess from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const VERSION = '1.17.0';
const DEFAULT_MIN_COUNT = 2;
const SIGNAL_WEIGHTS = {
  error_signature: 100,
  error_text: 90,
  command: 80,
  root_cause: 75,
  fix: 70,
  file: 60,
  agent_signature: 55
};

function kernelHome() {
  return process.env.AGENT_KERNEL_HOME || path.join(os.homedir(), '.agent-kernel');
}

function nowIso() {
  return new Date().toISOString();
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath, fallback) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return fallback; }
}

function writeJsonAtomic(filePath, value) {
  ensureDir(path.dirname(filePath));
  const temporary = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', 'utf8');
  fs.renameSync(temporary, filePath);
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
    } else {
      flags._.push(arg);
    }
  }
  return flags;
}

function storePaths() {
  const root = kernelHome();
  return {
    lessons: path.join(root, 'source', 'failures', 'failure-lessons.json'),
    patternsDir: path.join(root, 'runtime', 'patterns'),
    patterns: path.join(root, 'runtime', 'patterns', 'failure-patterns.json'),
    decisions: path.join(root, 'runtime', 'patterns', 'decisions.json')
  };
}

function loadLessons() {
  const value = readJson(storePaths().lessons, []);
  return Array.isArray(value) ? value : [];
}

function loadDecisions() {
  const value = readJson(storePaths().decisions, { version: 1, patterns: {} });
  return value && typeof value === 'object'
    ? { version: 1, patterns: value.patterns && typeof value.patterns === 'object' ? value.patterns : {} }
    : { version: 1, patterns: {} };
}

function saveDecisions(decisions) {
  writeJsonAtomic(storePaths().decisions, decisions);
}

function projectRoot(project) {
  const resolved = path.resolve(project || '.');
  try {
    return childProcess.execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: resolved,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return resolved;
  }
}

function projectFilter(flags) {
  if (!flags.project) return null;
  const root = projectRoot(String(flags.project));
  return {
    root,
    id: String(flags['project-id'] || flags.projectId || path.basename(root) || 'project').toLowerCase()
  };
}

function slash(value) {
  return String(value || '').replace(/\\/g, '/');
}

function canonicalText(value, limit = 1000) {
  return String(value || '')
    .replace(/\x1b\[[0-9;]*m/g, '')
    .replace(/https?:\/\/\S+/gi, '<url>')
    .replace(/(?:[A-Za-z]:)?\/[\w./-]+/g, '<path>')
    .replace(/\b[0-9a-f]{8,}\b/gi, '<hex>')
    .replace(/\b\d+\b/g, '<n>')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, limit);
}

function displayText(value, limit = 220) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length <= limit ? text : text.slice(0, limit - 3) + '...';
}

function lessonFiles(lesson) {
  return [...new Set([
    ...(Array.isArray(lesson?.files) ? lesson.files : []),
    ...(Array.isArray(lesson?.evidence?.filesTouched) ? lesson.evidence.filesTouched : [])
  ].map(slash).filter(Boolean))];
}

function lessonMatchesProject(lesson, filter) {
  if (!filter) return true;
  const project = String(lesson?.project || lesson?.projectId || '').toLowerCase();
  if (project && (project === filter.id || project === filter.root.toLowerCase())) return true;
  const cwd = String(lesson?.evidence?.cwd || '').toLowerCase();
  return cwd === filter.root.toLowerCase() || cwd.startsWith(filter.root.toLowerCase() + path.sep);
}

function effectiveCount(lesson) {
  const count = Number(lesson?.occurrences || 1);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 1;
}

function signalEntries(lesson) {
  const entries = [];
  const add = (type, raw, label) => {
    const value = canonicalText(raw);
    if (!value || value.length < 3) return;
    entries.push({ type, value, label: displayText(label || raw) });
  };

  add('error_signature', lesson.errorSignature, lesson.errorSignature);
  add('error_text', lesson.evidence?.outputExcerpt || lesson.symptoms?.[0], lesson.evidence?.outputExcerpt || lesson.symptoms?.[0]);
  add('command', lesson.evidence?.command, lesson.evidence?.command);
  add('root_cause', lesson.rootCause, lesson.rootCause);
  for (const fix of Array.isArray(lesson.fixRecipe) ? lesson.fixRecipe : []) add('fix', fix, fix);
  for (const file of lessonFiles(lesson)) add('file', file, file);
  if (lesson.agent && lesson.errorSignature) {
    add('agent_signature', `${lesson.agent}\n${lesson.errorSignature}`, `${lesson.agent}: ${lesson.errorSignature}`);
  }
  return entries;
}

function stablePatternId(type, value) {
  const hash = crypto.createHash('sha256').update(`${type}\n${value}`).digest('hex').slice(0, 14);
  return `failure_pattern_${type}_${hash}`;
}

function evidenceReference(lesson) {
  return {
    lessonId: lesson.id,
    occurrences: effectiveCount(lesson),
    project: lesson.project || lesson.projectId || null,
    agent: lesson.agent || null,
    files: lessonFiles(lesson),
    command: displayText(lesson.evidence?.command, 300) || null,
    firstSeenAt: lesson.firstSeenAt || lesson.createdAt || null,
    lastSeenAt: lesson.lastSeenAt || lesson.updatedAt || lesson.createdAt || null
  };
}

function detectPatterns(flags = {}) {
  const minCount = Math.max(2, Math.min(Number(flags['min-count'] || flags.minCount || DEFAULT_MIN_COUNT), 100000));
  const filter = projectFilter(flags);
  const lessons = loadLessons()
    .filter((lesson) => lesson && !['rejected', 'archived'].includes(lesson.status))
    .filter((lesson) => lessonMatchesProject(lesson, filter));
  const buckets = new Map();

  for (const lesson of lessons) {
    for (const signal of signalEntries(lesson)) {
      const id = stablePatternId(signal.type, signal.value);
      const current = buckets.get(id) || {
        id,
        signalType: signal.type,
        signalValue: signal.value,
        label: signal.label,
        occurrenceCount: 0,
        lessonCount: 0,
        evidence: [],
        agents: [],
        projects: [],
        files: [],
        firstSeenAt: null,
        lastSeenAt: null
      };
      const reference = evidenceReference(lesson);
      current.occurrenceCount += reference.occurrences;
      current.lessonCount += 1;
      current.evidence.push(reference);
      current.agents.push(reference.agent);
      current.projects.push(reference.project);
      current.files.push(...reference.files);
      const first = reference.firstSeenAt;
      const last = reference.lastSeenAt;
      if (first && (!current.firstSeenAt || first < current.firstSeenAt)) current.firstSeenAt = first;
      if (last && (!current.lastSeenAt || last > current.lastSeenAt)) current.lastSeenAt = last;
      buckets.set(id, current);
    }
  }

  const decisions = loadDecisions();
  const detectedAt = nowIso();
  const patterns = [...buckets.values()]
    .filter((pattern) => pattern.occurrenceCount >= minCount)
    .map((pattern) => {
      const decision = decisions.patterns[pattern.id] || {};
      const agents = [...new Set(pattern.agents.filter(Boolean))].sort();
      const projects = [...new Set(pattern.projects.filter(Boolean))].sort();
      const files = [...new Set(pattern.files.filter(Boolean))].sort();
      const confidence = Math.min(1, 0.35 + Math.log2(pattern.occurrenceCount) * 0.12 + (pattern.lessonCount > 1 ? 0.18 : 0));
      return {
        id: pattern.id,
        status: decision.status || 'detected',
        signalType: pattern.signalType,
        label: pattern.label,
        occurrenceCount: pattern.occurrenceCount,
        lessonCount: pattern.lessonCount,
        evidence: pattern.evidence.sort((a, b) => String(a.lastSeenAt || '').localeCompare(String(b.lastSeenAt || ''))),
        evidenceReferences: pattern.evidence.map((item) => item.lessonId),
        agents,
        projects,
        files,
        firstSeenAt: pattern.firstSeenAt,
        lastSeenAt: pattern.lastSeenAt,
        detectedAt,
        confidence: Number(confidence.toFixed(3)),
        score: (SIGNAL_WEIGHTS[pattern.signalType] || 50) + pattern.occurrenceCount * 5 + Math.max(0, pattern.lessonCount - 1) * 10,
        rejectionReason: decision.reason || null,
        next: `agent-kernel failure propose-pattern ${pattern.id} --as rule`
      };
    })
    .sort((a, b) => b.score - a.score || b.occurrenceCount - a.occurrenceCount || a.id.localeCompare(b.id));

  const result = {
    version: 1,
    generatedAt: detectedAt,
    minCount,
    project: filter ? { id: filter.id, root: slash(filter.root) } : null,
    lessonCount: lessons.length,
    patternCount: patterns.length,
    patterns
  };
  writeJsonAtomic(storePaths().patterns, result);
  return result;
}

function findPattern(result, wanted) {
  const exact = result.patterns.find((pattern) => pattern.id === wanted);
  if (exact) return exact;
  const matches = result.patterns.filter((pattern) => pattern.id.includes(wanted));
  if (matches.length > 1) throw new Error(`Pattern id is ambiguous: ${wanted}`);
  return matches[0] || null;
}

function setDecision(flags, status) {
  const wanted = String(flags.reject || flags.restore || flags._[0] || '').trim();
  if (!wanted) throw new Error(`Pattern id is required for --${status === 'rejected' ? 'reject' : 'restore'}`);
  const result = detectPatterns({ ...flags, 'include-rejected': true });
  const pattern = findPattern(result, wanted);
  if (!pattern) throw new Error(`Failure pattern not found: ${wanted}`);
  const decisions = loadDecisions();
  if (status === 'rejected') {
    decisions.patterns[pattern.id] = {
      status: 'rejected',
      reason: String(flags.reason || 'Rejected as a false positive.'),
      decidedAt: nowIso()
    };
  } else {
    delete decisions.patterns[pattern.id];
  }
  saveDecisions(decisions);
  const next = detectPatterns({ ...flags, 'include-rejected': true });
  const updated = findPattern(next, pattern.id);
  if (flags.json) process.stdout.write(JSON.stringify(updated, null, 2) + '\n');
  else process.stdout.write(`${updated.status === 'rejected' ? 'Rejected' : 'Restored'} failure pattern: ${updated.id}\n`);
}

function printPattern(pattern) {
  process.stdout.write(`[${pattern.id}] ${pattern.status} ${pattern.signalType}\n`);
  process.stdout.write(`Signal: ${pattern.label}\n`);
  process.stdout.write(`Occurrences: ${pattern.occurrenceCount} across ${pattern.lessonCount} lesson(s)\n`);
  process.stdout.write(`Evidence: ${pattern.evidenceReferences.join(', ')}\n`);
  if (pattern.files.length) process.stdout.write(`Files: ${pattern.files.join(', ')}\n`);
  if (pattern.agents.length) process.stdout.write(`Agents: ${pattern.agents.join(', ')}\n`);
  process.stdout.write(`Next: ${pattern.next}\n\n`);
}

function commandPatterns(flags) {
  if (flags.reject) return setDecision(flags, 'rejected');
  if (flags.restore) return setDecision(flags, 'detected');
  const result = detectPatterns(flags);
  let patterns = result.patterns;
  if (!flags['include-rejected']) patterns = patterns.filter((pattern) => pattern.status !== 'rejected');
  if (flags.show) {
    const pattern = findPattern({ ...result, patterns }, String(flags.show));
    if (!pattern) throw new Error(`Failure pattern not found: ${flags.show}`);
    if (flags.json) process.stdout.write(JSON.stringify(pattern, null, 2) + '\n');
    else printPattern(pattern);
    return;
  }
  const output = { ...result, patternCount: patterns.length, patterns };
  if (flags.json) process.stdout.write(JSON.stringify(output, null, 2) + '\n');
  else if (!patterns.length) process.stdout.write(`No recurring failure patterns found at min-count ${result.minCount}\n`);
  else patterns.forEach(printPattern);
}

function usage() {
  process.stdout.write(`agent-kernel-failure-patterns ${VERSION}\n\nUsage:\n  agent-kernel failure patterns [--min-count 3] [--project .] [--json]\n  agent-kernel failure patterns --show <pattern-id> [--json]\n  agent-kernel failure patterns --reject <pattern-id> [--reason text]\n  agent-kernel failure patterns --restore <pattern-id>\n  agent-kernel failure patterns --include-rejected [--json]\n\nDetection is deterministic and local. Rejection only hides a pattern from the default view; it does not delete Failure Lessons.\n`);
}

function main() {
  const args = process.argv.slice(2);
  if (args[0] === 'failure') args.shift();
  if (args[0] === 'patterns') args.shift();
  const flags = parseFlags(args);
  if (flags.help || flags.h) return usage();
  commandPatterns(flags);
}

try { main(); }
catch (error) {
  process.stderr.write(`${error?.message || String(error)}\n`);
  process.exitCode = 1;
}
