#!/usr/bin/env node
import childProcess from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const VERSION = '1.16.0';
const FILE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const INDEX_VERSION = 1;
const DEFAULT_BUDGET = 2400;
const MAX_BUDGET = 20000;
const HOOK_START = '# agent-kernel:commit-link:start';
const HOOK_END = '# agent-kernel:commit-link:end';

function kernelHome() {
  return process.env.AGENT_KERNEL_HOME || path.join(os.homedir(), '.agent-kernel');
}

function nowIso() {
  return new Date().toISOString();
}

function exists(filePath) {
  try { fs.accessSync(filePath); return true; } catch { return false; }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readText(filePath, fallback = '') {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return fallback; }
}

function readJson(filePath, fallback) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return fallback; }
}

function writeTextAtomic(filePath, text) {
  ensureDir(path.dirname(filePath));
  const temporary = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporary, text, 'utf8');
  fs.renameSync(temporary, filePath);
}

function writeJsonAtomic(filePath, value) {
  writeTextAtomic(filePath, JSON.stringify(value, null, 2) + '\n');
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

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function collectStrings(...values) {
  const out = [];
  const add = (value) => {
    if (Array.isArray(value)) value.forEach(add);
    else if (typeof value === 'string') value.split(',').forEach((item) => {
      const trimmed = item.trim();
      if (trimmed) out.push(trimmed);
    });
  };
  values.forEach(add);
  return unique(out);
}

function slash(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function runGit(cwd, args, options = {}) {
  return childProcess.execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', options.quiet ? 'ignore' : 'pipe']
  }).trim();
}

function gitRoot(project = '.') {
  const resolved = path.resolve(project);
  try { return runGit(resolved, ['rev-parse', '--show-toplevel'], { quiet: true }); }
  catch { throw new Error(`Not a git repository: ${resolved}`); }
}

function projectIdFrom(root) {
  return path.basename(root) || 'project';
}

function commitMetadata(root, requestedSha) {
  let sha;
  try { sha = runGit(root, ['rev-parse', '--verify', `${requestedSha}^{commit}`], { quiet: true }); }
  catch { throw new Error(`Commit not found in local repository: ${requestedSha}`); }
  const raw = runGit(root, ['show', '-s', '--format=%H%x00%h%x00%aI%x00%s', sha]);
  const [fullSha, shortSha, committedAt, subject] = raw.split('\u0000');
  return { sha: fullSha, shortSha, committedAt, subject };
}

function storePaths() {
  const home = kernelHome();
  return {
    home,
    runtime: path.join(home, 'runtime'),
    commits: path.join(home, 'runtime', 'commits'),
    index: path.join(home, 'runtime', 'commits', 'index.json'),
    sessions: path.join(home, 'runtime', 'sessions'),
    failures: path.join(home, 'source', 'failures', 'failure-lessons.json'),
    episodes: path.join(home, 'episodes', 'archive'),
    episodeIndex: path.join(home, 'episodes', 'index.json')
  };
}

function emptyIndex() {
  return { version: INDEX_VERSION, updatedAt: null, commits: {} };
}

function readIndex() {
  const value = readJson(storePaths().index, emptyIndex());
  if (!value || typeof value !== 'object') return emptyIndex();
  return {
    version: Number(value.version || INDEX_VERSION),
    updatedAt: value.updatedAt || null,
    commits: value.commits && typeof value.commits === 'object' ? value.commits : {}
  };
}

function writeIndex(index) {
  index.version = INDEX_VERSION;
  index.updatedAt = nowIso();
  writeJsonAtomic(storePaths().index, index);
}

function requireSafeSessionId(value) {
  const id = String(value || '').trim();
  if (!FILE_ID_PATTERN.test(id) || id === '.' || id === '..') {
    throw new Error(`Invalid session ID: ${id || '(empty)'}`);
  }
  return id;
}

function sessionFile(id) {
  return path.join(storePaths().sessions, `${requireSafeSessionId(id)}.json`);
}

function sessionLogFile(id) {
  return path.join(storePaths().sessions, `${requireSafeSessionId(id)}.jsonl`);
}

function readSession(id) {
  return readJson(sessionFile(id), null);
}

function writeSession(session) {
  writeJsonAtomic(sessionFile(session.id), session);
}

function readSessionObservations(id) {
  const raw = readText(sessionLogFile(id), '').trim();
  if (!raw) return [];
  return raw.split(/\r?\n/).map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
}

function sessionFiles(id) {
  const values = [];
  for (const observation of readSessionObservations(id)) {
    for (const file of Array.isArray(observation.files) ? observation.files : []) {
      const normalized = slash(file);
      if (normalized) values.push(normalized);
    }
  }
  return unique(values);
}

