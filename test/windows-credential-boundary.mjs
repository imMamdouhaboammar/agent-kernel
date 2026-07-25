import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  installChildProcessCompatibility,
  normalizeChildCommand
} from '../bin/agent-kernel-command-runner.mjs';
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
  const packageJsonPath = fileURLToPath(new URL('../package.json', import.meta.url));
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  assert.equal(
    packageJson.bin['agent-kernel-project-broker'],
    './bin/agent-kernel-project-broker-platform.mjs',
    'The published broker binary must enter through the platform security boundary'
  );
  const brokerSource = fs.readFileSync(
    fileURLToPath(new URL('../bin/agent-kernel-project-broker.mjs', import.meta.url)),
    'utf8'
  );
  assert.match(
    brokerSource,
    /import childProcess from 'node:child_process';/,
    'The broker must use the mutable default child_process export used by the compatibility boundary'
  );
  assert.doesNotMatch(
    brokerSource,
    /import\s*\{[^}]*spawnSync[^}]*\}\s*from\s*'node:child_process'/,
    'The broker must not bypass the compatibility boundary through a named spawnSync import'
  );

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

  const normalizedBatch = normalizeChildCommand(
    'C:\\Program Files\\Supabase\\supabase.cmd',
    ['status', '--project-ref', 'project with spaces', '100% literal'],
    {
      platform: 'win32',
      systemRoot: 'C:\\Windows',
      comspec: 'C:\\Windows\\System32\\cmd.exe',
      node: 'C:\\node.exe',
      allowedBatchNames: ['supabase'],
      allowedBatchDirectories: ['C:\\Program Files\\Supabase'],
      validateFiles: false
    }
  );
  assert.equal(normalizedBatch.command, 'C:\\Windows\\System32\\cmd.exe');
  assert.deepEqual(normalizedBatch.args.slice(0, 3), ['/d', '/s', '/c']);
  assert.equal(normalizedBatch.windowsVerbatimArguments, true);
  assert.match(normalizedBatch.args[3], /supabase\.cmd/);
  assert.match(normalizedBatch.args[3], /project with spaces/);
  assert.match(normalizedBatch.args[3], /100%:~,% literal/);
  assert.equal(normalizedBatch.shell, undefined);

  assert.throws(() => normalizeChildCommand(
    'C:\\tools\\malware.cmd',
    [],
    {
      platform: 'win32',
      systemRoot: 'C:\\Windows',
      comspec: 'C:\\Windows\\System32\\cmd.exe',
      allowedBatchNames: ['supabase'],
      allowedBatchDirectories: ['C:\\tools'],
      validateFiles: false
    }
  ), /not allowlisted/i);
  assert.throws(() => normalizeChildCommand(
    'C:\\tools\\supabase.cmd',
    [],
    {
      platform: 'win32',
      systemRoot: 'C:\\Windows',
      comspec: 'C:\\Temp\\cmd.exe',
      allowedBatchNames: ['supabase'],
      allowedBatchDirectories: ['C:\\tools'],
      validateFiles: false
    }
  ), /untrusted Windows command processor/i);
  assert.throws(() => normalizeChildCommand(
    'C:\\Temp\\supabase.cmd',
    [],
    {
      platform: 'win32',
      systemRoot: 'C:\\Windows',
      comspec: 'C:\\Windows\\System32\\cmd.exe',
      allowedBatchNames: ['supabase'],
      allowedBatchDirectories: ['C:\\Program Files\\Supabase']
    }
  ), /directory is not trusted/i);

  const normalizedScript = normalizeChildCommand(
    'C:\\tools\\provider.mjs',
    ['status'],
    {
      platform: 'win32',
      node: 'C:\\node.exe',
      allowJavaScript: true,
      validateFiles: false
    }
  );
  assert.equal(normalizedScript.command, 'C:\\node.exe');
  assert.deepEqual(normalizedScript.args, ['C:\\tools\\provider.mjs', 'status']);

  const redirectedBroker = normalizeChildCommand(
    'C:\\node.exe',
    ['C:\\agent-kernel\\bin\\agent-kernel-project-broker.mjs', 'approvals', 'list'],
    {
      platform: 'win32',
      node: 'C:\\node.exe',
      validateFiles: false,
      entryPointRedirects: {
        'C:\\agent-kernel\\bin\\agent-kernel-project-broker.mjs':
          'C:\\agent-kernel\\bin\\agent-kernel-project-broker-platform.mjs'
      }
    }
  );
  assert.equal(redirectedBroker.command, 'C:\\node.exe');
  assert.deepEqual(redirectedBroker.args, [
    'C:\\agent-kernel\\bin\\agent-kernel-project-broker-platform.mjs',
    'approvals',
    'list'
  ]);

  const calls = [];
  const fakeChildProcess = {
    execFileSync(command, args, options) {
      calls.push({ method: 'execFileSync', command, args, options });
      return 'ok';
    },
    spawnSync(command, args, options) {
      calls.push({ method: 'spawnSync', command, args, options });
      return { status: 0 };
    }
  };
  const restoreCompatibility = installChildProcessCompatibility(fakeChildProcess, {
    platform: 'win32',
    systemRoot: 'C:\\Windows',
    comspec: 'C:\\Windows\\System32\\cmd.exe',
    node: 'C:\\node.exe',
    allowedBatchNames: ['provider'],
    allowedBatchDirectories: ['C:\\tools'],
    validateFiles: false
  });
  try {
    fakeChildProcess.execFileSync('C:\\tools\\provider.cmd', { encoding: 'utf8' });
    fakeChildProcess.spawnSync('C:\\tools\\provider.cmd', ['status'], { cwd: 'C:\\workspace' });
  } finally {
    restoreCompatibility();
  }
  assert.deepEqual(calls[0].args.slice(0, 3), ['/d', '/s', '/c']);
  assert.equal(calls[0].options.encoding, 'utf8', 'execFileSync(file, options) must preserve its overload options');
  assert.equal(calls[0].options.windowsVerbatimArguments, true);
  assert.equal(calls[1].options.cwd, 'C:\\workspace');
  assert.equal(calls[1].options.windowsVerbatimArguments, true);

  if (process.platform !== 'darwin') {
    const brokerPlatformPath = fileURLToPath(new URL('../bin/agent-kernel-project-broker-platform.mjs', import.meta.url));
    const result = childProcess.spawnSync(
      process.execPath,
      [brokerPlatformPath, 'auth', 'add', 'supabase', '--profile', 'client'],
      {
        encoding: 'utf8',
        env: process.platform === 'win32' ? sanitizedWindowsTestEnvironment() : process.env
      }
    );
    assert.equal(result.status, 2);
    assert.match(result.stderr, /credential backend is not configured|Windows Credential Manager backend is not configured/i);
    assert.doesNotMatch(result.stdout + result.stderr, /credential_ref|Added auth profile|secret|token value/i);
  }

  if (process.platform === 'win32') {
    const percentRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-kernel-percent-'));
    try {
      const percentLauncher = path.join(percentRoot, 'supabase.cmd');
      fs.writeFileSync(percentLauncher, '@echo off\r\n<nul set /p "=%~1"\r\n', 'utf8');
      const invocation = normalizeChildCommand(
        percentLauncher,
        ['100% literal %PATH%'],
        {
          allowedBatchNames: ['supabase'],
          allowedBatchDirectories: [percentRoot]
        }
      );
      const output = childProcess.execFileSync(invocation.command, invocation.args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsVerbatimArguments: invocation.windowsVerbatimArguments
      });
      assert.equal(output, '100% literal %PATH%');
    } finally {
      fs.rmSync(percentRoot, { recursive: true, force: true });
    }

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
