import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  credentialCommandPolicy
} from '../bin/agent-kernel-project-broker-platform.mjs';

export const name = 'windows-credential-boundary';

export async function run() {
  const windowsAdd = credentialCommandPolicy(['auth', 'add', 'supabase', '--profile', 'client'], 'win32');
  assert.equal(windowsAdd.allowed, false);
  assert.equal(windowsAdd.exitCode, 2);
  assert.match(windowsAdd.message, /Windows Credential Manager backend is not configured/i);
  assert.match(windowsAdd.message, /SUPABASE_ACCESS_TOKEN/);
  assert.doesNotMatch(windowsAdd.message, /secret|token value/i);

  const windowsRemove = credentialCommandPolicy(['auth', 'remove', 'supabase', 'client'], 'win32');
  assert.equal(windowsRemove.allowed, false);
  assert.equal(windowsRemove.exitCode, 2);
  assert.match(windowsRemove.message, /remove the environment variable/i);

  assert.equal(credentialCommandPolicy(['provider', 'supabase', 'exec'], 'win32').allowed, true);
  assert.equal(credentialCommandPolicy(['auth', 'add', 'supabase'], 'darwin').allowed, true);

  if (process.platform === 'win32') {
    const wrapperPath = fileURLToPath(new URL('../bin/agent-kernel-project-broker-platform.mjs', import.meta.url));
    const result = childProcess.spawnSync(process.execPath, [wrapperPath, 'auth', 'add', 'supabase', '--profile', 'client'], {
      encoding: 'utf8',
      env: process.env
    });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Windows Credential Manager backend is not configured/i);
    assert.doesNotMatch(result.stdout + result.stderr, /credential_ref|Added auth profile/i);
  }
}
