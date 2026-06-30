#!/usr/bin/env node
// scripts/build.mjs — Build the agent-kernel CLI.
//
// Step 1: read package.json and inject the version string into both
//         src/cli.mjs and dist/cli.mjs so they stay in lock-step with
//         the published npm package version.
// Step 2: write the updated src/cli.mjs (if it changed) and copy it
//         to dist/cli.mjs.
// Step 3: ensure dist/cli.mjs is executable.
//
// After this script runs, `dist/cli.mjs` is byte-identical to
// `src/cli.mjs`, both with VERSION = package.json#version.

import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const srcPath = join(root, 'src', 'cli.mjs');
const distPath = join(root, 'dist', 'cli.mjs');
const VERSION_REGEX = /const VERSION = ['"]([^'"]+)['"]/;

// Ensure dist/ exists. copyFileSync would fail otherwise.
mkdirSync(dirname(distPath), { recursive: true });

// Step 1: read package.json and the source file.
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
let srcText = readFileSync(srcPath, 'utf8');

const before = srcText.match(VERSION_REGEX);
if (!before) {
  console.error(`✗ src/cli.mjs has no const VERSION = '...' — was the source refactored?`);
  process.exit(1);
}

// Step 2: rewrite the VERSION constant if it drifted.
if (before[1] !== pkg.version) {
  console.log(`  bumping VERSION: ${before[1]} → ${pkg.version}`);
  srcText = srcText.replace(VERSION_REGEX, `const VERSION = '${pkg.version}'`);
  writeFileSync(srcPath, srcText);
}

// Step 3: copy to dist and ensure it is executable.
copyFileSync(srcPath, distPath);
const currentMode = statSync(distPath).mode;
if (!(currentMode & 0o111)) {
  chmodSync(distPath, 0o755);
}

console.log(`Built dist/cli.mjs (v${pkg.version})`);