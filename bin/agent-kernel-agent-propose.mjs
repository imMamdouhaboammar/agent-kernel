#!/usr/bin/env node
import fs from 'node:fs';
import childProcess from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { agentCan, enrichIdentityRecord, resolveAgentIdentity } from './agent-kernel-agent-model.mjs';

function print(message = '') {
  process.stdout.write(String(message) + '\n');
}

function fail(message) {
  process.stderr.write(String(message) + '\n');
  process.exitCode = 1;
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
  if (flags.help || flags.h) return usage();

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

main();
