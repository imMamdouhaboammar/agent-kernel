// test/public-cli-failure-patterns.mjs
//
// Invariants:
//   1. Recurring failure detection is deterministic and local.
//   2. Occurrence counts from deduplicated lessons contribute to patterns.
//   3. Patterns include concrete Failure Lesson evidence references.
//   4. Project filtering prevents unrelated project evidence from mixing in.
//   5. False positives can be rejected and restored without deleting evidence.

import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { makeEnv, repo, runCli } from './_lib/helpers.mjs';

const publicCli = path.join(repo.root, 'bin', 'agent-kernel-router.mjs');

function runPublic(env, ...args) {
  return childProcess.execFileSync(process.execPath, [publicCli, ...args], {
    cwd: repo.root,
    env,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
}

function lesson(input) {
  return {
    id: input.id,
    status: 'captured',
    scope: 'project',
    project: input.project,
    agent: input.agent,
    failureType: 'test-failure',
    errorSignature: input.signature,
    symptoms: [input.text],
    rootCause: input.rootCause,
    fixRecipe: [input.fix],
    preventionRule: '',
    evidence: {
      command: input.command,
      cwd: input.cwd,
      filesTouched: input.files,
      outputExcerpt: input.text
    },
    promoteTo: ['rule'],
    targets: ['all'],
    tags: ['pattern-test'],
    occurrences: input.occurrences,
    firstSeenAt: input.firstSeenAt,
    lastSeenAt: input.lastSeenAt,
    createdAt: input.firstSeenAt,
    updatedAt: input.lastSeenAt,
    version: 1
  };
}

export async function run() {
  const { env, kernelHome } = makeEnv();
  runCli(env, 'init', '--sync');

  const lessons = [
    lesson({
      id: 'failure_pattern_evidence_a',
      project: 'agent-kernel',
      agent: 'codex',
      signature: 'ERR_PATTERN_REPEAT',
      text: 'Error ERR_PATTERN_REPEAT at /tmp/work/src/cli.mjs line 41',
      rootCause: 'The generated block was appended twice.',
      fix: 'Replace the existing marked block instead of appending.',
      command: 'npm test',
      cwd: repo.root,
      files: ['src/cli.mjs'],
      occurrences: 3,
      firstSeenAt: '2026-01-01T00:00:00.000Z',
      lastSeenAt: '2026-01-03T00:00:00.000Z'
    }),
    lesson({
      id: 'failure_pattern_evidence_b',
      project: 'agent-kernel',
      agent: 'claude-code',
      signature: 'ERR_PATTERN_REPEAT',
      text: 'Error ERR_PATTERN_REPEAT at /another/path/src/cli.mjs line 99',
      rootCause: 'The generated block was appended twice.',
      fix: 'Replace the existing marked block instead of appending.',
      command: 'npm run smoke',
      cwd: repo.root,
      files: ['src/cli.mjs'],
      occurrences: 1,
      firstSeenAt: '2026-01-04T00:00:00.000Z',
      lastSeenAt: '2026-01-04T00:00:00.000Z'
    }),
    lesson({
      id: 'failure_pattern_other_project',
      project: 'other-project',
      agent: 'cursor',
      signature: 'ERR_PATTERN_REPEAT',
      text: 'Error ERR_PATTERN_REPEAT in another repository',
      rootCause: 'Unrelated project cause.',
      fix: 'Unrelated project fix.',
      command: 'npm test',
      cwd: '/tmp/other-project',
      files: ['src/cli.mjs'],
      occurrences: 10,
      firstSeenAt: '2026-01-01T00:00:00.000Z',
      lastSeenAt: '2026-01-05T00:00:00.000Z'
    })
  ];

  const lessonsPath = path.join(kernelHome, 'source', 'failures', 'failure-lessons.json');
  fs.mkdirSync(path.dirname(lessonsPath), { recursive: true });
  fs.writeFileSync(lessonsPath, JSON.stringify(lessons, null, 2) + '\n');

  const first = JSON.parse(runPublic(
    env,
    'failure', 'patterns',
    '--min-count', '3',
    '--project', repo.root,
    '--json'
  ));
  const signaturePattern = first.patterns.find((pattern) => pattern.signalType === 'error_signature' && pattern.label === 'ERR_PATTERN_REPEAT');
  if (!signaturePattern) throw new Error(`signature pattern was not detected: ${JSON.stringify(first)}`);
  if (signaturePattern.occurrenceCount !== 4 || signaturePattern.lessonCount !== 2) {
    throw new Error(`pattern counts were incorrect: ${JSON.stringify(signaturePattern)}`);
  }
  const refs = signaturePattern.evidenceReferences.slice().sort().join(',');
  if (refs !== 'failure_pattern_evidence_a,failure_pattern_evidence_b') {
    throw new Error(`pattern evidence references were incorrect: ${refs}`);
  }
  if (signaturePattern.evidenceReferences.includes('failure_pattern_other_project')) {
    throw new Error('project filter leaked unrelated evidence');
  }
  if (!signaturePattern.next.includes(`failure propose-pattern ${signaturePattern.id}`)) {
    throw new Error(`pattern did not expose its reviewable promotion path: ${JSON.stringify(signaturePattern)}`);
  }

  const second = JSON.parse(runPublic(
    env,
    'failure', 'patterns',
    '--min-count', '3',
    '--project', repo.root,
    '--json'
  ));
  const repeated = second.patterns.find((pattern) => pattern.signalType === 'error_signature' && pattern.label === 'ERR_PATTERN_REPEAT');
  if (repeated?.id !== signaturePattern.id) {
    throw new Error(`pattern id was not deterministic: ${signaturePattern.id} vs ${repeated?.id}`);
  }

  const rejected = JSON.parse(runPublic(
    env,
    'failure', 'patterns',
    '--reject', signaturePattern.id,
    '--reason', 'Known noisy fixture',
    '--project', repo.root,
    '--json'
  ));
  if (rejected.status !== 'rejected' || rejected.rejectionReason !== 'Known noisy fixture') {
    throw new Error(`pattern rejection failed: ${JSON.stringify(rejected)}`);
  }

  const hidden = JSON.parse(runPublic(
    env,
    'failure', 'patterns',
    '--min-count', '3',
    '--project', repo.root,
    '--json'
  ));
  if (hidden.patterns.some((pattern) => pattern.id === signaturePattern.id)) {
    throw new Error('rejected pattern remained in the default result');
  }

  const included = JSON.parse(runPublic(
    env,
    'failure', 'patterns',
    '--min-count', '3',
    '--project', repo.root,
    '--include-rejected',
    '--json'
  ));
  if (!included.patterns.some((pattern) => pattern.id === signaturePattern.id && pattern.status === 'rejected')) {
    throw new Error('include-rejected did not return the rejected pattern');
  }

  const restored = JSON.parse(runPublic(
    env,
    'failure', 'patterns',
    '--restore', signaturePattern.id,
    '--project', repo.root,
    '--json'
  ));
  if (restored.status !== 'detected') {
    throw new Error(`pattern restore failed: ${JSON.stringify(restored)}`);
  }

  const persistedLessons = JSON.parse(fs.readFileSync(lessonsPath, 'utf8'));
  if (persistedLessons.length !== lessons.length) {
    throw new Error('pattern decisions mutated or deleted Failure Lessons');
  }
}

export const name = 'public-cli-failure-patterns';
