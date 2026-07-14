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
import { run as runCoreLinkClaude } from './core-link-claude.mjs';
import { run as runPublicCliSafeLink } from './public-cli-safe-link.mjs';
import { run as runPublicCliSafeGitHook } from './public-cli-safe-git-hook.mjs';
import { run as runPublicCliDaemon } from './public-cli-daemon.mjs';
import { run as runPublicCliRuntimeDoctor } from './public-cli-runtime-doctor.mjs';
import { run as runPublicCliSession } from './public-cli-session.mjs';
import { run as runPublicCliSessionTimeline } from './public-cli-session-timeline.mjs';
import { run as runPublicCliCommitLinks } from './public-cli-commit-links.mjs';
import { run as runPublicCliObservation } from './public-cli-observation.mjs';
import { run as runPublicCliContext } from './public-cli-context.mjs';
import { run as runPublicCliArchitecture } from './public-cli-architecture.mjs';
import { run as runPublicCliPortability } from './public-cli-portability.mjs';
import { run as runFileContext } from './file-context.mjs';
import { run as runFileReferences } from './file-references.mjs';
import { run as runStructuredSearch } from './structured-search.mjs';
import { run as runClaudeContextHook } from './claude-context-hook.mjs';
import { run as runWrapperRouting } from './wrapper-routing.mjs';
import { run as runAgentPropose } from './agent-propose.mjs';
import { run as runFailureLessons } from './failure-lessons.mjs';
import { run as runPublicCliFailurePatterns } from './public-cli-failure-patterns.mjs';
import { run as runPublicCliPatternProposal } from './public-cli-pattern-proposal.mjs';
import { run as runPublicCliAgentIdentity } from './public-cli-agent-identity.mjs';
import { run as runPublicCliRegistries } from './public-cli-registries.mjs';
import { run as runModeConfig } from './mode-config.mjs';
import { run as runAgentWriteModes } from './agent-write-modes.mjs';
import { run as runArchitectureGuardian } from './architecture-guardian.mjs';
import { run as runPackageFiles } from './package-files.mjs';
import { run as runDocLinks } from './doc-links.mjs';

const tests = [
  ['version', runVersion],
  ['init', runInit],
  ['memory', runMemory],
  ['episode', runEpisode],
  ['guard', runGuard],
  ['mcp', runMcp],
  ['safe-link', runSafeLink],
  ['safe-git-hook', runSafeGitHook],
  ['core-link-claude', runCoreLinkClaude],
  ['public-cli-safe-link', runPublicCliSafeLink],
  ['public-cli-safe-git-hook', runPublicCliSafeGitHook],
  ['public-cli-daemon', runPublicCliDaemon],
  ['public-cli-runtime-doctor', runPublicCliRuntimeDoctor],
  ['public-cli-session', runPublicCliSession],
  ['public-cli-session-timeline', runPublicCliSessionTimeline],
  ['public-cli-commit-links', runPublicCliCommitLinks],
  ['public-cli-observation', runPublicCliObservation],
  ['public-cli-context', runPublicCliContext],
  ['public-cli-architecture', runPublicCliArchitecture],
  ['public-cli-portability', runPublicCliPortability],
  ['file-context', runFileContext],
  ['file-references', runFileReferences],
  ['structured-search', runStructuredSearch],
  ['claude-context-hook', runClaudeContextHook],
  ['wrapper-routing', runWrapperRouting],
  ['agent-propose', runAgentPropose],
  ['failure-lessons', runFailureLessons],
  ['public-cli-failure-patterns', runPublicCliFailurePatterns],
  ['public-cli-pattern-proposal', runPublicCliPatternProposal],
  ['public-cli-agent-identity', runPublicCliAgentIdentity],
  ['public-cli-registries', runPublicCliRegistries],
  ['mode-config', runModeConfig],
  ['agent-write-modes', runAgentWriteModes],
  ['architecture-guardian', runArchitectureGuardian],
  ['package-files', runPackageFiles],
  ['doc-links', runDocLinks]
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
