import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { credentialCommandPolicy } from '../bin/agent-kernel-project-broker-platform.mjs';

export const name = 'windows-credential-boundary';

function sanitizedWindowsTestEnvironment() {
  const names = ['PATH', 'SystemRoot', 'ComSpec', 'PATHEXT', 'TEMP', 'TMP'];
  return Object.fromEntries(names
    .filter((name) => process.env[name] !== undefined)
    .map((name) => [name, process.env[name]]));
}

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
  assert.match(windowsRemove.message, /Remove SUPABASE_ACCESS_TOKEN or SUPABASE_TOKEN/i);

  assert.equal(credentialCommandPolicy(['provider', 'supabase', 'exec'], 'win32').allowed, true);
  assert.equal(credentialCommandPolicy(['auth', 'add', 'supabase'], 'darwin').allowed, true);

  if (process.platform === 'win32') {
    const routerPath = fileURLToPath(new URL('../bin/agent-kernel-router.mjs', import.meta.url));
    const result = childProcess.spawnSync(process.execPath, [routerPath, 'auth', 'add', 'supabase', '--profile', 'client'], {
      encoding: 'utf8',
      env: sanitizedWindowsTestEnvironment()
    });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Windows Credential Manager backend is not configured/i);
    assert.doesNotMatch(result.stdout + result.stderr, /credential_ref|Added auth profile|secret|token value/i);
  }
}
