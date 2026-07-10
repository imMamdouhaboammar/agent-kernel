#!/usr/bin/env node
import childProcess from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { agentCan, agentIdFromRecord, enrichIdentityRecord, resolveAgentIdentity } from './agent-kernel-agent-model.mjs';
import { identifyProject } from './agent-kernel-project-model.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const distCliPath = path.resolve(here, '..', 'dist', 'cli.mjs');
const sessionPath = path.join(here, 'agent-kernel-session.mjs');
const searchPath = path.join(here, 'agent-kernel-search.mjs');

function kernelHome() {
  return process.env.AGENT_KERNEL_HOME || path.join(os.homedir(), '.agent-kernel');
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

function hasFlag(args, name) {
  return args.includes(name) || args.some((arg) => arg.startsWith(name + '='));
}

function flagValue(args, name, fallback = '') {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === name && args[i + 1] && !args[i + 1].startsWith('-')) return args[i + 1];
    if (args[i].startsWith(name + '=')) return args[i].slice(name.length + 1);
  }
  return fallback;
}

function stripFlag(args, name) {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === name) {
      if (args[i + 1] && !args[i + 1].startsWith('-')) i++;
      continue;
    }
    if (args[i].startsWith(name + '=')) continue;
    out.push(args[i]);
  }
  return out;
}

function runNode(script, args, options = {}) {
  const result = childProcess.spawnSync(process.execPath, [script, ...args], {
    cwd: options.cwd || process.cwd(),
    env: process.env,
    input: options.input,
    encoding: 'utf8',
    stdio: options.inherit ? 'inherit' : ['pipe', 'pipe', 'pipe']
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || `command failed with status ${result.status}`).trim());
  return result.stdout || '';
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

function proposalIdFrom(output) {
  return String(output || '').match(/Created pending memory proposal:\s*(\S+)/)?.[1] || '';
}

function commandPropose(args) {
  const requestedAgent = flagValue(args, '--from', flagValue(args, '--agent', 'user'));
  const identity = resolveAgentIdentity(requestedAgent, { action: 'propose' });
  if (!agentCan(identity, 'propose')) {
    throw new Error(`Agent ${identity.agentId} has trust level ${identity.trustLevel} and cannot create proposals. Configure its trust before retrying.`);
  }
  const output = runNode(distCliPath, ['propose', ...args]);
  const proposalId = proposalIdFrom(output);
  if (!proposalId) throw new Error(`Proposal was created but its id could not be parsed: ${output}`);
  const proposalPath = path.join(kernelHome(), 'inbox', 'pending', `${proposalId}.json`);
  const proposal = readJson(proposalPath, null);
  if (!proposal) throw new Error(`Pending proposal not found after creation: ${proposalId}`);
  const enriched = enrichIdentityRecord(proposal, identity, { fallback: requestedAgent });
  enriched.source = {
    ...(proposal.source || {}),
    proposedBy: proposal.source?.proposedBy || identity.agentId,
    createdBy: identity.agentId,
    agentId: identity.agentId,
    trustLevel: identity.trustLevel
  };
  writeJsonAtomic(proposalPath, enriched);
  process.stdout.write(output);
}

function sessionFile(id) {
  return path.join(kernelHome(), 'runtime', 'sessions', `${id}.json`);
}

function sessionLogFile(id) {
  return path.join(kernelHome(), 'runtime', 'sessions', `${id}.jsonl`);
}

function sessionIdFromOutput(output) {
  try { return JSON.parse(output).id || ''; } catch {}
  return String(output || '').match(/Started session\s+(\S+)/)?.[1] || '';
}

function commandSessionStart(args) {
  const flags = parseFlags(args);
  const requestedAgent = String(flags.agent || flags.from || flags._[0] || 'unknown-agent');
  const identity = resolveAgentIdentity(requestedAgent, { action: 'session' });
  const projectPath = String(flags.project || flags.cwd || flags._[1] || '.');
  const project = identifyProject(projectPath);
  let forwarded = hasFlag(args, '--trust') ? [...args] : [...args, '--trust', identity.trustLevel];
  if (!hasFlag(forwarded, '--projectId') && !hasFlag(forwarded, '--project-id')) forwarded.push('--projectId', project.projectId);
  const output = runNode(sessionPath, ['start', ...forwarded]);
  const id = sessionIdFromOutput(output);
  if (id) {
    const filePath = sessionFile(id);
    const session = readJson(filePath, null);
    if (session) writeJsonAtomic(filePath, { ...enrichIdentityRecord(session, identity, { fallback: requestedAgent }), projectId: project.projectId });
  }
  process.stdout.write(output);
}

function loadSessions() {
  const dir = path.join(kernelHome(), 'runtime', 'sessions');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).sort()
    .filter((name) => name.endsWith('.json') && !name.endsWith('.jsonl'))
    .map((name) => readJson(path.join(dir, name), null))
    .filter(Boolean)
    .sort((a, b) => String(b.updatedAt || b.startedAt || '').localeCompare(String(a.updatedAt || a.startedAt || '')));
}

function commandSessionList(args) {
  const flags = parseFlags(args);
  const wantedAgent = String(flags.agent || '').toLowerCase();
  const wantedProject = String(flags.projectId || flags['project-id'] || '').toLowerCase();
  let sessions = loadSessions();
  if (wantedAgent) sessions = sessions.filter((session) => agentIdFromRecord(session) === wantedAgent);
  if (wantedProject) sessions = sessions.filter((session) => String(session.projectId || '').toLowerCase() === wantedProject);
  if (flags.json) {
    process.stdout.write(JSON.stringify({ sessions }, null, 2) + '\n');
    return;
  }
  if (!sessions.length) {
    process.stdout.write('No sessions found\n');
    return;
  }
  for (const session of sessions) {
    process.stdout.write(`${session.id}\t${session.status}\t${agentIdFromRecord(session)}\t${session.projectId}\t${session.updatedAt || session.startedAt}\n`);
  }
}

