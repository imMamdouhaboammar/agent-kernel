import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const checker = join(root, 'scripts', 'check-doc-links.mjs');

export const name = 'doc-links';

function runChecker(targetRoot) {
  return spawnSync(process.execPath, [checker, targetRoot], {
    cwd: targetRoot,
    encoding: 'utf8'
  });
}

export async function run() {
  const repositoryResult = runChecker(root);
  assert.equal(
    repositoryResult.status,
    0,
    `documentation link check failed\nstdout:\n${repositoryResult.stdout}\nstderr:\n${repositoryResult.stderr}`
  );
  assert.match(repositoryResult.stdout, /Checked \d+ local links across \d+ markdown files\./);
  assert.match(repositoryResult.stdout, /All local markdown links resolve\./);

  const fixtureRoot = mkdtempSync(join(tmpdir(), 'agent-kernel-doc-links-'));
  try {
    mkdirSync(join(fixtureRoot, 'docs'));
    writeFileSync(join(fixtureRoot, 'docs', 'setup.md'), '# Setup\n');
    writeFileSync(
      join(fixtureRoot, 'README.md'),
      '[Setup guide][setup]\n\n[setup]: ./docs/setup.md "Setup"\n'
    );

    const valid = runChecker(fixtureRoot);
    assert.equal(valid.status, 0, `valid reference link failed\n${valid.stderr}`);
    assert.match(valid.stdout, /Checked 1 local links across 2 markdown files\./);

    writeFileSync(
      join(fixtureRoot, 'README.md'),
      [
        '[Setup](./docs/setup.md)',
        '',
        '````markdown',
        '[Ignored inline](./docs/missing-inline.md)',
        '```',
        '[Ignored reference][missing]',
        '',
        '[missing]: ./docs/missing-reference.md',
        '````',
        '',
        '~~~text',
        '[Ignored tilde](./docs/missing-tilde.md)',
        '~~~~',
        ''
      ].join('\n')
    );

    const fenced = runChecker(fixtureRoot);
    assert.equal(fenced.status, 0, `links inside variable-length fences should be ignored\n${fenced.stderr}`);
    assert.match(fenced.stdout, /Checked 1 local links across 2 markdown files\./);

    writeFileSync(
      join(fixtureRoot, 'README.md'),
      '[Missing guide][missing]\n\n[missing]: <.\/docs\/missing.md>\n'
    );
    const broken = runChecker(fixtureRoot);
    assert.equal(broken.status, 1, 'broken reference-style link should fail');
    assert.match(broken.stderr, /README\.md: \.\/docs\/missing\.md/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
}
