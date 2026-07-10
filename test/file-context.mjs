// test/file-context.mjs — File-aware local context smoke test.
//
// Invariants:
//   1. `agent-kernel file-context` works through the public CLI without daemon mode.
//   2. Paths normalize relative to the project root.
//   3. Approved memory, failures, episodes, sessions, guards, and pending proposals are separated.
//   4. Rejected proposals never appear.
//   5. Exact file references outrank weaker text-only matches.
//   6. Rendered context respects the requested character budget.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertContains, assertNotContains, makeEnv, repo, runCli } from './_lib/helpers.mjs';

const publicCli = join(repo.root, 'bin', 'agent-kernel.mjs');

function writeJson(filePath, value) {
  mkdirSync(join(filePath, '..'), { recursive: true });
  writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

function runPublic(env, cwd, ...args) {
  return execFileSync(process.execPath, [publicCli, ...args], {
    cwd,
    env,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
}

export async function run() {
  const { env, homeDir, kernelHome } = makeEnv();
  runCli(env, 'init', '--sync');

  const project = join(homeDir, 'file-context-project');
  mkdirSync(join(project, 'src'), { recursive: true });
  mkdirSync(join(project, 'test'), { recursive: true });
  writeFileSync(join(project, 'src', 'cli.mjs'), '// fixture\n');
  writeFileSync(join(project, 'test', 'smoke.mjs'), '// fixture\n');
  execFileSync('git', ['init'], { cwd: project, env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });

  const now = new Date().toISOString();
  const memoriesPath = join(kernelHome, 'source', 'memories', 'project-notes.json');
  const memories = JSON.parse(readFileSync(memoriesPath, 'utf8'));
  memories.push(
    {
      id: 'file-context-exact',
      type: 'project-note',
      scope: 'project',
      level: 'standard',
      text: 'Exact guidance for src/cli.mjs.',
      files: ['src/cli.mjs'],
      targets: ['all'],
      tags: ['file-context'],
      status: 'approved',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      version: 1
    },
    {
      id: 'file-context-text-only',
      type: 'project-note',
      scope: 'project',
      level: 'standard',
      text: 'Text-only note mentioning cli.mjs.',
      targets: ['all'],
      tags: ['file-context'],
      status: 'approved',
      createdAt: now,
      updatedAt: now,
      version: 1
    },
    {
      id: 'file-context-unrelated',
      type: 'project-note',
      scope: 'project',
      level: 'critical',
      text: 'Unrelated guidance for src/other.js.',
      files: ['src/other.js'],
      targets: ['all'],
      tags: ['file-context'],
      status: 'approved',
      createdAt: now,
      updatedAt: now,
      version: 1
    }
  );
  writeFileSync(memoriesPath, JSON.stringify(memories, null, 2) + '\n');

  writeJson(join(kernelHome, 'source', 'failures', 'failure-lessons.json'), [
    {
      id: 'failure_lesson_file_context',
      status: 'approved',
      errorSignature: 'ERR_FILE_CONTEXT',
      rootCause: 'A bulk edit damaged src/cli.mjs.',
      fixRecipe: ['Patch the target lines only.'],
      preventionRule: 'Inspect file context before editing.',
      evidence: { cwd: project, filesTouched: ['src/cli.mjs'] },
      occurrences: 2,
      createdAt: now,
      updatedAt: now
    }
  ]);

  const fakeSecret = 'sk-' + 'abcdefghijklmnopqrstuvwxyz1234567890';
  writeJson(join(kernelHome, 'episodes', 'archive', 'episode_file_context.json'), {
    id: 'episode_file_context',
    type: 'episode',
    title: 'CLI routing decision',
    summary: 'Kept the public routing layer small.',
    text: `Touched src/cli.mjs and redacted ${fakeSecret}.`,
    files: ['src/cli.mjs'],
    agent: 'test-agent',
    project: 'file-context-project',
    createdAt: now,
    updatedAt: now
  });

  mkdirSync(join(kernelHome, 'runtime', 'sessions'), { recursive: true });
  writeFileSync(
    join(kernelHome, 'runtime', 'sessions', 'session_file_context.jsonl'),
    JSON.stringify({
      id: 'obs_file_context',
      sessionId: 'session_file_context',
      timestamp: now,
      agentId: 'test-agent',
      type: 'file_edit',
      cwd: project,
      files: ['src/cli.mjs'],
      text: 'Edited only the public routing branch.'
    }) + '\n'
  );

  const policyPath = join(kernelHome, 'dist', 'policy.json');
  const policy = JSON.parse(readFileSync(policyPath, 'utf8'));
  policy.denyWritePaths = [...new Set([...(policy.denyWritePaths || []), 'src/cli.mjs'])];
  writeFileSync(policyPath, JSON.stringify(policy, null, 2) + '\n');

  writeJson(join(kernelHome, 'inbox', 'pending', 'pending_file_context.json'), {
    id: 'pending_file_context',
    type: 'rule',
    scope: 'project',
    level: 'standard',
    text: 'Pending guidance for src/cli.mjs.',
    reason: 'File-context smoke test.',
    files: ['src/cli.mjs'],
    targets: ['all'],
    tags: ['file-context'],
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    version: 1
  });

  writeJson(join(kernelHome, 'inbox', 'rejected', 'rejected_file_context.json'), {
    id: 'rejected_file_context',
    type: 'rule',
    scope: 'project',
    level: 'critical',
    text: 'REJECTED_MARKER for src/cli.mjs.',
    files: ['src/cli.mjs'],
    status: 'rejected',
    createdAt: now
  });

  const raw = runPublic(
    env,
    project,
    'file-context',
    join(project, 'src', 'cli.mjs'),
    'test/smoke.mjs',
    '--budget',
    '1200',
    '--json'
  );
  const result = JSON.parse(raw);

  if (result.files[0] !== 'src/cli.mjs' || result.files[1] !== 'test/smoke.mjs') {
    throw new Error(`file-context did not normalize paths: ${JSON.stringify(result.files)}`);
  }
  if (result.context.length > 1200 || result.budgetUsed !== result.context.length) {
    throw new Error(`file-context exceeded budget: ${result.context.length}/${result.budgetUsed}`);
  }

  const approved = result.sections.approvedMemory;
  if (!Array.isArray(approved) || approved[0]?.id !== 'file-context-exact') {
    throw new Error(`exact file reference did not rank first: ${JSON.stringify(approved)}`);
  }
  if (approved.some((item) => item.id === 'file-context-unrelated')) {
    throw new Error(`unrelated approved memory leaked into results: ${JSON.stringify(approved)}`);
  }

  for (const key of ['failureLessons', 'episodes', 'sessionObservations', 'guardPolicies', 'pendingProposals']) {
    if (!Array.isArray(result.sections[key]) || result.sections[key].length === 0) {
      throw new Error(`file-context missing ${key}: ${JSON.stringify(result.sections)}`);
    }
  }

  const pending = result.sections.pendingProposals[0];
  if (pending.status !== 'pending' || pending.approved !== false) {
    throw new Error(`pending proposal was not marked unapproved: ${JSON.stringify(pending)}`);
  }

  assertContains(result.context, '[PENDING, UNAPPROVED]', 'pending proposal marker missing');
  assertNotContains(raw, 'REJECTED_MARKER', 'rejected proposal appeared in file context');
  assertNotContains(raw, fakeSecret, 'file context exposed a stored secret');
  assertContains(raw, '[REDACTED_SECRET]', 'file context did not redact stored secret text');
}

export const name = 'file-context';
