import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

export const name = 'doc-links';

export async function run() {
  const result = spawnSync(process.execPath, [join(root, 'scripts', 'check-doc-links.mjs')], {
    cwd: root,
    encoding: 'utf8'
  });

  assert.equal(
    result.status,
    0,
    `documentation link check failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  );
  assert.match(result.stdout, /Checked \d+ local links across \d+ markdown files\./);
  assert.match(result.stdout, /All local markdown links resolve\./);
}
