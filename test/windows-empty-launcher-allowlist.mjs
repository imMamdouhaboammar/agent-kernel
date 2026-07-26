import assert from 'node:assert/strict';
import { normalizeChildCommand } from '../bin/agent-kernel-command-runner.mjs';

export const name = 'windows-empty-launcher-allowlist';

export async function run() {
  assert.throws(() => normalizeChildCommand(
    'C:\\tools\\supabase.cmd',
    ['status'],
    {
      platform: 'win32',
      systemRoot: 'C:\\Windows',
      comspec: 'C:\\Windows\\System32\\cmd.exe',
      allowedBatchNames: ['supabase'],
      allowedBatchExecutables: [],
      allowedBatchDirectories: ['C:\\tools']
    }
  ), /exact allowlist is configured but empty/i);
}
