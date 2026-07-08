// test/smoke.mjs — Orchestrator. Runs every focused test module in
// isolation and reports a per-test pass/fail summary.
//
// Each test module under test/*.mjs exports:
//   - `name` (string) — short identifier for reporting
//   - `run()` (async function) — runs the test, throws on failure
//
// The orchestrator does NOT swallow failures. If any test fails, the
// process exits with code 1 so npm test fails loudly.

import { run as runVersion } from './version.mjs';
import { run as runInit } from './init.mjs';
import { run as runMemory } from './memory.mjs';
import { run as runEpisode } from './episode.mjs';
import { run as runGuard } from './guard.mjs';
import { run as runMcp } from './mcp.mjs';
import { run as runSafeLink } from './safe-link.mjs';
import { run as runSafeGitHook } from './safe-git-hook.mjs';
import { run as runPublicCliSafeLink } from './public-cli-safe-link.mjs';
import { run as runPublicCliSafeGitHook } from './public-cli-safe-git-hook.mjs';
import { run as runWrapperRouting } from './wrapper-routing.mjs';
import { run as runAgentPropose } from './agent-propose.mjs';
import { run as runModeConfig } from './mode-config.mjs';
import { run as runAgentWriteModes } from './agent-write-modes.mjs';
import { run as runPackageFiles } from './package-files.mjs';

const tests = [
  ['version', runVersion],
  ['init', runInit],
  ['memory', runMemory],
  ['episode', runEpisode],
  ['guard', runGuard],
  ['mcp', runMcp],
  ['safe-link', runSafeLink],
  ['safe-git-hook', runSafeGitHook],
  ['public-cli-safe-link', runPublicCliSafeLink],
  ['public-cli-safe-git-hook', runPublicCliSafeGitHook],
  ['wrapper-routing', runWrapperRouting],
  ['agent-propose', runAgentPropose],
  ['mode-config', runModeConfig],
  ['agent-write-modes', runAgentWriteModes],
  ['package-files', runPackageFiles]
];

let passed = 0;
let failed = 0;
const failedTests = [];

console.log('agent-kernel smoke tests\n');

for (const [name, run] of tests) {
  process.stdout.write(`  • ${name} ... `);
  try {
    await run();
    process.stdout.write('ok\n');
    passed++;
  } catch (err) {
    process.stdout.write('FAIL\n');
    console.log(`    ${err.message.split('\n').join('\n    ')}`);
    failed++;
    failedTests.push(name);
  }
}

console.log();
console.log(`  ${passed}/${tests.length} passed`);

if (failed > 0) {
  console.log(`\n  failed tests: ${failedTests.join(', ')}`);
  console.log(`\nsmoke: FAIL`);
  process.exit(1);
}

console.log(`\nsmoke: OK`);