function readObservations(id) {
  const raw = (() => { try { return fs.readFileSync(sessionLogFile(id), 'utf8').trim(); } catch { return ''; } })();
  if (!raw) return [];
  return raw.split(/\r?\n/).map((line) => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
}

function commandSessionObservations(args) {
  const flags = parseFlags(args);
  const id = flags._[0];
  if (!id) throw new Error('Usage: agent-kernel session observations <session-id> --agent <agent-id>');
  const wanted = String(flags.agent || '').toLowerCase();
  let observations = readObservations(id);
  if (wanted) observations = observations.filter((item) => agentIdFromRecord(item) === wanted);
  if (flags.json) process.stdout.write(JSON.stringify({ observations }, null, 2) + '\n');
  else if (!observations.length) process.stdout.write('No observations found\n');
  else for (const item of observations) process.stdout.write(`${item.timestamp}\t${item.type}\t${agentIdFromRecord(item)}\t${item.text}\n`);
}

function commandSession(args) {
  const action = args[0] || 'help';
  const rest = args.slice(1);
  if (action === 'start') return commandSessionStart(rest);
  if (action === 'list' && (hasFlag(rest, '--agent') || hasFlag(rest, '--project-id') || hasFlag(rest, '--projectId'))) return commandSessionList(rest);
  if (action === 'observations' && hasFlag(rest, '--agent')) return commandSessionObservations(rest);
  const output = runNode(sessionPath, [action, ...rest]);
  process.stdout.write(output);
}

function renderSearchResults(results, explain) {
  const lines = [];
  for (const item of results) {
    lines.push(`[${item.type}] ${item.title}`);
    lines.push(`id=${item.id} score=${item.score} agent=${item.agent || ''} project=${item.project || ''} updated=${item.updatedAt || ''}`);
    if (item.files?.length) lines.push(`files=${item.files.join(', ')}`);
    if (explain && item.signals?.length) lines.push(`why=${item.signals.map((signal) => `${signal.name}+${signal.points}(${signal.detail})`).join(', ')}`);
    if (item.text) lines.push(String(item.text).slice(0, 320));
    lines.push('');
  }
  return lines.join('\n').trim();
}

function sections(results) {
  return {
    approvedMemory: results.filter((item) => item.type === 'memory' && item.status === 'approved'),
    failureLessons: results.filter((item) => item.type === 'failure'),
    episodes: results.filter((item) => item.type === 'episode'),
    rawObservations: results.filter((item) => item.type === 'session' || (item.type === 'memory' && item.status !== 'approved'))
  };
}

function commandSearch(args) {
  const wantedAgent = String(flagValue(args, '--agent', '')).toLowerCase();
  let wantedProject = String(flagValue(args, '--project-id', flagValue(args, '--projectId', ''))).toLowerCase();
  const projectPath = flagValue(args, '--project', '');
  if (!wantedProject && projectPath) wantedProject = identifyProject(projectPath).projectId.toLowerCase();
  const requestedLimit = Math.max(1, Math.min(Number(flagValue(args, '--limit', '20')), 100));
  let forwarded = stripFlag(args, '--agent');
  forwarded = stripFlag(forwarded, '--project');
  forwarded = stripFlag(forwarded, '--project-id');
  forwarded = stripFlag(forwarded, '--projectId');
  forwarded = stripFlag(forwarded, '--limit');
  forwarded = stripFlag(forwarded, '--budget');
  if (!hasFlag(forwarded, '--json')) forwarded.push('--json');
  forwarded.push('--limit', '100');
  const result = JSON.parse(runNode(searchPath, ['search', ...forwarded]));
  let results = result.results;
  if (wantedAgent) results = results.filter((item) => agentIdFromRecord(item) === wantedAgent);
  if (wantedProject) results = results.filter((item) => String(item.project || '').toLowerCase() === wantedProject);
  results = results.slice(0, requestedLimit);
  const explain = result.explain === true;
  const budgetRaw = flagValue(args, '--budget', '');
  const budget = budgetRaw ? Math.max(100, Math.min(Number(budgetRaw), 12000)) : null;
  if (budget) {
    const accepted = [];
    for (const item of results) {
      if (renderSearchResults([...accepted, item], explain).length > budget) break;
      accepted.push(item);
    }
    results = accepted;
  }
  const rendered = renderSearchResults(results, explain);
  const filtered = {
    ...result,
    filters: { ...(result.filters || {}), agent: wantedAgent || null, projectId: wantedProject || null },
    budget,
    budgetUsed: rendered.length,
    count: results.length,
    sections: sections(results),
    results,
    rendered
  };
  if (hasFlag(args, '--json')) process.stdout.write(JSON.stringify(filtered, null, 2) + '\n');
  else process.stdout.write((rendered || 'No matching local records.') + '\n');
}

function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (command === 'propose') return commandPropose(rest);
  if (command === 'session') return commandSession(rest);
  if (command === 'search') return commandSearch(rest);
  throw new Error(`Unsupported identity command: ${command}`);
}

try { main(); }
catch (error) {
  process.stderr.write(`${error?.message || String(error)}\n`);
  process.exitCode = 1;
}
