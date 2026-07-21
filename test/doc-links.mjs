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
    writeFileSync(join(fixtureRoot, 'README.md'), '[Setup guide][setup]\n\n[setup]: ./docs/setup.md "Setup"\n');
    const valid = runChecker(fixtureRoot);
    assert.equal(valid.status, 0, `valid reference link failed\n${valid.stderr}`);
    assert.match(valid.stdout, /Checked 1 local links across 2 markdown files\./);

    writeFileSync(join(fixtureRoot, 'README.md'), ['[Setup](./docs/setup.md)', '', '````markdown', '[Ignored inline](./docs/missing-inline.md)', '```', '[Ignored reference][missing]', '', '[missing]: ./docs/missing-reference.md', '````', '', '~~~text', '[Ignored tilde](./docs/missing-tilde.md)', '~~~~', ''].join('\n'));
    const fenced = runChecker(fixtureRoot);
    assert.equal(fenced.status, 0, `links inside variable-length fences should be ignored\n${fenced.stderr}`);
    assert.match(fenced.stdout, /Checked 1 local links across 2 markdown files\./);

    writeFileSync(join(fixtureRoot, 'README.md'), ['[Setup](./docs/setup.md)', '', '`[Ignored](./docs/missing-inline.md)`', '', '``Use `[Ignored nested](./docs/missing-nested.md)` literally``', '', 'Unmatched ` opener keeps [Setup](./docs/setup.md) visible.', ''].join('\n'));
    const inlineCode = runChecker(fixtureRoot);
    assert.equal(inlineCode.status, 0, `links inside inline code should be ignored\n${inlineCode.stderr}`);
    assert.match(inlineCode.stdout, /Checked 2 local links across 2 markdown files\./);

    writeFileSync(join(fixtureRoot, 'README.md'), ['[Setup](./docs/setup.md)', '', '<!-- [Ignored inline](./docs/missing-comment-inline.md) -->', '', '<!--', '[Ignored reference][comment-missing]', '', '[comment-missing]: ./docs/missing-comment-reference.md', '-->', '', 'Before <!-- [Ignored embedded](./docs/missing-comment-embedded.md) --> after.', ''].join('\n'));
    const htmlComments = runChecker(fixtureRoot);
    assert.equal(htmlComments.status, 0, `links inside HTML comments should be ignored\n${htmlComments.stderr}`);
    assert.match(htmlComments.stdout, /Checked 1 local links across 2 markdown files\./);

    writeFileSync(join(fixtureRoot, 'README.md'), ['[Setup](./docs/setup.md)', '', '<!--', '[Ignored unterminated](./docs/missing-comment-unterminated.md)', ''].join('\n'));
    const unterminatedComment = runChecker(fixtureRoot);
    assert.equal(unterminatedComment.status, 0, `unterminated HTML comment should hide the remaining comment body\n${unterminatedComment.stderr}`);
    assert.match(unterminatedComment.stdout, /Checked 1 local links across 2 markdown files\./);

    writeFileSync(join(fixtureRoot, 'docs', 'guide(v2).md'), '# Guide v2\n');
    writeFileSync(join(fixtureRoot, 'README.md'), '[Guide v2](./docs/guide(v2).md)\n');
    const parenthesized = runChecker(fixtureRoot);
    assert.equal(parenthesized.status, 0, `balanced parentheses in local link destinations should resolve\n${parenthesized.stderr}`);
    assert.match(parenthesized.stdout, /Checked 1 local links across 3 markdown files\./);

    writeFileSync(join(fixtureRoot, 'README.md'), '[Missing guide][missing]\n\n[missing]: <.\/docs\/missing.md>\n');
    const broken = runChecker(fixtureRoot);
    assert.equal(broken.status, 1, 'broken reference-style link should fail');
    assert.match(broken.stderr, /README\.md: \.\/docs\/missing\.md/);

    writeFileSync(join(fixtureRoot, 'README.md'), ['```json', '{ "path": "/Users/mamdouh/Projects/internal-repo" }', '```', ''].join('\n'));
    const privateMacPath = runChecker(fixtureRoot);
    assert.equal(privateMacPath.status, 1, 'repository owner macOS home paths should fail documentation checks');
    assert.match(privateMacPath.stderr, /README\.md:2: \/Users\/mamdouh\//);

    writeFileSync(join(fixtureRoot, 'README.md'), ['Use `$HOME/Projects/example`, `~/Projects/example`, or `/Users/<user>/Projects/example`.', ''].join('\n'));
    const portablePaths = runChecker(fixtureRoot);
    assert.equal(portablePaths.status, 0, `portable path placeholders should pass\n${portablePaths.stderr}`);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
}
