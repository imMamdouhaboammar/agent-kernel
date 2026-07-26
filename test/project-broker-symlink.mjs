import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const name = 'project-broker-symlink';

export async function run() {
  if (process.platform === 'win32') return;

  const wrapperPath = fileURLToPath(new URL('../bin/agent-kernel-project-broker-platform.mjs', import.meta.url));
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-kernel-broker-bin-'));
  const linkedBinary = path.join(fixtureRoot, 'agent-kernel-project-broker');

  try {
    fs.symlinkSync(wrapperPath, linkedBinary);
    const result = childProcess.spawnSync(process.execPath, [linkedBinary, 'help'], {
      encoding: 'utf8',
      env: process.env
    });

    assert.equal(result.status, 0);
    assert.notEqual(
      result.stdout.trim(),
      '',
      'The npm-style symlinked broker executable must run the platform wrapper instead of exiting silently'
    );
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const modulePath = fileURLToPath(import.meta.url);
if (invokedPath === modulePath) await run();
