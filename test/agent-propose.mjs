// test/agent-propose.mjs — Agent proposal wrapper trust and validation.
//
// Invariants:
//   1. Agent-authored rules land in inbox/pending and never approved memory.
//   2. Known proposing agents carry durable identity and trust metadata.
//   3. Unknown/read-only agents cannot create proposals or mutate the registry.
//   4. Unknown, duplicate, missing-value, and conflicting options fail cleanly.
//   5. Proposal fields and text sources are validated before the core CLI runs.
//   6. Pending identity enrichment preserves pending status and leaves no temp files.

import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { makeEnv, repo, runCli } from './_lib/helpers.mjs';

const agentPropose = path.join(repo.root, 'bin', 'agent-kernel-agent-propose.mjs');

function runAgent(env, args, input = '', envOverrides = {}) {
  return childProcess.execFileSync(process.execPath, [agentPropose, ...args], {
    cwd: repo.root,
    env: { ...env, AGENT_KERNEL_CLI: repo.cli, ...envOverrides },
    encoding: 'utf8',
    input,
    stdio: ['pipe', 'pipe', 'pipe']
  });
}

function runAgentFailure(env, args, input = '', envOverrides = {}) {
  try {
    runAgent(env, args, input, envOverrides);
    return { status: 0, stdout: '', stderr: '' };
  } catch (error) {
    return {
      status: error.status ?? 1,
      stdout: String(error.stdout || ''),
      stderr: String(error.stderr || '')
    };
  }
}

function pendingFiles(kernelHome) {
  const dir = path.join(kernelHome, 'inbox', 'pending');
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.endsWith('.json')).sort() : [];
}

function approvedSnapshot(kernelHome) {
  const dir = path.join(kernelHome, 'source', 'memories');
  return fs.readdirSync(dir).filter((name) => name.endsWith('.json')).sort()
    .map((name) => [name, fs.readFileSync(path.join(dir, name), 'utf8')]);
}

function agentsSnapshot(kernelHome) {
  const filePath = path.join(kernelHome, 'source', 'agents', 'agents.json');
  if (!fs.existsSync(filePath)) return new Set();
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const agents = Array.isArray(parsed?.agents) ? parsed.agents : [];
    return new Set(agents.map((entry) => entry?.agentId).filter(Boolean));
  } catch {
    return new Set();
  }
}

function assertFailure(result, expected, label) {
  if (result.status === 0) throw new Error(`${label} unexpectedly succeeded`);
  if (!result.stderr.includes(expected)) {
    throw new Error(`${label} returned the wrong error: ${result.stderr}`);
  }
  if (/(^|\n)\s{2,}at\s/.test(result.stderr) || result.stderr.includes('node:internal')) {
    throw new Error(`${label} exposed a stack trace: ${result.stderr}`);
  }
}

function assertNoNewProposal(kernelHome, before, label) {
  const after = pendingFiles(kernelHome);
  if (JSON.stringify(after) !== JSON.stringify(before)) {
    throw new Error(`${label} created or removed pending proposals`);
  }
}