function findRecord(index, requested) {
  const wanted = String(requested || '').trim();
  if (!wanted) return null;
  if (index.commits[wanted]) return index.commits[wanted];
  const matches = Object.values(index.commits).filter((record) => record.sha.startsWith(wanted));
  if (matches.length > 1) throw new Error(`Commit prefix is ambiguous: ${wanted}`);
  return matches[0] || null;
}

function mergeUnique(existing, incoming) {
  return unique([...(Array.isArray(existing) ? existing : []), ...incoming]);
}

function commandLink(flags) {
  const requestedSha = String(flags.sha || flags._[0] || '').trim();
  if (!requestedSha) throw new Error('Usage: agent-kernel commit link --sha <sha> [--session id] [--failure id] [--episode id] [--files a,b]');

  const root = gitRoot(flags.project || flags.cwd || '.');
  const metadata = commitMetadata(root, requestedSha);
  const sessionIds = collectStrings(flags.session, flags.sessions);
  const failureIds = collectStrings(flags.failure, flags.failures);
  const episodeIds = collectStrings(flags.episode, flags.episodes);
  const explicitFiles = collectStrings(flags.file, flags.files).map(slash);

  if (!sessionIds.length && !failureIds.length && !episodeIds.length && !explicitFiles.length) {
    throw new Error('At least one relationship is required: --session, --failure, --episode, or --file/--files');
  }

  const sessions = [];
  for (const id of sessionIds) {
    const session = readSession(id);
    if (!session) throw new Error(`Session not found: ${id}`);
    sessions.push(session);
  }

  const inheritedFailures = sessions.flatMap((session) => Array.isArray(session.linkedFailures) ? session.linkedFailures : []);
  const inheritedEpisodes = sessions.flatMap((session) => Array.isArray(session.linkedEpisodes) ? session.linkedEpisodes : []);
  const inheritedFiles = sessions.flatMap((session) => sessionFiles(session.id));

  const index = readIndex();
  const previous = index.commits[metadata.sha];
  const timestamp = nowIso();
  const next = {
    sha: metadata.sha,
    shortSha: metadata.shortSha,
    subject: metadata.subject,
    committedAt: metadata.committedAt,
    projectId: String(flags['project-id'] || flags.projectId || previous?.projectId || sessions[0]?.projectId || projectIdFrom(root)),
    projectRoot: slash(root),
    sessions: mergeUnique(previous?.sessions, sessionIds),
    failures: mergeUnique(previous?.failures, [...failureIds, ...inheritedFailures]),
    episodes: mergeUnique(previous?.episodes, [...episodeIds, ...inheritedEpisodes]),
    files: mergeUnique(previous?.files, [...explicitFiles, ...inheritedFiles]),
    createdAt: previous?.createdAt || timestamp,
    updatedAt: timestamp
  };

  const changed = JSON.stringify(previous || null) !== JSON.stringify(next);
  index.commits[metadata.sha] = next;
  writeIndex(index);

  for (const session of sessions) {
    const linkedCommits = mergeUnique(session.linkedCommits, [metadata.sha]);
    if (JSON.stringify(linkedCommits) !== JSON.stringify(session.linkedCommits || [])) {
      writeSession({ ...session, linkedCommits, updatedAt: timestamp });
    }
  }

  const result = { ok: true, changed, commit: next };
  if (flags.json) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  else process.stdout.write(`${changed ? 'Linked' : 'Already linked'} ${metadata.shortSha}: ${next.sessions.length} session(s), ${next.failures.length} failure(s), ${next.episodes.length} episode(s), ${next.files.length} file(s)\n`);
}

function sortedRecords(index) {
  return Object.values(index.commits).sort((a, b) => String(b.committedAt || b.updatedAt || '').localeCompare(String(a.committedAt || a.updatedAt || '')));
}

function commandList(flags) {
  const commits = sortedRecords(readIndex());
  if (flags.json) {
    process.stdout.write(JSON.stringify({ commits }, null, 2) + '\n');
    return;
  }
  if (!commits.length) {
    process.stdout.write('No commit links found\n');
    return;
  }
  for (const record of commits) {
    process.stdout.write(`${record.shortSha || record.sha.slice(0, 7)}\t${record.projectId || '-'}\t${record.sessions.length}\t${record.subject || ''}\n`);
  }
}

