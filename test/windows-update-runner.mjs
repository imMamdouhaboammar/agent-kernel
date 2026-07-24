import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { normalizeUpdateCommand } from '../bin/agent-kernel-update-runner.mjs';

export const name = 'windows-update-runner';

export async function run() {
  const cmd = normalizeUpdateCommand('npm.cmd', ['view', 'pkg', 'version'], {
    platform: 'win32',
    comspec: 'C:\\Windows\\System32\\cmd.exe',
    node: 'C:\\Program Files\\nodejs\\node.exe'
  });
  assert.deepEqual(cmd, {
    command: 'C:\\Windows\\System32\\cmd.exe',
    args: ['/d', '/s', '/c', '""npm.cmd" "view" "pkg" "version""'],
    windowsVerbatimArguments: true
  });

  const batch = normalizeUpdateCommand('C:\\Program Files\\UPDATE.BAT', ['argument with spaces'], {
    platform: 'win32',
    comspec: 'cmd.exe',
    node: 'node.exe'
  });
  assert.deepEqual(batch, {
    command: 'cmd.exe',
    args: ['/d', '/s', '/c', '""C:\\Program Files\\UPDATE.BAT" "argument with spaces""'],
    windowsVerbatimArguments: true
  });

  const script = normalizeUpdateCommand('C:\\temp\\fake-npm.mjs', ['view'], {
    platform: 'win32',
    comspec: 'cmd.exe',
    node: 'C:\\Program Files\\nodejs\\node.exe'
  });
  assert.deepEqual(script, {
    command: 'C:\\Program Files\\nodejs\\node.exe',
    args: ['C:\\temp\\fake-npm.mjs', 'view']
  });

  const commonJs = normalizeUpdateCommand('C:\\temp\\fake-cli.CJS', ['version'], {
    platform: 'win32',
    comspec: 'cmd.exe',
    node: 'node.exe'
  });
  assert.deepEqual(commonJs, { command: 'node.exe', args: ['C:\\temp\\fake-cli.CJS', 'version'] });

  const executable = normalizeUpdateCommand('npm', ['view'], {
    platform: 'linux',
    comspec: 'cmd.exe',
    node: '/usr/bin/node'
  });
  assert.deepEqual(executable, { command: 'npm', args: ['view'] });

  if (process.platform === 'win32') {
    const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent kernel updater '));
    const fixture = path.join(fixtureDir, 'echo args.cmd');
    fs.writeFileSync(fixture, '@echo off\r\necho %~1^|%~2\r\n', 'utf8');
    const invocation = normalizeUpdateCommand(fixture, ['argument with spaces', 'plain']);
    const output = childProcess.execFileSync(invocation.command, invocation.args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsVerbatimArguments: invocation.windowsVerbatimArguments
    }).trim();
    assert.equal(output, 'argument with spaces|plain');
  }
}
