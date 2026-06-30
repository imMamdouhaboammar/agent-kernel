#!/usr/bin/env node
// scripts/lint.mjs — repository consistency checks for agent-kernel.
//
// Catches (in order):
//   1. dist/cli.mjs exists + executable
//   2. src/cli.mjs and dist/cli.mjs are byte-identical
//   3. VERSION constant in src/cli.mjs matches package.json
//   4. CLI command surfaces are wired (init, doctor, memory list, ...)
//   5. MCP tool names use the agent_kernel_ prefix and are listed
//   6. Secret patterns in src/cli.mjs are still present (no accidental drops)
//   7. Deny commands in src/cli.mjs are still present (no accidental drops)
//   8. engines.node is set
//   9. package.json `name` and the README install command agree
//  10. README badge URLs reference the same package name
//  11. CHANGELOG latest release header matches package.json version
//  12. package.json `files` whitelist is intentional (no overlap, no missing docs)
//  13. `develpment/` (legacy typo) has a compatibility pointer to `development/`
//  14. No stale `@mamdouh/agent-kernel` references in active docs
//
// Run via `npm run lint`. CI runs this on every push.

import { existsSync, readFileSync, statSync, readdirSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const srcPath = join(root, 'src', 'cli.mjs');
const distPath = join(root, 'dist', 'cli.mjs');

let failed = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const err = (msg) => { console.log(`  ✗ ${msg}`); failed++; };

console.log('agent-kernel lint\n');

// 1. dist exists + executable
if (!existsSync(distPath)) {
  err('dist/cli.mjs missing — run npm run build');
} else {
  const mode = statSync(distPath).mode;
  if (!(mode & 0o111)) err('dist/cli.mjs is not executable — re-run npm run build');
  else ok('dist/cli.mjs exists + is executable');
}

// 2. src === dist (build is current)
const srcText = existsSync(srcPath) ? readFileSync(srcPath, 'utf8') : '';
const distText = existsSync(distPath) ? readFileSync(distPath, 'utf8') : '';
if (srcText && distText && srcText === distText) ok('src/cli.mjs === dist/cli.mjs (build is current)');
else if (srcText && distText) err('src/cli.mjs != dist/cli.mjs — run npm run build');

// 3. VERSION drift
const cliVersionMatch = srcText.match(/const VERSION = ['"]([^'"]+)['"]/);
if (!cliVersionMatch) {
  err('VERSION constant not found in src/cli.mjs');
} else if (cliVersionMatch[1] !== pkg.version) {
  err(`VERSION (${cliVersionMatch[1]}) != package.json (${pkg.version})`);
} else {
  ok(`VERSION matches package.json (${pkg.version})`);
}

// 4. Command surfaces
const requiredCommands = [
  'init', 'doctor', 'compile', 'sync', 'link',
  'remember', 'propose', 'inbox', 'approve', 'reject', 'publish',
  'validate', 'migrate',
  'memory list', 'memory search', 'memory show',
  'episode add', 'episode sync', 'episode search', 'episode show',
  'episode stats', 'episode reindex',
  'enforce install', 'guard', 'git-hook install',
  'start', 'status'
];
let missingCommands = 0;
for (const cmd of requiredCommands) {
  const first = cmd.split(' ')[0];
  const pattern = new RegExp(`['"]${first}['"]`);
  if (!pattern.test(srcText)) {
    err(`command surface missing: ${cmd}`);
    missingCommands++;
  }
}
if (missingCommands === 0) ok(`${requiredCommands.length} command surfaces checked`);

// 5. MCP tool names
const mcpTools = [
  'agent_kernel_propose_memory',
  'agent_kernel_approve_memory',
  'agent_kernel_search_memory',
  'agent_kernel_list_pending',
  'agent_kernel_search_episodes',
  'agent_kernel_read_episode',
  'agent_kernel_capture_episode',
  'agent_kernel_sync_episodes',
  'agent_kernel_get_constitution',
  'agent_kernel_get_status',
  'agent_kernel_guard_command'
];
let missingTools = 0;
for (const tool of mcpTools) {
  if (!srcText.includes(tool)) {
    err(`MCP tool name missing: ${tool}`);
    missingTools++;
  }
}
if (missingTools === 0) ok(`${mcpTools.length} MCP tool names checked`);

// 6. Secret patterns still present
const secretPatterns = [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'AIza[0-9A-Za-z',
  'sk-[A-Za-z0-9]',
  'ghp_[A-Za-z0-9]'
];
let missingSecrets = 0;
for (const pat of secretPatterns) {
  if (!srcText.includes(pat)) {
    err(`secret pattern missing: ${pat}`);
    missingSecrets++;
  }
}
if (missingSecrets === 0) ok(`${secretPatterns.length} secret patterns checked`);

// 7. Deny commands still present
const denyCommands = [
  'dangerous-rm',
  'curl-pipe-shell',
  'chmod-777',
  'force-push-main',
  'delete-git'
];
let missingDenies = 0;
for (const dc of denyCommands) {
  if (!srcText.includes(dc)) {
    err(`deny command missing: ${dc}`);
    missingDenies++;
  }
}
if (missingDenies === 0) ok(`${denyCommands.length} deny commands checked`);

// 8. engines.node
const nodeEngines = pkg.engines?.node;
if (!nodeEngines) err('engines.node not set in package.json');
else ok(`engines.node = ${nodeEngines}`);

// 9. README install command references package.json name
const readmePath = join(root, 'README.md');
if (existsSync(readmePath)) {
  const readme = readFileSync(readmePath, 'utf8');
  const installRegex = /npm install -g (@[a-z0-9-]+\/[a-z0-9-]+)/i;
  const m = readme.match(installRegex);
  if (!m) {
    err('README.md has no `npm install -g <package>` example');
  } else if (m[1] !== pkg.name) {
    err(`README install command uses ${m[1]} but package.json name is ${pkg.name}`);
  } else {
    ok(`README install command matches package.json name (${pkg.name})`);
  }
}

// 10. README badge URLs reference the package name
if (existsSync(readmePath)) {
  const readme = readFileSync(readmePath, 'utf8');
  const badgeRegex = /img\.shields\.io\/(npm\/(?:v|dw)\/|bundlephobia\/min\/)(@[a-z0-9-]+\/[a-z0-9-]+)/g;
  let mismatched = 0;
  let total = 0;
  let match;
  while ((match = badgeRegex.exec(readme)) !== null) {
    total++;
    if (match[2] !== pkg.name) {
      err(`README badge references ${match[2]} but package.json name is ${pkg.name}`);
      mismatched++;
    }
  }
  if (total === 0) {
    err('README has no npm/v, npm/dw, or bundlephobia/min badges');
  } else if (mismatched === 0) {
    ok(`${total} npm/bundlephobia badges reference ${pkg.name}`);
  }
}

// 11. CHANGELOG latest release header
const changelogPath = join(root, 'CHANGELOG.md');
if (existsSync(changelogPath)) {
  const changelog = readFileSync(changelogPath, 'utf8');
  const headerRegex = /^## \[?(\d+\.\d+\.\d+(?:-[a-z0-9.]+)?)\]?/m;
  const m = changelog.match(headerRegex);
  if (!m) {
    err('CHANGELOG.md has no `## [version]` header');
  } else if (m[1] !== pkg.version) {
    err(`CHANGELOG.md latest header is ${m[1]} but package.json is ${pkg.version}`);
  } else {
    ok(`CHANGELOG latest entry matches package.json (${pkg.version})`);
  }
}

// 12. package.json `files` whitelist — sanity check
if (Array.isArray(pkg.files)) {
  const required = ['dist', 'README.md', 'LICENSE'];
  const missing = required.filter((f) => !pkg.files.includes(f));
  if (missing.length > 0) {
    err(`package.json files whitelist missing required entries: ${missing.join(', ')}`);
  } else {
    ok(`package.json files whitelist has all required entries`);
  }
} else {
  err('package.json has no `files` array');
}

// 13. develpment/ (legacy typo) compatibility pointer
const legacyDir = join(root, 'develpment');
const canonicalDir = join(root, 'development');
if (existsSync(legacyDir) && !existsSync(canonicalDir)) {
  err('develpment/ exists but development/ does not — create the canonical path');
} else if (existsSync(legacyDir) && existsSync(canonicalDir)) {
  // Check that develpment/README.md points to development/
  const legacyReadme = join(legacyDir, 'README.md');
  if (existsSync(legacyReadme)) {
    const text = readFileSync(legacyReadme, 'utf8');
    if (!text.includes('development/')) {
      err('develpment/README.md does not point to development/ as the canonical path');
    } else {
      ok('develpment/ compatibility pointer references development/');
    }
  } else {
    err('develpment/ exists but has no README.md compatibility pointer');
  }
} else if (!existsSync(legacyDir) && !existsSync(canonicalDir)) {
  ok('no develpment/ or development/ folder present (no compatibility check needed)');
}

// 14. No stale `@mamdouh/agent-kernel` references in active docs
// (Active docs = all .md files except CHANGELOG.md and docs/audits/* which
//  are explicitly historical.)
function findMarkdownFiles(dir) {
  let results = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        results = results.concat(findMarkdownFiles(full));
      } else if (entry.name.endsWith('.md') && entry.name !== 'CHANGELOG.md') {
        results.push(full);
      }
    }
  } catch {}
  return results;
}

const staleScope = '@mamdouh/agent-kernel';
let staleCount = 0;
for (const f of findMarkdownFiles(root)) {
  // Exclude historical documents (CHANGELOG, audits dir)
  const rel = f.replace(root + '/', '');
  if (rel === 'CHANGELOG.md' || rel.startsWith('docs/audits/')) continue;
  const text = readFileSync(f, 'utf8');
  if (text.includes(staleScope)) {
    err(`stale npm scope "${staleScope}" in ${rel}`);
    staleCount++;
  }
}
if (staleCount === 0) ok('no stale `@mamdouh/agent-kernel` references in active docs');

console.log();
if (failed > 0) {
  console.log(`❌ ${failed} lint check(s) failed`);
  process.exit(1);
}
console.log(`✅ all checks passed`);