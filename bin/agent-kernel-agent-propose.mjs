#!/usr/bin/env node
import fs from 'node:fs';
import childProcess from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { agentCan, enrichIdentityRecord, resolveAgentIdentity } from './agent-kernel-agent-model.mjs';

const VALUE_FLAGS = new Set(['from', 'agent', 'reason', 'text', 'type', 'scope', 'level', 'targets', 'tags']);
const BOOLEAN_FLAGS = new Set(['help']);
const MEMORY_TYPES = new Set(['rule', 'policy', 'preference', 'workflow', 'project-note', 'skill-trigger']);
const MEMORY_SCOPES = new Set(['global', 'project']);
const MEMORY_LEVELS = new Set(['critical', 'standard', 'note']);

function print(message = '') {
  process.stdout.write(String(message) + '\n');
}

function fail(message) {
  process.stderr.write(String(message) + '\n');
  process.exitCode = 1;
}

function canonicalFlag(raw) {
  if (raw === 'h') return 'help';
  return raw;
}

function parseArgs(argv) {
  const flags = { _: [] };
  const seen = new Set();
  let positionalOnly = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (positionalOnly) {
      flags._.push(arg);
      continue;
    }
    if (arg === '--') {
      positionalOnly = true;
      continue;
    }
    if (!arg.startsWith('-') || arg === '-') {
      flags._.push(arg);
      continue;
    }

    const prefixLength = arg.startsWith('--') ? 2 : 1;
    const token = arg.slice(prefixLength);
    const eq = token.indexOf('=');
    const rawName = eq >= 0 ? token.slice(0, eq) : token;
    const name = canonicalFlag(rawName);
    if (!VALUE_FLAGS.has(name) && !BOOLEAN_FLAGS.has(name)) throw new Error(`Unknown option: ${arg}`);
    if (seen.has(name)) throw new Error(`Duplicate option: --${name}`);
    seen.add(name);

    if (BOOLEAN_FLAGS.has(name)) {
      if (eq >= 0) throw new Error(`Option --${name} does not accept a value.`);
      flags[name] = true;
      continue;
    }

    let value;
    if (eq >= 0) value = token.slice(eq + 1);
    else {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('-')) throw new Error(`Option --${name} requires a value.`);
      value = next;
      i++;
    }
    if (!String(value).trim()) throw new Error(`Option --${name} requires a non-empty value.`);
    flags[name] = value;
  }
  if (flags.from !== undefined && flags.agent !== undefined) {
    throw new Error('Options --from and --agent are aliases and cannot be used together.');
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

function resolveText(flags) {
  const sources = [
    ['--text', String(flags.text || '').trim()],
    ['positional text', flags._.join(' ').trim()],
    ['stdin', readStdin().trim()]
  ].filter(([, value]) => value);
  if (sources.length > 1) {
    throw new Error(`Proposal text was provided by multiple sources: ${sources.map(([label]) => label).join(', ')}.`);
  }
  return sources[0]?.[1] || '';
}

function validateCsv(value, label, options = {}) {
  const raw = String(value || '').trim();
  if (!raw) {
    if (options.required) throw new Error(`${label} must not be empty.`);
    return '';
  }
  const items = raw.split(',').map((item) => item.trim());
  if (items.some((item) => !item)) throw new Error(`${label} contains an empty item.`);
  if (items.length > (options.maxItems || 50)) throw new Error(`${label} contains too many items.`);
  if (items.some((item) => item.length > (options.maxLength || 100))) throw new Error(`${label} contains an item that is too long.`);
  return [...new Set(items)].join(',');
}

function validateInputs(flags) {
  const text = resolveText(flags);
  const from = String(flags.from || flags.agent || 'unknown-agent').trim();
  const reason = String(flags.reason || 'Captured by coding agent.').trim();
  const type = String(flags.type || 'rule').trim();
  const scope = String(flags.scope || 'global').trim();
  const level = String(flags.level || 'standard').trim();
  const targets = validateCsv(flags.targets || 'all', 'Targets', { required: true });
  const tags = validateCsv(flags.tags || '', 'Tags', { maxItems: 30 });

  if (text.length < 8) throw new Error('Proposal text is required and must be at least 8 characters.');
  if (text.length > 4000) throw new Error('Proposal text must not exceed 4000 characters.');
  if (!from || from.length > 200) throw new Error('Agent identity must be between 1 and 200 characters.');
  if (reason.length < 4 || reason.length > 1000) throw new Error('Proposal reason must be between 4 and 1000 characters.');
  if (!MEMORY_TYPES.has(type)) throw new Error(`Invalid proposal type: ${type}`);
  if (!MEMORY_SCOPES.has(scope)) throw new Error(`Invalid proposal scope: ${scope}`);
  if (!MEMORY_LEVELS.has(level)) throw new Error(`Invalid proposal level: ${level}`);
  return { text, from, reason, type, scope, level, targets, tags };
}

function localCliPath() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..', 'dist', 'cli.mjs');
}

function cliCommand() {
  if (process.env.AGENT_KERNEL_CLI) return [process.execPath, process.env.AGENT_KERNEL_CLI];
  const local = localCliPath();
  if (fs.existsSync(local)) return [process.execPath, local];
  return ['agent-kernel'];
}

function kernelHome() {
  return process.env.AGENT_KERNEL_HOME || path.join(os.homedir(), '.agent-kernel');
}

function proposalIdFrom(output) {
  return String(output || '').match(/Created pending memory proposal:\s*(\S+)/)?.[1] || '';
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

function usage() {
  print(`agent-kernel-agent-propose\n\nUsage:\n  agent-kernel-agent-propose --from codex --reason "User corrected this twice" --text "Always use pnpm here."\n  echo "Always use pnpm here." | agent-kernel-agent-propose --from cursor --reason "User asked to remember it"\n\nCreates a pending memory proposal. It does not approve or publish the memory.\n`);
}

function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) return usage();

  const input = validateInputs(flags);
  const identity = resolveAgentIdentity(input.from, { action: 'propose' });

  if (!agentCan(identity, 'propose')) {
    fail(`Agent ${identity.agentId} has trust level ${identity.trustLevel} and cannot create proposals.`);
    return;
  }

  const [cmd, ...baseArgs] = cliCommand();
  const args = [
    ...baseArgs,
    'propose',
    '--from', identity.agentId,
    '--type', input.type,
    '--scope', input.scope,
    '--level', input.level,
    '--targets', input.targets,
    '--text', input.text,
    '--reason', input.reason
  ];
  if (input.tags) args.push('--tags', input.tags);

  const out = childProcess.execFileSync(cmd, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env
  });
  const proposalId = proposalIdFrom(out);
  if (proposalId) {
    const proposalPath = path.join(kernelHome(), 'inbox', 'pending', `${proposalId}.json`);
    const proposal = readJson(proposalPath, null);
    if (proposal) {
      const enriched = enrichIdentityRecord(proposal, identity, { fallback: input.from });
      enriched.source = {
        ...(proposal.source || {}),
        proposedBy: proposal.source?.proposedBy || identity.agentId,
        createdBy: identity.agentId,
        agentId: identity.agentId,
        trustLevel: identity.trustLevel
      };
      writeJsonAtomic(proposalPath, enriched);
    }
  }
  process.stdout.write(out);
}

try { main(); }
catch (error) { fail(error?.message || String(error)); }
