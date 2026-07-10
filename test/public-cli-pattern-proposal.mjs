// test/public-cli-pattern-proposal.mjs
//
// Invariants:
//   1. A recurring pattern creates a normal pending proposal with evidence refs.
//   2. The proposal text is concise and remains editable JSON in the inbox.
//   3. No memory is approved or published automatically.
//   4. MCP cannot approve the proposal without the explicit approval env flags.
//   5. Failure hooks cannot approve or publish the pending proposal.
//   6. The user can reject or approve through the normal CLI flow.

import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { makeEnv, repo, runCli } from './_lib/helpers.mjs';

const publicCli = path.join(repo.root, 'bin', 'agent-kernel-router.mjs');
const hookPath = path.join(repo.root, 'bin', 'agent-kernel-claude-context-hook.mjs');

function runPublic(env, ...args) {
  return childProcess.execFileSync(process.execPath, [publicCli, ...args], {
    cwd: repo.root,
    env,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
}

function callMcp(env, name, args) {
  const output = childProcess.execFileSync(process.execPath, [publicCli, 'mcp', 'serve'], {
    cwd: repo.root,
    env,
    input: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }) + '\n',
    encoding: 'utf8'
  });
  const rpc = JSON.parse(output.trim());
  return JSON.parse(rpc.result.content[0].text);
}

function runHook(env, payload) {
  return childProcess.execFileSync(process.execPath, [hookPath, 'PostToolUseFailure'], {
    cwd: repo.root,
    env,
    input: JSON.stringify(payload),
    encoding: 'utf8'
  });
}

function approvedMemoryText(kernelHome) {
  const dir = path.join(kernelHome, 'source', 'memories');
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => fs.readFileSync(path.join(dir, name), 'utf8'))
    .join('\n');
}

function fixtureLesson() {
  return {
    id: 'failure_pattern_proposal_evidence',
    status: 'captured',
    scope: 'project',
    project: 'agent-kernel',
    agent: 'codex',
    failureType: 'test-failure',
    errorSignature: 'ERR_PATTERN_PROPOSAL',
    symptoms: ['The same generated block was duplicated.'],
    rootCause: 'The installer appended without replacing its marked block.',
    fixRecipe: ['Replace the existing marked block and rerun the focused test.'],
    preventionRule: 'Marked installers must be idempotent.',
    evidence: {
      command: 'npm test',
      cwd: repo.root,
      filesTouched: ['bin/agent-kernel-router.mjs'],
      outputExcerpt: 'ERR_PATTERN_PROPOSAL duplicated marked block'
    },
    promoteTo: ['rule'],
    targets: ['all'],
    tags: ['pattern-proposal-test'],
    occurrences: 3,
    firstSeenAt: '2026-01-01T00:00:00.000Z',
    lastSeenAt: '2026-01-03T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-03T00:00:00.000Z',
    version: 1
  };
}

