#!/usr/bin/env node
// scripts/lint-modes.mjs — mode system documentation and binary surface checks.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const requiredFiles = [
  'bin/agent-kernel-mode.mjs',
  'bin/agent-kernel-agent-write.mjs',
  'docs/modes/MODE_OVERVIEW.md',
  'docs/modes/APPROVAL_MODE.md',
  'docs/modes/TRUSTED_MODE.md',
  'docs/modes/BYPASS_MODE.md'
];

let failed = 0;
const ok = (message) => console.log(`  ✓ ${message}`);
const err = (message) => { console.log(`  ✗ ${message}`); failed++; };

console.log('agent-kernel mode lint\n');

for (const file of requiredFiles) {
  const full = join(root, file);
  if (!existsSync(full)) err(`missing mode file: ${file}`);
  else ok(`found ${file}`);
}

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
for (const bin of ['agent-kernel-mode', 'agent-kernel-agent-write']) {
  if (!pkg.bin?.[bin]) err(`package.json#bin missing ${bin}`);
  else ok(`bin exposed: ${bin}`);
}

console.log();
if (failed > 0) {
  console.log(`❌ ${failed} mode lint check(s) failed`);
  process.exit(1);
}
console.log('✅ all mode checks passed');
