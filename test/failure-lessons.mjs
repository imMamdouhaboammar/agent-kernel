#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import childProcess from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cli = path.join(root, 'bin', 'agent-kernel-failure.mjs');
const hook = path.join(root, 'bin', 'agent-kernel-failure-hook.mjs');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-kernel-failure-'));
const env = { ...process.env, AGENT_KERNEL_HOME: home };

function run(args, input = '') {
  const result = childProcess.spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    env,
    input,
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}

const captured = run([
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

const storePath = path.join(home, 'source', 'failures', 'failure-lessons.json');
const lessons = JSON.parse(fs.readFileSync(storePath, 'utf8'));
assert.equal(lessons.length, 1);
assert.equal(lessons[0].errorSignature, 'ERR_MODULE_NOT_FOUND');
assert.equal(lessons[0].agent, 'test-agent');
assert.equal(lessons[0].evidence.command, 'npm test');

const search = run(['search', 'ERR_MODULE_NOT_FOUND']);
assert.match(search, /ERR_MODULE_NOT_FOUND/);

const show = run(['show', lessons[0].id]);
assert.match(show, /Node ESM import path/);

const hookResult = childProcess.spawnSync(process.execPath, [hook], {
  cwd: root,
  env,
  input: JSON.stringify({
    tool_input: { command: 'npm run build' },
    tool_response: { exit_code: 1, stderr: 'TS2307: Cannot find module ./thing' }
  }),
  encoding: 'utf8'
});
assert.equal(hookResult.status, 0, hookResult.stderr || hookResult.stdout);
const afterHook = JSON.parse(fs.readFileSync(storePath, 'utf8'));
assert.equal(afterHook.length, 2);
assert.equal(afterHook[1].errorSignature, 'TS2307');

console.log('failure lessons smoke: OK');
