import assert from 'node:assert/strict';
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
    args: ['/d', '/c', 'npm.cmd', 'view', 'pkg', 'version']
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

  const executable = normalizeUpdateCommand('npm', ['view'], {
    platform: 'linux',
    comspec: 'cmd.exe',
    node: '/usr/bin/node'
  });
  assert.deepEqual(executable, { command: 'npm', args: ['view'] });
}
