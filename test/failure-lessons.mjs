// test/failure-lessons.mjs — Failure Lessons capture/search/show/validate.
//
// Invariants:
//   1. `agent-kernel failure capture` stores a local failure lesson.
//   2. Repeated capture of the same signature + command deduplicates by default.
//   3. `search`, `show`, and `validate` expose the stored lesson safely.
//
// This is intentionally a focused smoke test. Hook payload behavior and proposal
// promotion are integration surfaces and should be covered by narrower tests that
// can report their own failure names.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import childProcess from 'node:child_process';
import { assertContains, makeEnv, repo, runCli } from './_lib/helpers.mjs';

const cli = path.join(repo.root, 'bin', 'agent-kernel-failure.mjs');

function runFailure(env, args, input = '') {
  const result = childProcess.spawnSync(process.execPath, [cli, ...args], {
    cwd: repo.root,
    env: { ...env, AGENT_KERNEL_CLI: repo.cli },
    input,
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}

function readLessons(storePath) {
  return JSON.parse(fs.readFileSync(storePath, 'utf8'));
}

export async function run() {
  const { env, kernelHome } = makeEnv();
  runCli(env, 'init', '--sync');

  const captured = runFailure(env, [
    'capture',
    '--from', 'test-agent',
    '--type', 'test-failure',
    '--command', 'npm test',
    '--exit-code', '1',
    '--root-cause', 'Node ESM import path missed its explicit extension.',
    '--fix', 'Add the explicit .js extension to the relative import.',
    '--text', 'Error [ERR_MODULE_NOT_FOUND]: Cannot find module ./core'
  ]);
  assertContains(captured, 'Captured failure lesson:', 'failure capture did not report a captured lesson');

  const storePath = path.join(kernelHome, 'source', 'failures', 'failure-lessons.json');
  const lessons = readLessons(storePath);
  assert.equal(lessons.length, 1);
  assert.equal(lessons[0].errorSignature, 'ERR_MODULE_NOT_FOUND');
  assert.equal(lessons[0].agent, 'test-agent');
  assert.equal(lessons[0].evidence.command, 'npm test');
  assert.equal(lessons[0].occurrences, 1);

  const duplicate = runFailure(env, [
    'capture',
    '--from', 'test-agent',
    '--type', 'test-failure',
    '--command', 'npm test',
    '--exit-code', '1',
    '--text', 'Error [ERR_MODULE_NOT_FOUND]: Cannot find module ./core'
  ]);
  assertContains(duplicate, 'Updated existing failure lesson:', 'duplicate failure did not dedupe');

  const afterDuplicate = readLessons(storePath);
  assert.equal(afterDuplicate.length, 1);
  assert.equal(afterDuplicate[0].occurrences, 2);

  const search = runFailure(env, ['search', 'ERR_MODULE_NOT_FOUND']);
  assertContains(search, 'ERR_MODULE_NOT_FOUND', 'failure search missing captured signature');

  const show = runFailure(env, ['show', lessons[0].id]);
  assertContains(show, 'Node ESM import path', 'failure show missing stored root cause');

  const validate = runFailure(env, ['validate']);
  assertContains(validate, 'Failure lessons valid', 'failure validate did not accept the captured lesson');
}

export const name = 'failure-lessons';
