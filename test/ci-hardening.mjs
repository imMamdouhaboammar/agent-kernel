#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workflowDir = resolve(root, '.github', 'workflows');
const expectedWorkflows = [
  'ci.yml',
  'codeql.yml',
  'npm-publish.yml',
  'readme-story-card.yml',
  'release.yml',
  'static.yml',
  'windows-ci.yml',
];

const workflowFiles = (await readdir(workflowDir))
  .filter((name) => /\.ya?ml$/u.test(name))
  .sort();
assert.deepEqual(workflowFiles, expectedWorkflows, 'workflow allowlist drifted');

for (const workflowFile of workflowFiles) {
  const content = await readFile(resolve(workflowDir, workflowFile), 'utf8');
  assert.match(content, /^permissions:\n/mu, `${workflowFile} needs top-level permissions`);
  assert.doesNotMatch(content, /pull_request_target:|repository_dispatch:|workflow_run:/u);
  assert.doesNotMatch(content, /\$\{\{\s*GITHUB_REF_NAME#/u,
    `${workflowFile} must use shell parameter expansion outside GitHub expressions`);
  assert.doesNotMatch(content, /uses:\s+[^\s]+@(?![a-f0-9]{40}(?:\s|$))/u,
    `${workflowFile} contains a mutable action reference`);
  if (content.includes('actions/checkout')) {
    assert.match(content, /persist-credentials:\s*false/u,
      `${workflowFile} must disable persisted checkout credentials`);
  }
}

const runtimeSource = await readFile(resolve(root, 'src', 'cli.mjs'), 'utf8');
assert.doesNotMatch(runtimeSource, /shell:\s*true/u, 'runtime must not invoke fixed commands through a shell');

const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
for (const [name, target] of Object.entries(packageJson.bin ?? {})) {
  assert.equal(target.startsWith('./'), false, `bin.${name} must use npm-normalized path`);
}
assert.doesNotMatch(
  packageJson.scripts?.['publish:dry'] ?? '',
  /npm publish --dry-run/u,
  'publish:dry must not fail because the current version already exists on npm',
);

const dependabot = await readFile(resolve(root, '.github', 'dependabot.yml'), 'utf8');
assert.match(dependabot, /package-ecosystem:\s*["']npm["']/u);
assert.match(dependabot, /package-ecosystem:\s*["']github-actions["']/u);

const storyCard = await readFile(resolve(workflowDir, 'readme-story-card.yml'), 'utf8');
assert.match(storyCard, /ref:\s*[a-f0-9]{40}/u, 'story-card source must be pinned to a commit SHA');
assert.match(storyCard, /persist-credentials:\s*false/gu, 'story-card checkouts must not persist credentials');
assert.match(storyCard, /changed content outside the managed story block/u,
  'story-card updater must enforce its managed README boundary');
assert.doesNotMatch(storyCard, /uses:\s*[^\s]+@(main|master|v\d+)/u,
  'story-card workflow must not use mutable action or reusable-workflow refs');

const pages = await readFile(resolve(workflowDir, 'static.yml'), 'utf8');
assert.match(pages, /path:\s*['"]?docs['"]?/u, 'Pages must publish docs only');
assert.doesNotMatch(pages, /path:\s*['"]?\.['"]?/u, 'Pages must not upload the repository root');

const ci = await readFile(resolve(workflowDir, 'ci.yml'), 'utf8');
for (const version of ['18.x', '20.x', '22.x', '24.x']) {
  assert.match(ci, new RegExp(`\\b${version.replace('.', '\\.')}\\b`, 'u'), `CI must cover Node ${version}`);
}

const windowsCi = await readFile(resolve(workflowDir, 'windows-ci.yml'), 'utf8');
for (const version of ['18.x', '20.x', '22.x']) {
  assert.match(windowsCi, new RegExp(`\\b${version.replace('.', '\\.')}\\b`, 'u'), `Windows CI must cover Node ${version}`);
}

const npmPublish = await readFile(resolve(workflowDir, 'npm-publish.yml'), 'utf8');
assert.match(npmPublish, /id-token:\s*write/u, 'npm publishing must mint an OIDC token');
assert.match(npmPublish, /node-version:\s*24\.x/u, 'trusted publishing must run on Node 24');
assert.match(npmPublish, /id-token:\s*write/u, 'npm publishing must mint an OIDC token');
assert.match(npmPublish, /npm publish --access public/u);
assert.match(npmPublish, /Published with npm trusted publishing/u, 'OIDC must be the primary publish path');
assert.match(npmPublish, /temporary token fallback/u, 'token auth must be explicitly transitional');
assert.match(npmPublish, /NODE_AUTH_TOKEN="\$NPM_TOKEN" npm publish --access public --provenance/u,
  'fallback must scope the write token to one publish command');
assert.doesNotMatch(npmPublish, /name:\s*Check npm token/u, 'release must not require a token before trying OIDC');

const release = await readFile(resolve(workflowDir, 'release.yml'), 'utf8');
assert.doesNotMatch(release, /softprops\/action-gh-release/u);
assert.match(release, /gh release create/u);
assert.match(release, /npm pack/u, 'release must attach the canonical npm tarball');
assert.match(release, /SHA256SUMS/u, 'release must attach SHA-256 checksums');
assert.match(release, /sha256sum/u, 'release must generate checksums on the runner');

console.log('CI and release hardening checks passed.');
