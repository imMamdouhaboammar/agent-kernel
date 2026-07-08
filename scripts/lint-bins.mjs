#!/usr/bin/env node
// scripts/lint-bins.mjs — package.json#bin surface checks.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

let failed = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const err = (msg) => { console.log(`  ✗ ${msg}`); failed++; };

console.log('agent-kernel bin lint\n');

if (!pkg.bin || typeof pkg.bin !== 'object') {
  err('package.json has no bin map');
} else {
  for (const [name, relativePath] of Object.entries(pkg.bin)) {
    const full = join(root, relativePath);
    if (!existsSync(full)) {
      err(`bin target missing for ${name}: ${relativePath}`);
      continue;
    }
    const text = readFileSync(full, 'utf8');
    if (!text.startsWith('#!/usr/bin/env node')) {
      err(`bin target has no node shebang for ${name}: ${relativePath}`);
      continue;
    }
    ok(`${name} -> ${relativePath}`);
  }
}

console.log();
if (failed > 0) {
  console.log(`❌ ${failed} bin lint check(s) failed`);
  process.exit(1);
}
console.log('✅ all bin checks passed');
