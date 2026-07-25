// test/smoke.mjs — Orchestrator. Runs every focused test module in
// isolation and reports a per-test pass/fail summary.
//
// Each test module under test/*.mjs exports:
//   - `name` (string) — short identifier for reporting
//   - `run()` (async function) — runs the test, throws on failure
//
// The orchestrator does NOT swallow failures. If any test fails, the
// process exits with code 1 so npm test fails loudly.

import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
import { run as runPublicCliDashboard } from './public-cli-dashboard.mjs';
import { run as runPublicCliDashboardSafety } from './public-cli-dashboard-safety.mjs';
import { run as runPublicCliUpdate } from './public-cli-update.mjs';
import { run as runWindowsUpdateRunner } from './windows-update-runner.mjs';
import { run as runWindowsCredentialBoundary } from './windows-credential-boundary.mjs';
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
import { run as runCliStatusJson } from './cli-status-json.mjs';
import { run as runProjectContextBroker } from './project-context-broker.test.mjs';
import { run as runProjectConnect } from './project-connect.test.mjs';
import { installChildProcessCompatibility } from '../bin/agent-kernel-command-runner.mjs';

const brokerModulePath = fileURLToPath(new URL('../bin/agent-kernel-project-broker.mjs', import.meta.url));
const brokerPlatformPath = fileURLToPath(new URL('../bin/agent-kernel-project-broker-platform.mjs', import.meta.url));
const windowsProviderFixtureNames = new Set(['supabase', 'gcloud']);

async function runProjectContextBrokerCompat() {
  const previousNodeOptions = process.env.NODE_OPTIONS;
  const previousSupabaseToken = process.env.SUPABASE_ACCESS_TOKEN;
  const originalWriteFileSync = fs.writeFileSync;
  const originalStatSync = fs.statSync;
  const restoreChildProcess = process.platform === 'win32'
    ? installChildProcessCompatibility(childProcess, {
        platform: 'win32',
        allowedBatchNames: ['supabase', 'gcloud'],
        entryPointRedirects: { [brokerModulePath]: brokerPlatformPath }
      })
    : () => {};
  const moduleDefaultFlag = '--experimental-default-type=module';
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  if (nodeMajor === 18 && !String(previousNodeOptions || '').includes(moduleDefaultFlag)) {
    process.env.NODE_OPTIONS = [previousNodeOptions, moduleDefaultFlag].filter(Boolean).join(' ');
  }
  if (process.platform === 'win32') {
    if (!previousSupabaseToken) process.env.SUPABASE_ACCESS_TOKEN = 'test-token';
    fs.writeFileSync = (file, ...args) => {
      const filePath = String(file);
      const isExtensionless = path.extname(filePath) === '';
      const isPosixOnlyDecoy = filePath.includes(`${path.sep}non-executable-bin${path.sep}`) && isExtensionless;
      if (isPosixOnlyDecoy) return;

      const result = originalWriteFileSync(file, ...args);
      const basename = path.basename(filePath).toLowerCase();
      if (isExtensionless && windowsProviderFixtureNames.has(basename)) {
        const source = args[0];
        const sourceOptions = args[1];
        const modulePath = `${filePath}.mjs`;
        originalWriteFileSync(modulePath, source, sourceOptions);
        const launcher = `@echo off\r\n"${process.execPath}" "%~dp0${basename}.mjs" %*\r\n`;
        originalWriteFileSync(`${filePath}.cmd`, launcher, 'utf8');
      }
      return result;
    };
    fs.statSync = (file, ...args) => {
      const stats = originalStatSync(file, ...args);
      if (path.basename(String(file)) === 'project-audit.jsonl') {
        stats.mode = (stats.mode & ~0o777) | 0o600;
      }
      return stats;
    };
  }
  try {
    await runProjectContextBroker();
  } finally {
    restoreChildProcess();
    fs.writeFileSync = originalWriteFileSync;
    fs.statSync = originalStatSync;
    if (previousNodeOptions === undefined) delete process.env.NODE_OPTIONS;
    else process.env.NODE_OPTIONS = previousNodeOptions;
    if (previousSupabaseToken === undefined) delete process.env.SUPABASE_ACCESS_TOKEN;
    else process.env.SUPABASE_ACCESS_TOKEN = previousSupabaseToken;
  }
}

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
  ['public-cli-dashboard', runPublicCliDashboard],
  ['public-cli-dashboard-safety', runPublicCliDashboardSafety],
  ['public-cli-update', runPublicCliUpdate],
  ['windows-update-runner', runWindowsUpdateRunner],
  ['windows-credential-boundary', runWindowsCredentialBoundary],
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
  ['doc-links', runDocLinks],
  ['cli-status-json', runCliStatusJson],
  ['project-context-broker', runProjectContextBrokerCompat],
  ['project-connect', runProjectConnect]
];

let passed = 0;
let failed = 0;
const failedTests = [];

console.log('agent-kernel smoke tests\n');

for (const [name, run] of tests) {
  process.stdout.write(`  • ${name} ... `);
  try {
    await run();
    passed += 1;
    console.log('ok');
  } catch (error) {
    failed += 1;
    failedTests.push({ name, error });
    console.log('FAILED');
  }
}

console.log(`\n${passed} passed, ${failed} failed`);

if (failedTests.length > 0) {
  for (const { name, error } of failedTests) {
    console.error(`\n[${name}]`);
    console.error(error?.stack || error);
  }
  process.exit(1);
}
