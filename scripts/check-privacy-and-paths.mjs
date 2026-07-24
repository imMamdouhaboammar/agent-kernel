#!/usr/bin/env node
// scripts/check-privacy-and-paths.mjs — Privacy, path dynamicness, and secret leak verifier for agent-kernel.
//
// Ensures:
//   1. No user home paths or local machine footprint leaks (/Users/<user>, /home/<user>, C:\Users\<user>)
//   2. All path operations in code are dynamic (os.homedir(), process.cwd(), relative resolution)
//   3. Zero secret leaks (API keys, private keys, access tokens, cloud service role keys)
//
// Run via `npm run check-privacy` or `npm run lint`. Automatically enforced before publishing.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const currentUser = homedir().split(/[/\\]/).pop() || '';

let failed = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const err = (msg, details = '') => {
  console.log(`  ✗ ${msg}${details ? ` (${details})` : ''}`);
  failed++;
};

console.log('agent-kernel privacy & path dynamicness check\n');

function walkFiles(dir, predicate, results = []) {
  let entries = [];
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return results; }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    const rel = relative(root, full).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'coverage', 'dist-backup'].includes(entry.name)) continue;
      if (rel.startsWith('.agent-kernel-backups') || rel.startsWith('agent-kernel-export') || rel.startsWith('local_cache')) continue;
      walkFiles(full, predicate, results);
    } else if (predicate(rel)) {
      results.push({ full, rel });
    }
  }
  return results;
}

// Files to scan for privacy and dynamic paths
const scannableExtensions = /\.(mjs|js|json|yml|yaml|toml|md|sh)$/;
const files = walkFiles(root, (rel) => scannableExtensions.test(rel));

// Allowlist for test/verifier scripts that mock or reference home directories safely
const allowedPathFixtures = new Set([
  'scripts/check-privacy-and-paths.mjs'
]);

// 1. User Home Path & Personal Footprint Check
let homePathLeaks = 0;
const userHomeRegex = new RegExp(`/(Users|home)/${currentUser.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');

for (const { full, rel } of files) {
  if (allowedPathFixtures.has(rel)) continue;
  const text = readFileSync(full, 'utf8');

  // Check specific current user home footprint
  if (currentUser && currentUser.length > 2 && userHomeRegex.test(text)) {
    err(`hardcoded user home path in ${rel}`);
    homePathLeaks++;
  }
}
if (homePathLeaks === 0) ok(`no personal user home footprint leaks found across ${files.length} scanned files`);

// 2. Secret Keys & Tokens Leak Check
const secretPatterns = [
  { name: 'OpenAI API Key', regex: /sk-[A-Za-z0-9]{20,}/g },
  { name: 'Anthropic API Key', regex: /sk-ant-[A-Za-z0-9_-]{20,}/g },
  { name: 'GitHub Token', regex: /gh[pousr]_[A-Za-z0-9]{20,}/g },
  { name: 'Google API Key', regex: /AIza[0-9A-Za-z_-]{35}/g },
  { name: 'Slack Token', regex: /xox[abposr]-[A-Za-z0-9-]{10,}/g },
  { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/g },
  { name: 'Private Key', regex: /-----BEGIN (RSA|EC|OPENSSH|DSA|PRIVATE) KEY-----/g }
];

const secretAllowList = new Set([
  'scripts/lint.mjs',
  'scripts/check-privacy-and-paths.mjs',
  'test/episode.mjs',
  'test/guard.mjs',
  'test/mcp.mjs',
  'examples/sample-episode.json'
]);

let secretLeaks = 0;
for (const { full, rel } of files) {
  if (secretAllowList.has(rel)) continue;
  const text = readFileSync(full, 'utf8');
  for (const { name, regex } of secretPatterns) {
    regex.lastIndex = 0;
    if (regex.test(text)) {
      err(`potential ${name} leaked in ${rel}`);
      secretLeaks++;
    }
  }
}
if (secretLeaks === 0) ok(`zero secrets or private tokens detected`);

// 3. Dynamic Path Enforcement Check in Source & Published Output
const codeFiles = files.filter(({ rel }) => rel.startsWith('src/') || rel.startsWith('bin/') || rel === 'dist/cli.mjs');
let staticPathViolations = 0;
const staticPathRegex = /["'](\/Users\/|\/home\/|[A-Z]:\\Users\\)/;

for (const { full, rel } of codeFiles) {
  const text = readFileSync(full, 'utf8');
  if (staticPathRegex.test(text)) {
    err(`hardcoded absolute path in runtime code: ${rel}`);
    staticPathViolations++;
  }
}
if (staticPathViolations === 0) ok(`all ${codeFiles.length} runtime & binary code files use dynamic path resolution`);

console.log();
if (failed > 0) {
  console.log(`❌ ${failed} privacy/path check(s) failed`);
  process.exit(1);
}
console.log('✅ all privacy, secret, and dynamic path checks passed');
