#!/usr/bin/env node
// scripts/check-version.mjs — Single-source-of-truth version check.
//
// Enforces that the CLI's hardcoded VERSION constant matches package.json.
// Run this in CI and locally before tagging a release.
//
// Exit codes:
//   0 — versions agree
//   1 — version drift detected (with details)
//   2 — file missing or unreadable

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pkgPath = join(root, 'package.json');
const srcPath = join(root, 'src', 'cli.mjs');
const distPath = join(root, 'dist', 'cli.mjs');

let failed = false;
const ok = (m) => console.log(`  ✓ ${m}`);
const err = (m) => { console.log(`  ✗ ${m}`); failed = true; };

if (!existsSync(pkgPath)) {
  console.error(`package.json not found at ${pkgPath}`);
  process.exit(2);
}
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
console.log(`agent-kernel version check\n`);
console.log(`  package.json: ${pkg.version}`);

function readCliVersion(label, path) {
  if (!existsSync(path)) {
    err(`${label} missing at ${path} — run npm run build`);
    return null;
  }
  const text = readFileSync(path, 'utf8');
  const match = text.match(/const VERSION = ['"]([^'"]+)['"]/);
  if (!match) {
    err(`${label} has no VERSION constant — was the source refactored?`);
    return null;
  }
  const v = match[1];
  if (v === pkg.version) ok(`${label} VERSION = ${v}`);
  else err(`${label} VERSION = ${v} (expected ${pkg.version})`);
  return v;
}

readCliVersion('src/cli.mjs', srcPath);
readCliVersion('dist/cli.mjs', distPath);

if (failed) {
  console.log('\n❌ version drift detected — run `npm run build` to sync dist/cli.mjs');
  process.exit(1);
}
console.log('\n✅ versions agree');