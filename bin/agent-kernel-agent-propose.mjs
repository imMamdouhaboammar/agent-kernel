#!/usr/bin/env node
import fs from 'node:fs';
import childProcess from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { agentCan, enrichIdentityRecord, resolveAgentIdentity } from './agent-kernel-agent-model.mjs';

const VALUE_FLAGS = new Set(['from', 'agent', 'reason', 'text', 'type', 'scope', 'level', 'targets', 'tags']);
const BOOLEAN_FLAGS = new Set(['help']);

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

  const text = String(flags.text || flags._.join(' ') || readStdin()).trim();
  const from = String(flags.from || flags.agent || 'unknown-agent').trim();
  const reason = String(flags.reason || 'Captured by coding agent.').trim();
  const type = String(flags.type || 'rule').trim();
  const scope = String(flags.scope || 'global').trim();
  const level = String(flags.level || 'standard').trim();
  const targets = String(flags.targets || 'all').trim();
  const tags = String(flags.tags || '').trim();
  const identity = resolveAgentIdentity(from, { action: 'propose' });

  if (!agentCan(identity, 'propose')) {
    fail(`Agent ${identity.agentId} has trust level ${identity.trustLevel} and cannot create proposals.`);
    return;
  }

  if (!text || text.length < 8) {
    fail('Proposal text is required and must be at least 8 characters.');
    return;
  }

  const [cmd, ...baseArgs] = cliCommand();
  const args = [
    ...baseArgs,
    'propose',
    '--from', identity.agentId,
    '--type', type,
    '--scope', scope,
    '--level', level,
    '--targets', targets,
    '--text', text,
    '--reason', reason
  ];
  if (tags) args.push('--tags', tags);

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
      const enriched = enrichIdentityRecord(proposal, identity, { fallback: from });
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
