#!/usr/bin/env node
// scripts/check-version.mjs — Single-source-of-truth version check.
//
// Enforces that every shipped version surface matches package.json.
// Run this in CI and locally before tagging a release.
//
// Exit codes:
//   0 — versions agree
//   1 — version drift or malformed version metadata detected
//   2 — required file missing or unreadable

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pkgPath = join(root, 'package.json');
const srcPath = join(root, 'src', 'cli.mjs');
const distPath = join(root, 'dist', 'cli.mjs');
const binPath = join(root, 'bin');
const pluginPath = join(root, '.claude-plugin', 'plugin.json');
const marketplacePath = join(root, '.claude-plugin', 'marketplace.json');

let failed = false;
const ok = (message) => console.log(`  ✓ ${message}`);
const err = (message) => {
  console.log(`  ✗ ${message}`);
  failed = true;
};

function readJson(label, path) {
  if (!existsSync(path)) {
    console.error(`${label} not found at ${path}`);
    process.exit(2);
  }

  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    console.error(`${label} is not valid JSON: ${error.message}`);
    process.exit(2);
  }
}

function checkVersion(label, actual, expected) {
  if (typeof actual !== 'string' || actual.length === 0) {
    err(`${label} has no usable version`);
    return;
  }

  if (actual === expected) ok(`${label} = ${actual}`);
  else err(`${label} = ${actual} (expected ${expected})`);
}

function readCliVersion(label, path, expected) {
  if (!existsSync(path)) {
    err(`${label} missing at ${path} — run npm run build`);
    return;
  }

  const text = readFileSync(path, 'utf8');
  const match = text.match(/const VERSION = ['"]([^'"]+)['"]/);
  if (!match) {
    err(`${label} has no VERSION constant — was the source refactored?`);
    return;
  }

  checkVersion(`${label} VERSION`, match[1], expected);
}

function walkMjsFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkMjsFiles(path));
    else if (entry.isFile() && extname(entry.name) === '.mjs') files.push(path);
  }
  return files;
}

const pkg = readJson('package.json', pkgPath);
const expected = pkg.version;
console.log('agent-kernel version check\n');
console.log(`  package.json: ${expected}`);

checkVersion('package.json version', expected, expected);
readCliVersion('src/cli.mjs', srcPath, expected);
readCliVersion('dist/cli.mjs', distPath, expected);

if (!existsSync(binPath)) {
  console.error(`bin directory not found at ${binPath}`);
  process.exit(2);
}

let versionedBinaries = 0;
for (const path of walkMjsFiles(binPath)) {
  const text = readFileSync(path, 'utf8');
  const match = text.match(/const VERSION = ['"]([^'"]+)['"]/);
  if (!match) continue;
  versionedBinaries += 1;
  checkVersion(`${relative(root, path)} VERSION`, match[1], expected);
}

if (versionedBinaries === 0) {
  err('no versioned helper binaries found under bin/');
}

const plugin = readJson('.claude-plugin/plugin.json', pluginPath);
checkVersion('.claude-plugin/plugin.json version', plugin.version, expected);

const marketplace = readJson('.claude-plugin/marketplace.json', marketplacePath);
checkVersion('.claude-plugin/marketplace.json version', marketplace.version, expected);

if (!Array.isArray(marketplace.plugins) || marketplace.plugins.length === 0) {
  err('.claude-plugin/marketplace.json has no plugin entries');
} else {
  for (const [index, entry] of marketplace.plugins.entries()) {
    const name = typeof entry?.name === 'string' ? entry.name : `plugins[${index}]`;
    checkVersion(`marketplace plugin ${name} version`, entry?.version, expected);
  }
}

if (failed) {
  console.log('\n❌ version drift detected — update every reported surface before release');
  process.exit(1);
}

console.log(`\n✅ versions agree across ${versionedBinaries + 5} checked surfaces`);
