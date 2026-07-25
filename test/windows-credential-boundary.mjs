import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  credentialCommandPolicy,
  runBroker,
  sanitizeWindowsBrokerPath
} from '../bin/agent-kernel-project-broker-platform.mjs';

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

  const linuxAdd = credentialCommandPolicy(['auth', 'add', 'supabase', '--profile', 'client'], 'linux');
  assert.equal(linuxAdd.allowed, false, 'Linux must not record a credential reference when no secure backend exists');
  assert.equal(linuxAdd.exitCode, 2);
  assert.match(linuxAdd.message, /secure credential backend is not configured/i);
  assert.match(linuxAdd.message, /SUPABASE_ACCESS_TOKEN/);

  const linuxRemove = credentialCommandPolicy(['auth', 'remove', 'supabase', 'client'], 'linux');
  assert.equal(linuxRemove.allowed, false);
  assert.equal(linuxRemove.exitCode, 2);
  assert.match(linuxRemove.message, /Remove SUPABASE_ACCESS_TOKEN or SUPABASE_TOKEN/i);

  assert.equal(credentialCommandPolicy(['provider', 'supabase', 'exec'], 'win32').allowed, true);
  assert.equal(credentialCommandPolicy(['auth', 'add', 'supabase'], 'darwin').allowed, true);

  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-kernel-windows-path-'));
  try {
    const systemDirectory = path.join(fixtureRoot, 'System32');
    fs.mkdirSync(path.join(systemDirectory, 'security'), { recursive: true });
    assert.equal(
      sanitizeWindowsBrokerPath(systemDirectory, 'win32'),
      systemDirectory,
      'A directory named security must not make a valid PATH entry look like an executable decoy'
    );
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }

  let delegatedMainCompleted = false;
  const delegatedExitCode = await runBroker(['help'], 'linux', async () => async () => {
    await new Promise((resolve) => setImmediate(resolve));
    delegatedMainCompleted = true;
  });
  assert.equal(delegatedExitCode, 0);
  assert.equal(delegatedMainCompleted, true, 'The platform wrapper must await the delegated broker entry point');

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
