// test/failure-lessons.mjs — Failure Lessons capture/search/show/propose.
//
// Invariants:
//   1. `agent-kernel failure capture` stores a local failure lesson.
//   2. Repeated capture of the same signature + command deduplicates by default.
//   3. `search`, `show`, and `validate` expose the stored lesson safely.
//   4. The hook adapter captures failed tool payloads and returns structured Claude context.
//   5. `propose` creates a normal pending memory proposal.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import childProcess from 'node:child_process';
import { assertContains, makeEnv, repo, runCli } from './_lib/helpers.mjs';

const cli = path.join(repo.root, 'bin', 'agent-kernel-failure.mjs');
const hook = path.join(repo.root, 'bin', 'agent-kernel-failure-hook.mjs');

function failureEnv(env) {
  return { ...env, AGENT_KERNEL_CLI: repo.cli };
}

function runFailure(env, args, input = '') {
  const result = childProcess.spawnSync(process.execPath, [cli, ...args], {
    cwd: repo.root,
    env: failureEnv(env),
    input,
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
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
  assert.match(captured, /Captured failure lesson:/);

  const storePath = path.join(kernelHome, 'source', 'failures', 'failure-lessons.json');
  const lessons = JSON.parse(fs.readFileSync(storePath, 'utf8'));
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
  assert.match(duplicate, /Updated existing failure lesson:/);
  const afterDuplicate = JSON.parse(fs.readFileSync(storePath, 'utf8'));
  assert.equal(afterDuplicate.length, 1);
  assert.equal(afterDuplicate[0].occurrences, 2);

  const search = runFailure(env, ['search', 'ERR_MODULE_NOT_FOUND']);
  assert.match(search, /ERR_MODULE_NOT_FOUND/);

  const show = runFailure(env, ['show', lessons[0].id]);
  assert.match(show, /Node ESM import path/);

  const validate = runFailure(env, ['validate']);
  assertContains(validate, 'Failure lessons valid', 'failure validate did not accept the captured lesson');

  const hookResult = childProcess.spawnSync(process.execPath, [hook], {
    cwd: repo.root,
    env: failureEnv(env),
    input: JSON.stringify({
      hook_event_name: 'PostToolUseFailure',
      tool_name: 'Bash',
      tool_input: { command: 'npm run build' },
      tool_response: { exit_code: 1, stderr: 'TS2307: Cannot find module ./thing' }
    }),
    encoding: 'utf8'
  });
  assert.equal(hookResult.status, 0, hookResult.stderr || hookResult.stdout);
  const hookJson = JSON.parse(hookResult.stdout);
  assert.equal(hookJson.suppressOutput, true);
  assert.equal(hookJson.hookSpecificOutput.hookEventName, 'PostToolUseFailure');
  assertContains(hookJson.hookSpecificOutput.additionalContext, 'Agent Kernel captured Failure Lesson', 'hook did not return Claude context');
  assertContains(hookJson.hookSpecificOutput.additionalContext, 'TS2307', 'hook context missing signature');

  const afterHook = JSON.parse(fs.readFileSync(storePath, 'utf8'));
  assert.equal(afterHook.length, 2);
  assert.equal(afterHook[1].errorSignature, 'TS2307');

  const proposeOut = runFailure(env, ['propose', lessons[0].id, '--as', 'rule']);
  assertContains(proposeOut, 'Created pending memory proposal', 'failure propose did not create a memory proposal');
}

export const name = 'failure-lessons';