export async function run() {
  const { env, kernelHome } = makeEnv();
  runCli(env, 'init', '--sync');

  const lessonsPath = path.join(kernelHome, 'source', 'failures', 'failure-lessons.json');
  fs.mkdirSync(path.dirname(lessonsPath), { recursive: true });
  fs.writeFileSync(lessonsPath, JSON.stringify([fixtureLesson()], null, 2) + '\n');

  const detected = JSON.parse(runPublic(env, 'failure', 'patterns', '--min-count', '3', '--project', repo.root, '--json'));
  const pattern = detected.patterns.find((item) => item.signalType === 'error_signature' && item.label === 'ERR_PATTERN_PROPOSAL');
  if (!pattern) throw new Error(`fixture pattern was not detected: ${JSON.stringify(detected)}`);

  const beforeApproved = approvedMemoryText(kernelHome);
  const proposed = JSON.parse(runPublic(env, 'failure', 'propose-pattern', pattern.id, '--as', 'workflow', '--json'));
  if (!proposed.ok || proposed.status !== 'pending' || !proposed.proposalId) {
    throw new Error(`pattern proposal failed: ${JSON.stringify(proposed)}`);
  }
  if (proposed.target !== 'workflow' || proposed.evidenceReferences[0] !== 'failure_pattern_proposal_evidence') {
    throw new Error(`pattern proposal metadata was incomplete: ${JSON.stringify(proposed)}`);
  }

  const pendingPath = path.join(kernelHome, 'inbox', 'pending', `${proposed.proposalId}.json`);
  if (!fs.existsSync(pendingPath)) throw new Error('pattern proposal was not written to the pending inbox');
  const pending = JSON.parse(fs.readFileSync(pendingPath, 'utf8'));
  if (pending.status !== 'pending' || pending.type !== 'workflow') {
    throw new Error(`pending proposal has the wrong state or type: ${JSON.stringify(pending)}`);
  }
  if (!pending.text.includes(pattern.id) && !pending.reason.includes(pattern.id)) {
    throw new Error('pending proposal omitted the pattern reference');
  }
  if (!pending.text.includes('failure_pattern_proposal_evidence') || pending.text.length > 2000) {
    throw new Error(`proposal text is not concise or lacks evidence: ${pending.text.length} ${pending.text}`);
  }
  if (approvedMemoryText(kernelHome) !== beforeApproved) {
    throw new Error('pattern proposal changed approved memory before user approval');
  }

  const mcpAttempt = callMcp(env, 'agent_kernel_approve_memory', { id: proposed.proposalId, publish: true });
  const approvalError = String(mcpAttempt.error || '').toLowerCase();
  if (mcpAttempt.ok !== false || (!approvalError.includes('disabled') && !approvalError.includes('not enabled'))) {
    throw new Error(`MCP bypassed or misreported the approval boundary: ${JSON.stringify(mcpAttempt)}`);
  }
  if (!fs.existsSync(pendingPath)) throw new Error('MCP removed the pending proposal without approval permission');

  runHook(env, {
    hook_event_name: 'PostToolUseFailure',
    tool_name: 'Bash',
    cwd: repo.root,
    tool_input: { command: 'npm test', files: ['bin/agent-kernel-router.mjs'] },
    tool_response: { stderr: 'ERR_PATTERN_PROPOSAL focused test failure' }
  });
  if (!fs.existsSync(pendingPath)) throw new Error('failure hook approved or removed the pending proposal');
  if (approvedMemoryText(kernelHome) !== beforeApproved) {
    throw new Error('failure hook changed approved memory while a proposal was pending');
  }

  runCli(env, 'reject', proposed.proposalId);
  if (fs.existsSync(pendingPath)) throw new Error('normal reject flow did not remove the pending proposal');
  const rejectedPath = path.join(kernelHome, 'inbox', 'rejected', `${proposed.proposalId}.json`);
  if (!fs.existsSync(rejectedPath)) throw new Error('normal reject flow did not archive the proposal as rejected');

  const second = JSON.parse(runPublic(env, 'failure', 'propose-pattern', pattern.id, '--as', 'skill', '--json'));
  const secondPending = path.join(kernelHome, 'inbox', 'pending', `${second.proposalId}.json`);
  if (!fs.existsSync(secondPending)) throw new Error('second pattern proposal was not pending');
  const secondBody = JSON.parse(fs.readFileSync(secondPending, 'utf8'));
  if (secondBody.type !== 'skill-trigger') throw new Error(`skill target was not mapped correctly: ${JSON.stringify(secondBody)}`);

  runCli(env, 'approve', second.proposalId);
  if (fs.existsSync(secondPending)) throw new Error('normal approve flow left the proposal pending');
  const approvedArchive = path.join(kernelHome, 'inbox', 'approved', `${second.proposalId}.json`);
  if (!fs.existsSync(approvedArchive)) throw new Error('normal approve flow did not archive the approved proposal');
}

export const name = 'public-cli-pattern-proposal';