function commandShow(flags) {
  const requested = String(flags._[0] || flags.sha || '').trim();
  if (!requested) throw new Error('Usage: agent-kernel commit show <sha>');
  const record = findRecord(readIndex(), requested);
  if (!record) throw new Error(`Commit link not found: ${requested}`);
  if (flags.json) process.stdout.write(JSON.stringify(record, null, 2) + '\n');
  else {
    process.stdout.write(`Commit: ${record.sha}\n`);
    process.stdout.write(`Subject: ${record.subject || ''}\n`);
    process.stdout.write(`Project: ${record.projectId || ''}\n`);
    process.stdout.write(`Sessions: ${(record.sessions || []).join(', ') || 'none'}\n`);
    process.stdout.write(`Failures: ${(record.failures || []).join(', ') || 'none'}\n`);
    process.stdout.write(`Episodes: ${(record.episodes || []).join(', ') || 'none'}\n`);
    process.stdout.write(`Files: ${(record.files || []).join(', ') || 'none'}\n`);
  }
}

function loadFailures(ids) {
  const values = readJson(storePaths().failures, []);
  if (!Array.isArray(values)) return [];
  const wanted = new Set(ids);
  return values.filter((item) => item && item.status !== 'rejected' && wanted.has(item.id));
}

function loadEpisodeArchive() {
  const p = storePaths();
  if (exists(p.episodes)) {
    return fs.readdirSync(p.episodes).sort()
      .filter((name) => name.endsWith('.json'))
      .map((name) => readJson(path.join(p.episodes, name), null))
      .filter(Boolean);
  }
  const index = readJson(p.episodeIndex, { episodes: [] });
  return Array.isArray(index) ? index : (Array.isArray(index?.episodes) ? index.episodes : []);
}

function loadEpisodes(ids) {
  const wanted = new Set(ids);
  return loadEpisodeArchive().filter((item) => item && item.status !== 'rejected' && wanted.has(item.id));
}

function compact(value, limit = 500) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length <= limit ? text : text.slice(0, Math.max(0, limit - 3)) + '...';
}

function contextLine(kind, item) {
  if (kind === 'sessions') return `- ${item.id}: ${item.agentId || 'unknown-agent'} ${item.status || ''} ${item.summary || ''}`.trim();
  if (kind === 'failures') return `- ${item.id}: ${compact(item.errorSignature || item.title || 'failure', 160)} | ${compact(item.rootCause || item.preventionRule || item.fix || item.text, 500)}`;
  if (kind === 'episodes') return `- ${item.id}: ${compact(item.title, 180)} | ${compact(item.summary || item.text, 500)}`;
  if (kind === 'files') return `- ${item}`;
  return `- ${compact(JSON.stringify(item), 500)}`;
}

function renderContext(record, sections, budget) {
  const groups = [
    ['sessions', 'Sessions'],
    ['failures', 'Failure Lessons'],
    ['episodes', 'Episodes'],
    ['files', 'Files']
  ];
  let output = `# Commit ${record.shortSha || record.sha.slice(0, 7)}\n${compact(record.subject, 300)}`;
  const included = { sessions: [], failures: [], episodes: [], files: [] };
  const append = (text) => {
    const next = `${output}\n${text}`;
    if (next.length > budget) {
      const available = budget - output.length - 1;
      if (available > 0) output += '\n' + text.slice(0, available);
      return false;
    }
    output = next;
    return true;
  };

  for (const [key, title] of groups) {
    const items = sections[key] || [];
    if (!items.length) continue;
    if (!append(`\n## ${title}`)) break;
    for (const item of items) {
      const complete = append(contextLine(key, item));
      included[key].push(item);
      if (!complete) break;
    }
    if (output.length >= budget) break;
  }
  return { context: output.slice(0, budget), sections: included };
}

function commandContext(flags) {
  const requested = String(flags._[0] || flags.sha || '').trim();
  if (!requested) throw new Error('Usage: agent-kernel commit context <sha> [--budget 2400] [--json]');
  const record = findRecord(readIndex(), requested);
  if (!record) throw new Error(`Commit link not found: ${requested}`);
  const budget = Math.max(200, Math.min(Number(flags.budget || DEFAULT_BUDGET), MAX_BUDGET));
  const sessions = (record.sessions || []).map(readSession).filter(Boolean);
  const linkedFailures = mergeUnique(record.failures, sessions.flatMap((session) => session.linkedFailures || []));
  const linkedEpisodes = mergeUnique(record.episodes, sessions.flatMap((session) => session.linkedEpisodes || []));
  const files = mergeUnique(record.files, sessions.flatMap((session) => sessionFiles(session.id)));
  const allSections = {
    sessions,
    failures: loadFailures(linkedFailures),
    episodes: loadEpisodes(linkedEpisodes),
    files
  };
  const rendered = renderContext(record, allSections, budget);
  const result = {
    version: VERSION,
    commit: record,
    budget,
    budgetUsed: rendered.context.length,
    context: rendered.context,
    sections: rendered.sections,
    counts: Object.fromEntries(Object.entries(allSections).map(([key, value]) => [key, value.length]))
  };
  if (flags.json) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  else process.stdout.write(result.context + '\n');
}

