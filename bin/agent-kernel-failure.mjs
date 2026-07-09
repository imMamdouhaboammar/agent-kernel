#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import childProcess from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const TEXT_LIMIT = 120000;
const EXCERPT_LIMIT = 4000;

function print(message = '') {
  process.stdout.write(String(message) + '\n');
}

function fail(message, code = 1) {
  process.stderr.write(String(message) + '\n');
  process.exitCode = code;
}

function parseArgs(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const raw = arg.slice(2);
      const eq = raw.indexOf('=');
      if (eq >= 0) flags[raw.slice(0, eq)] = raw.slice(eq + 1);
      else {
        const next = argv[i + 1];
        if (next && !next.startsWith('-')) { flags[raw] = next; i++; }
        else flags[raw] = true;
      }
    } else {
      flags._.push(arg);
    }
  }
  return flags;
}

function readStdin() {
  try {
    if (process.stdin.isTTY) return '';
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function ensureDir(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function readJson(targetPath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(targetPath, value) {
  ensureDir(path.dirname(targetPath));
  fs.writeFileSync(targetPath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function nowIso() {
  return new Date().toISOString();
}

function homeDir() {
  return process.env.AGENT_KERNEL_HOME || path.join(os.homedir(), '.agent-kernel');
}

function paths() {
  const root = homeDir();
  return {
    root,
    failuresDir: path.join(root, 'source', 'failures'),
    lessons: path.join(root, 'source', 'failures', 'failure-lessons.json'),
    logs: path.join(root, 'logs', 'failures.jsonl')
  };
}

function lessonId() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  return `failure_lesson_${stamp}_${crypto.randomBytes(3).toString('hex')}`;
}

function csv(value) {
  if (Array.isArray(value)) return value.map(String).map(s => s.trim()).filter(Boolean);
  return String(value || '').split(',').map(s => s.trim()).filter(Boolean);
}

function compact(value, limit = EXCERPT_LIMIT) {
  return String(value || '').replace(/\r/g, '').trim().slice(0, limit);
}

function logLine(value) {
  const p = paths();
  ensureDir(path.dirname(p.logs));
  fs.appendFileSync(p.logs, JSON.stringify({ at: nowIso(), ...value }) + '\n');
}

function loadLessons() {
  const p = paths();
  ensureDir(p.failuresDir);
  const value = readJson(p.lessons, []);
  return Array.isArray(value) ? value : [];
}

function saveLessons(lessons) {
  writeJson(paths().lessons, lessons);
}

function secretRisk(text) {
  const checks = [
    /OPENAI_API_KEY\s*=\s*["'][^"']+["']/i,
    /ANTHROPIC_API_KEY\s*=\s*["'][^"']+["']/i,
    /SUPABASE_SERVICE_ROLE_KEY\s*=\s*["'][^"']+["']/i,
    /AIza[0-9A-Za-z_-]{35}/,
    /sk-[A-Za-z0-9]{20,}/,
    /ghp_[A-Za-z0-9]{20,}/
  ];
  return checks.some(re => re.test(String(text || '')));
}

function inferSignature(text) {
  const s = String(text || '');
  const code = s.match(/\b(?:ERR_[A-Z0-9_]+|E[A-Z0-9_]{3,}|TS\d{4}|MODULE_NOT_FOUND|ReferenceError|TypeError|SyntaxError)\b/);
  if (code) return code[0];
  const first = s.split('\n').map(x => x.trim()).find(Boolean);
  return first ? first.slice(0, 120) : 'unknown-failure';
}

function inferSymptoms(text) {
  return String(text || '')
    .split('\n')
    .map(x => x.trim())
    .filter(Boolean)
    .slice(0, 4)
    .map(x => x.slice(0, 180));
}\n
function normalizeStatus(value) {
  const status = String(value || 'captured');
  return ['captured', 'proposed', 'approved', 'rejected', 'archived'].includes(status) ? status : 'captured';
}

function buildLesson(flags, text) {
  const raw = compact(text, TEXT_LIMIT);
  if (!raw && !flags.signature && !flags['root-cause'] && !flags.fix && !flags['fixed-by']) {
    throw new Error('Failure text, signature, root cause, or fix evidence is required.');
  }
  if (secretRisk(raw) || secretRisk(flags.fix) || secretRisk(flags['fixed-by'])) {
    throw new Error('Refusing to store failure evidence because it appears to contain a secret. Redact it first.');
  }

  const signature = compact(flags.signature || inferSignature(raw), 180);
  const fixRecipe = csv(flags.fix || flags['fixed-by']);
  const symptoms = csv(flags.symptoms);
  const now = nowIso();
  return {
    id: flags.id || lessonId(),
    status: normalizeStatus(flags.status),
    scope: String(flags.scope || 'global'),
    project: String(flags.project || path.basename(process.cwd()) || ''),
    agent: String(flags.from || flags.agent || 'unknown-agent'),
    failureType: String(flags.type || flags['failure-type'] || 'coding-failure'),
    errorSignature: signature,
    symptoms: symptoms.length ? symptoms : inferSymptoms(raw),
    rootCause: compact(flags['root-cause'] || flags.cause || '', 1000),
    fixRecipe,
    preventionRule: compact(flags.rule || flags['prevention-rule'] || '', 1000),
    evidence: {
      command: compact(flags.command || '', 600),
      exitCode: flags['exit-code'] === undefined ? null : Number(flags['exit-code']),
      cwd: process.cwd(),
      filesTouched: csv(flags.files || flags['files-touched']),
      outputExcerpt: raw.slice(0, EXCERPT_LIMIT)
    },
    promoteTo: csv(flags['promote-to'] || flags.promote || 'rule'),
    targets: csv(flags.targets || 'all'),
    tags: csv(flags.tags || [String(flags.type || 'coding-failure'), signature.toLowerCase()].join(',')),
    createdAt: now,
    updatedAt: now,
    version: 1
  };
}

function findLesson(wanted) {
  const lessons = loadLessons();
  const exact = lessons.find(x => x.id === wanted);
  if (exact) return { lessons, lesson: exact };
  const matches = lessons.filter(x => x.id.includes(wanted) || x.errorSignature === wanted);
  if (matches.length === 1) return { lessons, lesson: matches[0] };
  return { lessons, lesson: null, matches };
}

function formatLesson(lesson) {
  return [
    `[${lesson.id}] ${lesson.status} ${lesson.failureType}`,
    `Signature: ${lesson.errorSignature}`,
    `Agent: ${lesson.agent}`,
    `Project: ${lesson.project}`,
    `Root cause: ${lesson.rootCause || 'not provided'}`,
    `Fix: ${(lesson.fixRecipe || []).join(' | ') || 'not provided'}`,
    `Rule: ${lesson.preventionRule || 'not provided'}`
  ].join('\n');
}

function buildProposalText(lesson, asType) {
  const lines = [];
  lines.push(`Failure lesson: ${lesson.errorSignature}`);
  lines.push('');
  if (lesson.symptoms?.length) {
    lines.push('Symptoms:');
    for (const s of lesson.symptoms) lines.push(`- ${s}`);
    lines.push('');
  }
  if (lesson.rootCause) {
    lines.push(`Root cause: ${lesson.rootCause}`);
    lines.push('');
  }
  if (lesson.fixRecipe?.length) {
    lines.push('Fix recipe:');
    lesson.fixRecipe.forEach((step, index) => lines.push(`${index + 1}. ${step}`));
    lines.push('');
  }
  if (lesson.preventionRule) {
    lines.push(`Prevention rule: ${lesson.preventionRule}`);
  } else if (asType === 'rule') {
    lines.push(`Prevention rule: Before fixing a similar ${lesson.failureType}, search Agent Kernel failure lessons for ${lesson.errorSignature}.`);
  }
  lines.push('');
  lines.push('When this pattern appears again, search failure lessons first, apply the known fix path, then verify with the same failing command or test.');
  return lines.join('\n').slice(0, 1900);
}

function proposalType(value) {
  const raw = String(value || 'rule');
  const map = {
    rule: 'rule',
    policy: 'policy',
    workflow: 'workflow',
    note: 'project-note',
    'project-note': 'project-note',
    skill: 'skill-trigger',
    'skill-trigger': 'skill-trigger'
  };
  return map[raw] || 'rule';
}

function proposeCommand() {
  const local = path.resolve(here, 'agent-kernel-agent-propose.mjs');
  if (fs.existsSync(local)) return [process.execPath, local];
  return ['agent-kernel-agent-propose'];
}

function createProposal(lesson, flags) {
  const type = proposalType(flags.as || flags.to || lesson.promoteTo?.[0] || 'rule');
  const [cmd, ...baseArgs] = proposeCommand();
  const args = [
    ...baseArgs,
    '--from', flags.from || lesson.agent || 'failure-lessons',
    '--type', type,
    '--scope', flags.scope || lesson.scope || 'global',
    '--level', flags.level || (type === 'policy' ? 'critical' : 'standard'),
    '--targets', flags.targets || (lesson.targets || ['all']).join(','),
    '--tags', flags.tags || [...(lesson.tags || []), 'failure-lesson'].join(','),
    '--reason', flags.reason || `Captured from failure lesson ${lesson.id}.`,
    '--text', buildProposalText(lesson, type)
  ];
  const result = childProcess.spawnSync(cmd, args, { encoding: 'utf8', env: process.env, cwd: process.cwd() });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `proposal command failed with status ${result.status}`).trim());
  }
  return result.stdout.trim();
}

function commandCapture(flags, text) {
  let lesson;
  try {
    lesson = buildLesson(flags, text);
  } catch (err) {
    fail(err.message);
    return null;
  }
  const lessons = loadLessons();
  lessons.push(lesson);
  saveLessons(lessons);
  logLine({ action: 'capture', id: lesson.id, signature: lesson.errorSignature, agent: lesson.agent });
  if (flags.json) print(JSON.stringify(lesson, null, 2));
  else {
    print(`Captured failure lesson: ${lesson.id}`);
    print(`Signature: ${lesson.errorSignature}`);
    print(`Next: agent-kernel failure propose ${lesson.id} --as rule`);
  }
  return lesson;
}

function commandList(flags) {
  let lessons = loadLessons();
  if (flags.status) lessons = lessons.filter(x => x.status === flags.status);
  if (flags.type) lessons = lessons.filter(x => x.failureType === flags.type);
  lessons = lessons.slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const limit = Math.max(1, Math.min(Number(flags.limit || lessons.length || 20), 200));
  lessons = lessons.slice(0, limit);
  if (flags.json) print(JSON.stringify(lessons, null, 2));
  else if (!lessons.length) print('No failure lessons found.');
  else for (const lesson of lessons) print(`${formatLesson(lesson)}\n`);
}

function commandSearch(flags, query) {
  const q = String(flags.query || query || '').toLowerCase();
  if (!q) { fail('Usage: agent-kernel failure search <query>'); return; }
  const lessons = loadLessons().filter(lesson => JSON.stringify(lesson).toLowerCase().includes(q));
  if (flags.json) print(JSON.stringify(lessons, null, 2));
  else if (!lessons.length) print('No matching failure lessons.');
  else for (const lesson of lessons) print(`${formatLesson(lesson)}\n`);
}

function commandShow(flags, wanted) {
  if (!wanted) { fail('Usage: agent-kernel failure show <id>'); return; }
  const { lesson, matches } = findLesson(wanted);
  if (!lesson) {
    if (matches?.length) fail(`Ambiguous failure lesson id: ${wanted}`);
    else fail(`Failure lesson not found: ${wanted}`);
    return;
  }
  if (flags.markdown) print(formatLesson(lesson));
  else print(JSON.stringify(lesson, null, 2));
}

function commandPropose(flags, wanted) {
  if (!wanted) { fail('Usage: agent-kernel failure propose <id> [--as rule|policy|workflow|skill]'); return; }
  const { lessons, lesson } = findLesson(wanted);
  if (!lesson) { fail(`Failure lesson not found: ${wanted}`); return; }
  try {
    const output = createProposal(lesson, flags);
    lesson.status = 'proposed';
    lesson.proposedAt = nowIso();
    lesson.proposedMemoryType = proposalType(flags.as || flags.to || lesson.promoteTo?.[0] || 'rule');
    lesson.updatedAt = nowIso();
    saveLessons(lessons);
    logLine({ action: 'propose', id: lesson.id, memoryType: lesson.proposedMemoryType });
    print(output);
  } catch (err) {
    fail(err.message);
  }
}

function usage() {
  print(`agent-kernel failure\n\nUsage:\n  agent-kernel failure capture --from claude --type test-failure --command \"npm test\" --exit-code 1 --text \"<error>\"\n  cat error.log | agent-kernel failure capture --from codex --type build-failure --command \"npm run build\"\n  agent-kernel failure learn --from claude --text \"<error>\" --root-cause \"...\" --fix \"...\" --as rule\n  agent-kernel failure list [--status captured] [--json]\n  agent-kernel failure search \"ERR_MODULE_NOT_FOUND\"\n  agent-kernel failure show <id>\n  agent-kernel failure propose <id> --as rule\n\nFailure lessons are captured locally first. Promotion creates a pending memory proposal. Approval remains user-controlled.`);
}

function main() {
  const [action = 'help', ...rest] = process.argv.slice(2);
  const flags = parseArgs(rest);
  const inlineText = flags.text || flags.error || flags.output || flags._.join(' ');
  const text = inlineText || readStdin();

  if (action === 'help' || action === '--help' || action === '-h') return usage();
  if (action === 'capture') return commandCapture(flags, text);
  if (action === 'learn') {
    const lesson = commandCapture(flags, text);
    if (lesson && !process.exitCode) commandPropose(flags, lesson.id);
    return;
  }
  if (action === 'list') return commandList(flags);
  if (action === 'search') return commandSearch(flags, flags._.join(' '));
  if (action === 'show') return commandShow(flags, flags._[0]);
  if (action === 'propose' || action === 'promote') return commandPropose(flags, flags._[0]);
  fail(`Unknown failure command: ${action}`);
  usage();
}

main();
