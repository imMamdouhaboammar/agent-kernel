// test/version.mjs — Version consistency (SSOT).
//
// Invariants:
//   1. `agent-kernel --version` matches package.json#version.
//   2. package.json exposes an exact SemVer version without a v prefix.
//   3. Source and built CLI artifacts expose the same VERSION.
//   4. Every helper binary that exposes VERSION matches package.json.
//   5. Claude plugin and marketplace metadata match package.json.
//   6. README stable release metadata matches package.json.

import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { assertContains, makeEnv, repo, runCli } from './_lib/helpers.mjs';

const exactSemverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

function walkMjsFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkMjsFiles(path));
    else if (entry.isFile() && extname(entry.name) === '.mjs') files.push(path);
  }
  return files;
}

function assertVersion(label, actual, expected) {
  if (actual !== expected) {
    throw new Error(`${label} = "${actual}", expected "${expected}"`);
  }
}

export async function run() {
  const { env } = makeEnv();
  const pkg = JSON.parse(readFileSync(join(repo.root, 'package.json'), 'utf8'));
  const expected = pkg.version;

  if (typeof expected !== 'string' || !exactSemverPattern.test(expected)) {
    throw new Error(`package.json version must be exact SemVer without a v prefix, received ${JSON.stringify(expected)}`);
  }

  const readmeText = readFileSync(join(repo.root, 'README.md'), 'utf8');
  const readmeStableRelease = readmeText.match(/Current stable release:\s*<a\b[^>]*>v([^<]+)<\/a>/);
  if (!readmeStableRelease) {
    throw new Error('README.md must contain a parseable Current stable release marker');
  }
  assertVersion('README.md stable release', readmeStableRelease[1], expected);

  const cliVersion = runCli(env, '--version').trim();
  assertVersion('CLI --version', cliVersion, expected);

  const distText = readFileSync(join(repo.root, 'dist', 'cli.mjs'), 'utf8');
  assertContains(distText, `const VERSION = '${expected}'`, 'dist/cli.mjs VERSION drift');

  const srcText = readFileSync(join(repo.root, 'src', 'cli.mjs'), 'utf8');
  assertContains(srcText, `const VERSION = '${expected}'`, 'src/cli.mjs VERSION drift');

  let versionedBinaries = 0;
  for (const path of walkMjsFiles(join(repo.root, 'bin'))) {
    const text = readFileSync(path, 'utf8');
    const match = text.match(/const VERSION = ['"]([^'"]+)['"]/);
    if (!match) continue;
    versionedBinaries += 1;
    assertVersion(`${relative(repo.root, path)} VERSION`, match[1], expected);
  }

  if (versionedBinaries === 0) {
    throw new Error('expected at least one versioned helper binary under bin/');
  }

  const plugin = JSON.parse(readFileSync(join(repo.root, '.claude-plugin', 'plugin.json'), 'utf8'));
  assertVersion('.claude-plugin/plugin.json version', plugin.version, expected);

  const marketplace = JSON.parse(readFileSync(join(repo.root, '.claude-plugin', 'marketplace.json'), 'utf8'));
  assertVersion('.claude-plugin/marketplace.json version', marketplace.version, expected);

  if (!Array.isArray(marketplace.plugins) || marketplace.plugins.length === 0) {
    throw new Error('.claude-plugin/marketplace.json must contain at least one plugin entry');
  }

  for (const [index, entry] of marketplace.plugins.entries()) {
    const name = typeof entry?.name === 'string' ? entry.name : `plugins[${index}]`;
    assertVersion(`marketplace plugin ${name} version`, entry?.version, expected);
  }
}

export const name = 'version';