function hookBlock() {
  return `${HOOK_START}\nif [ -n "\${AGENT_KERNEL_SESSION_ID:-}" ]; then\n  agent_kernel_root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)\n  agent-kernel commit link --sha HEAD --session "$AGENT_KERNEL_SESSION_ID" --project "$agent_kernel_root" >/dev/null 2>&1 || true\nfi\n${HOOK_END}\n`;
}

function removeMarkedBlocks(existing) {
  let text = existing;
  while (true) {
    const start = text.indexOf(HOOK_START);
    if (start < 0) break;
    const end = text.indexOf(HOOK_END, start);
    if (end < 0) {
      text = text.slice(0, start);
      break;
    }
    const after = end + HOOK_END.length;
    text = text.slice(0, start) + text.slice(after).replace(/^\r?\n/, '');
  }
  return text.trimEnd();
}

function mergeHook(existing) {
  const cleaned = removeMarkedBlocks(existing);
  const base = cleaned || '#!/usr/bin/env sh';
  const withShebang = base.startsWith('#!') ? base : `#!/usr/bin/env sh\n${base}`;
  return `${withShebang.trimEnd()}\n\n${hookBlock()}`;
}

function hookPathFor(root) {
  const raw = runGit(root, ['rev-parse', '--git-path', 'hooks/post-commit']);
  return path.isAbsolute(raw) ? raw : path.resolve(root, raw);
}

function backupHook(hookPath, root) {
  if (!exists(hookPath)) return null;
  const dir = path.join(root, '.agent-kernel-backups');
  ensureDir(dir);
  const target = path.join(dir, `post-commit.${Date.now()}.bak`);
  fs.copyFileSync(hookPath, target);
  return target;
}

function commandHookInstall(flags) {
  const projectArg = flags.project || flags._[0] || '.';
  const root = gitRoot(projectArg);
  const hookPath = hookPathFor(root);
  const existing = readText(hookPath, '');
  const next = mergeHook(existing);
  const markerCount = existing.split(HOOK_START).length - 1;
  const action = !exists(hookPath) ? 'create' : markerCount ? 'replace-marked-block' : 'append-marked-block';
  const relative = slash(path.relative(root, hookPath));
  process.stdout.write(`${flags['dry-run'] || flags.dryRun ? 'Agent Kernel commit-link hook dry run' : 'Agent Kernel commit-link hook'}:\n- ${action}: ${relative}\n`);
  if (flags['dry-run'] || flags.dryRun) return;
  if (!flags['no-backup'] && !flags.noBackup && exists(hookPath)) backupHook(hookPath, root);
  writeTextAtomic(hookPath, next);
  fs.chmodSync(hookPath, 0o755);
  process.stdout.write(`Commit-link hook installed: ${hookPath}\n`);
}

function usage() {
  process.stdout.write(`agent-kernel-commit ${VERSION}\n\nUsage:\n  agent-kernel commit link --sha <sha> --session <session-id> [--failure id] [--episode id] [--files a,b] [--json]\n  agent-kernel commit list [--json]\n  agent-kernel commit show <sha> [--json]\n  agent-kernel commit context <sha> [--budget 2400] [--json]\n  agent-kernel git-hook install --commit-link [project] [--dry-run] [--no-backup]\n`);
}

function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === 'commit') argv.shift();
  if (argv[0] === 'git-hook') {
    argv.shift();
    const action = argv.shift();
    const flags = parseFlags(argv.filter((arg) => arg !== '--commit-link'));
    if (action === 'install') return commandHookInstall(flags);
    throw new Error('Usage: agent-kernel git-hook install --commit-link [project]');
  }
  const command = argv.shift();
  const flags = parseFlags(argv);
  if (!command || command === 'help' || command === '--help' || command === '-h') return usage();
  if (command === 'link') return commandLink(flags);
  if (command === 'list') return commandList(flags);
  if (command === 'show') return commandShow(flags);
  if (command === 'context') return commandContext(flags);
  throw new Error(`Unknown commit command: ${command}`);
}

try { main(); }
catch (error) {
  process.stderr.write(`${error?.message || String(error)}\n`);
  process.exitCode = 1;
}