export async function run() {
  const { env, kernelHome } = makeEnv();
  runCli(env, 'init', '--sync');

  const approvedBefore = approvedSnapshot(kernelHome);
  const agentsBefore = agentsSnapshot(kernelHome);
  const initialPending = pendingFiles(kernelHome);

  const help = runAgent(env, ['--help']);
  if (!help.includes('Creates a pending memory proposal')) throw new Error('agent propose help was incomplete');
  assertNoNewProposal(kernelHome, initialPending, 'help');

  const failures = [
    [['--unknown'], '', 'Unknown option: --unknown', 'unknown option'],
    [['--from', 'codex', '--from', 'cursor', '--text', 'Remember this valid rule.'], '', 'Duplicate option: --from', 'duplicate option'],
    [['--from'], '', 'Option --from requires a value.', 'missing value'],
    [['--from', 'codex', '--agent', 'cursor', '--text', 'Remember this valid rule.'], '', 'aliases and cannot be used together', 'alias conflict'],
    [['--from', 'codex', '--text', 'Remember this valid rule.', 'second text source'], '', 'multiple sources', 'text source conflict'],
    [['--from', 'codex', '--text', 'Remember this valid rule.'], 'stdin conflict', 'multiple sources', 'stdin source conflict'],
    [['--from', 'codex', '--text', 'short'], '', 'at least 8 characters', 'short text'],
    [['--from', 'codex', '--text', 'Remember this valid rule.', '--reason', 'x'], '', 'reason must be between', 'short reason'],
    [['--from', 'codex', '--text', 'Remember this valid rule.', '--type', 'unknown'], '', 'Invalid proposal type', 'invalid type'],
    [['--from', 'codex', '--text', 'Remember this valid rule.', '--scope', 'team'], '', 'Invalid proposal scope', 'invalid scope'],
    [['--from', 'codex', '--text', 'Remember this valid rule.', '--level', 'urgent'], '', 'Invalid proposal level', 'invalid level'],
    [['--from', 'codex', '--text', 'Remember this valid rule.', '--targets', 'codex,,cursor'], '', 'Targets contains an empty item', 'invalid targets'],
    [['--from', 'codex', '--text', 'Remember this valid rule.', '--tags', 'one,,two'], '', 'Tags contains an empty item', 'invalid tags']
  ];

  for (const [args, input, expected, label] of failures) {
    const before = pendingFiles(kernelHome);
    const result = runAgentFailure(env, args, input);
    assertFailure(result, expected, label);
    assertNoNewProposal(kernelHome, before, label);
  }

  const unknownBefore = pendingFiles(kernelHome);
  const denied = runAgentFailure(env, ['--from', 'mystery-agent', '--text', 'Remember this valid rule.']);
  assertFailure(denied, 'trust level read-only and cannot create proposals', 'unknown agent');
  assertNoNewProposal(kernelHome, unknownBefore, 'unknown agent');
  const agentsAfter = agentsSnapshot(kernelHome);
  if (agentsAfter.has('mystery-agent')) {
    throw new Error('denied unknown agent mutated the persistent agent registry');
  }

  const out = runAgent(env, [
    '--from', 'opencode',
    '--reason', 'The user corrected this workflow twice.',
    '--type', 'workflow',
    '--scope', 'project',
    '--level', 'note',
    '--targets', 'opencode,opencode,codex',
    '--tags', 'agent-authored,agent-authored,workflow',
    '--text', 'Always run the documented verification command before claiming completion.'
  ]);
  const match = out.match(/Created pending memory proposal:\s*(\S+)/);
  if (!match) throw new Error(`agent proposal wrapper did not create a proposal: ${out}`);
  const proposalId = match[1];
  const proposalPath = path.join(kernelHome, 'inbox', 'pending', `${proposalId}.json`);
  const proposal = JSON.parse(fs.readFileSync(proposalPath, 'utf8'));
  if (proposal.id !== proposalId || proposal.status !== 'pending') {
    throw new Error('agent proposal was not stored as the expected pending record');
  }
  if (proposal.source?.proposedBy !== 'opencode' || proposal.createdBy !== 'opencode' || proposal.agentId !== 'opencode') {
    throw new Error('agent proposal did not persist normalized identity metadata');
  }
  if (proposal.trustLevel !== 'propose-only' || proposal.source?.trustLevel !== 'propose-only') {
    throw new Error('agent proposal did not persist trust level metadata');
  }
  if (proposal.type !== 'workflow' || proposal.scope !== 'project' || proposal.level !== 'note') {
    throw new Error('agent proposal field validation did not preserve valid values');
  }
  if (JSON.stringify(proposal.targets) !== JSON.stringify(['opencode', 'codex'])) {
    throw new Error(`agent proposal targets were not normalized: ${JSON.stringify(proposal.targets)}`);
  }
  if (!proposal.tags?.includes('agent-authored') || !proposal.tags?.includes('workflow')) {
    throw new Error(`agent proposal tags were not preserved: ${JSON.stringify(proposal.tags)}`);
  }

  const stdinOut = runAgent(env, [
    '--from=cursor',
    '--reason=Captured from an explicit user correction.'
  ], 'Always preserve the repository package manager.\n');
  if (!stdinOut.includes('Created pending memory proposal:')) {
    throw new Error('agent proposal wrapper did not accept stdin text');
  }

  const approvedAfter = approvedSnapshot(kernelHome);
  if (JSON.stringify(approvedBefore) !== JSON.stringify(approvedAfter)) {
    throw new Error('agent proposal wrapper modified approved memory');
  }
  const pendingDir = path.join(kernelHome, 'inbox', 'pending');
  const temporaryFiles = fs.readdirSync(pendingDir).filter((name) => name.includes('.tmp-') || name.includes('.rollback-'));
  if (temporaryFiles.length) throw new Error(`agent proposal wrapper left temporary files: ${temporaryFiles.join(', ')}`);
}

export const name = 'agent-propose';
