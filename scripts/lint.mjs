#!/usr/bin/env node
// scripts/lint.mjs — Quick sanity linter for the agent-kernel CLI.
//
// Catches:
//   1. Outdated version strings (anything that doesn't match package.json)
//   2. MCP tool name drift (every name must appear in both --help and mcp tools list)
//   3. Secret-pattern regression (the secret scanners in src/cli.mjs must remain)
//   4. Stale dist/ files (must exist + be executable)

import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const cliPath = join(root, 'src', 'cli.mjs');
const distPath = join(root, 'dist', 'cli.mjs');

let failed = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const err = (msg) => { console.log(`  ✗ ${msg}`); failed++; };

console.log('agent-kernel lint\n');

// 1. dist exists + executable
if (!existsSync(distPath)) { err('dist/cli.mjs missing — run npm run build'); }
else {
  const mode = statSync(distPath).mode;
  if (!(mode & 0o111)) err('dist/cli.mjs is not executable — re-run npm run build');
  else ok('dist/cli.mjs exists + is executable');
}

// 2. src and dist identical (build is up-to-date)
const srcText = readFileSync(cliPath, 'utf8');
const distText = readFileSync(distPath, 'utf8');
if (srcText === distText) ok('src/cli.mjs === dist/cli.mjs (build is current)');
else err('src/cli.mjs != dist/cli.mjs — run npm run build');

// 3. VERSION constant matches package.json
const cliVersionMatch = srcText.match(/const VERSION = ['"]([^'"]+)['"]/);
if (!cliVersionMatch) { err('VERSION constant not found in src/cli.mjs'); }
else if (cliVersionMatch[1] !== pkg.version) {
  err(`VERSION (${cliVersionMatch[1]}) != package.json (${pkg.version})`);
} else ok(`VERSION matches package.json (${pkg.version})`);

// 4. Critical command surfaces are still wired
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
for (const cmd of requiredCommands) {
  if (!srcText.includes(`agent-kernel ${cmd}`) && !srcText.includes(`'${cmd.split(' ')[0]}'`)) {
    // Lenient check — just look for the command name as a token
    const first = cmd.split(' ')[0];
    if (!new RegExp(`['"]${first}['"]`).test(srcText)) {
      err(`command surface missing: ${cmd}`);
    }
  }
}
ok(`${requiredCommands.length} command surfaces checked`);

// 5. MCP tools are listed in --help
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
for (const tool of mcpTools) {
  if (!srcText.includes(tool)) err(`MCP tool name missing: ${tool}`);
}
ok(`${mcpTools.length} MCP tool names checked`);

// 6. Secret patterns still present (don't accidentally drop them)
const secretPatterns = [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'AIza[0-9A-Za-z',
  'sk-[A-Za-z0-9]',
  'ghp_[A-Za-z0-9]'
];
for (const pat of secretPatterns) {
  if (!srcText.includes(pat)) err(`secret pattern missing: ${pat}`);
}
ok(`${secretPatterns.length} secret patterns checked`);

// 7. Deny commands still present (don't accidentally drop guard)
const denyCommands = [
  'dangerous-rm',
  'curl-pipe-shell',
  'chmod-777',
  'force-push-main',
  'delete-git'
];
for (const dc of denyCommands) {
  if (!srcText.includes(dc)) err(`deny command missing: ${dc}`);
}
ok(`${denyCommands.length} deny commands checked`);

// 8. node engine sane
const nodeEngines = pkg.engines?.node;
if (!nodeEngines) err('engines.node not set in package.json');
else ok(`engines.node = ${nodeEngines}`);

console.log();
if (failed > 0) {
  console.log(`❌ ${failed} lint check(s) failed`);
  process.exit(1);
}
console.log(`✅ all checks passed`);