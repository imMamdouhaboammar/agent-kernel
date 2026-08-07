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
import os from 'node:os';
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
import { run as runContextFsSecurity } from './contextfs-security.mjs';
import { run as runPublicCliArchitecture } from './public-cli-architecture.mjs';
import { run as runPublicCliPortability } from './public-cli-portability.mjs';
import { run as runPublicCliDashboard } from './public-cli-dashboard.mjs';
import { run as runPublicCliDashboardSafety } from './public-cli-dashboard-safety.mjs';
import { run as runPublicCliUpdate } from './public-cli-update.mjs';
import { run as runWindowsUpdateRunner } from './windows-update-runner.mjs';
import { run as runWindowsCredentialBoundary } from './windows-credential-boundary.mjs';
import { run as runWindowsEmptyLauncherAllowlist } from './windows-empty-launcher-allowlist.mjs';
import { run as runProjectBrokerSymlink } from './project-broker-symlink.mjs';
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
import { run as runSmokeRegistration } from './smoke-registration.mjs';
import { run as runPolicy } from './policy.mjs';
import { run as runEnvVault } from './env-vault.mjs';
import { run as runEnvVaultFreshClone } from './env-vault-fresh-clone.mjs';
import { run as runEnvVaultTransactionCli } from './env-vault-transaction-cli.mjs';
import { run as runSkillsEngine } from './skills-engine.mjs';
import { run as runSelfEvolveEngine } from './self-evolve-engine.mjs';
import { run as runDocLinks } from './doc-links.mjs';
import { run as runCliStatusJson } from './cli-status-json.mjs';
import { run as runProjectContextBroker } from './project-context-broker.test.mjs';
import { run as runProjectConnect } from './project-connect.test.mjs';
import { installChildProcessCompatibility } from '../bin/agent-kernel-command-runner.mjs';
import { assertSmokeRegistration } from './_lib/smoke-registration.mjs';

const brokerModulePath = fileURLToPath(new URL('../bin/agent-kernel-project-broker.mjs', import.meta.url));
const brokerPlatformPath = fileURLToPath(new URL('../bin/agent-kernel-project-broker-platform.mjs', import.meta.url));
const windowsOwnerOnlyStateFiles = new Set([
  'active-session.json',
  'approvals.json',
  'project-audit.jsonl'
]);

function createWindowsProviderFixtureDirectory() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-kernel-windows-providers-'));
  for (const tool of ['supabase', 'gcloud']) {
    const modulePath = path.join(directory, `${tool}.mjs`);
    const moduleSource = `
import fs from 'node:fs';
const args = process.argv.slice(2);
if (process.env.AK_APPROVAL_ARGS_FILE) {
  fs.appendFileSync(process.env.AK_APPROVAL_ARGS_FILE, JSON.stringify({ tool: '${tool}', args }) + String.fromCharCode(10));
} else if (process.env.AK_TEST_ARGS_FILE) {
  fs.writeFileSync(process.env.AK_TEST_ARGS_FILE, JSON.stringify(args));
}
`;
    fs.writeFileSync(modulePath, moduleSource, 'utf8');
    fs.writeFileSync(
      path.join(directory, `${tool}.cmd`),
      `@echo off
"${process.execPath}" "%~dp0${tool}.mjs" %*
`,
      'utf8'
    );
  }
  return directory;
}

async function runProjectContextBrokerCompat() {
  const previousNodeOptions = process.env.NODE_OPTIONS;
  const previousSupabaseToken = process.env.SUPABASE_ACCESS_TOKEN;
  const previousPath = process.env.PATH;
  const originalWriteFileSync = fs.writeFileSync;
  const originalStatSync = fs.statSync;
  const windowsProviderDirectory = process.platform === 'win32'
    ? createWindowsProviderFixtureDirectory()
    : null;
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
    process.env.PATH = `${windowsProviderDirectory}${path.delimiter}${previousPath || ''}`;
    fs.writeFileSync = (file, ...args) => {
      const filePath = String(file);
      const isPosixOnlyDecoy = filePath.includes(`${path.sep}non-executable-bin${path.sep}`) && path.extname(filePath) === '';
      if (isPosixOnlyDecoy) return;
      return originalWriteFileSync(file, ...args);
    };
    fs.statSync = (file, ...args) => {
      const stats = originalStatSync(file, ...args);
      if (windowsOwnerOnlyStateFiles.has(path.basename(String(file)))) {
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
    if (previousPath === undefined) delete process.env.PATH;
    else process.env.PATH = previousPath;
    if (windowsProviderDirectory) fs.rmSync(windowsProviderDirectory, { recursive: true, force: true });
  }
}

const tests = [
  ['version', runVersion, 'version.mjs'],
  ['init', runInit, 'init.mjs'],
  ['memory', runMemory, 'memory.mjs'],
  ['episode', runEpisode, 'episode.mjs'],
  ['guard', runGuard, 'guard.mjs'],
  ['mcp', runMcp, 'mcp.mjs'],
  ['safe-link', runSafeLink, 'safe-link.mjs'],
  ['safe-git-hook', runSafeGitHook, 'safe-git-hook.mjs'],
  ['core-link-claude', runCoreLinkClaude, 'core-link-claude.mjs'],
  ['public-cli-safe-link', runPublicCliSafeLink, 'public-cli-safe-link.mjs'],
  ['public-cli-safe-git-hook', runPublicCliSafeGitHook, 'public-cli-safe-git-hook.mjs'],
  ['public-cli-daemon', runPublicCliDaemon, 'public-cli-daemon.mjs'],
  ['public-cli-runtime-doctor', runPublicCliRuntimeDoctor, 'public-cli-runtime-doctor.mjs'],
  ['public-cli-session', runPublicCliSession, 'public-cli-session.mjs'],
  ['public-cli-session-timeline', runPublicCliSessionTimeline, 'public-cli-session-timeline.mjs'],
  ['public-cli-commit-links', runPublicCliCommitLinks, 'public-cli-commit-links.mjs'],
  ['public-cli-observation', runPublicCliObservation, 'public-cli-observation.mjs'],
  ['public-cli-context', runPublicCliContext, 'public-cli-context.mjs'],
  ['contextfs-security', runContextFsSecurity, 'contextfs-security.mjs'],
  ['public-cli-architecture', runPublicCliArchitecture, 'public-cli-architecture.mjs'],
  ['public-cli-portability', runPublicCliPortability, 'public-cli-portability.mjs'],
  ['public-cli-dashboard', runPublicCliDashboard, 'public-cli-dashboard.mjs'],
  ['public-cli-dashboard-safety', runPublicCliDashboardSafety, 'public-cli-dashboard-safety.mjs'],
  ['public-cli-update', runPublicCliUpdate, 'public-cli-update.mjs'],
  ['windows-update-runner', runWindowsUpdateRunner, 'windows-update-runner.mjs'],
  ['windows-credential-boundary', runWindowsCredentialBoundary, 'windows-credential-boundary.mjs'],
  ['windows-empty-launcher-allowlist', runWindowsEmptyLauncherAllowlist, 'windows-empty-launcher-allowlist.mjs'],
  ['project-broker-symlink', runProjectBrokerSymlink, 'project-broker-symlink.mjs'],
  ['file-context', runFileContext, 'file-context.mjs'],
  ['file-references', runFileReferences, 'file-references.mjs'],
  ['structured-search', runStructuredSearch, 'structured-search.mjs'],
  ['claude-context-hook', runClaudeContextHook, 'claude-context-hook.mjs'],
  ['wrapper-routing', runWrapperRouting, 'wrapper-routing.mjs'],
  ['agent-propose', runAgentPropose, 'agent-propose.mjs'],
  ['failure-lessons', runFailureLessons, 'failure-lessons.mjs'],
  ['public-cli-failure-patterns', runPublicCliFailurePatterns, 'public-cli-failure-patterns.mjs'],
  ['public-cli-pattern-proposal', runPublicCliPatternProposal, 'public-cli-pattern-proposal.mjs'],
  ['public-cli-agent-identity', runPublicCliAgentIdentity, 'public-cli-agent-identity.mjs'],
  ['public-cli-registries', runPublicCliRegistries, 'public-cli-registries.mjs'],
  ['mode-config', runModeConfig, 'mode-config.mjs'],
  ['agent-write-modes', runAgentWriteModes, 'agent-write-modes.mjs'],
  ['architecture-guardian', runArchitectureGuardian, 'architecture-guardian.mjs'],
  ['package-files', runPackageFiles, 'package-files.mjs'],
  ['smoke-registration', runSmokeRegistration, 'smoke-registration.mjs'],
  ['policy', runPolicy, 'policy.mjs'],
  ['env-vault', runEnvVault, 'env-vault.mjs'],
  ['env-vault-fresh-clone', runEnvVaultFreshClone, 'env-vault-fresh-clone.mjs'],
  ['env-vault-transaction-cli', runEnvVaultTransactionCli, 'env-vault-transaction-cli.mjs'],
  ['skills-engine', runSkillsEngine, 'skills-engine.mjs'],
  ['self-evolve-engine', runSelfEvolveEngine, 'self-evolve-engine.mjs'],
  ['doc-links', runDocLinks, 'doc-links.mjs'],
  ['cli-status-json', runCliStatusJson, 'cli-status-json.mjs'],
  ['project-context-broker', runProjectContextBrokerCompat, 'project-context-broker.test.mjs'],
  ['project-connect', runProjectConnect, 'project-connect.test.mjs']
];

const candidateFiles = fs
  .readdirSync('test', { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name);
const registrations = tests.map(([name, , file]) => ({ name, file }));
assertSmokeRegistration({
  candidateFiles,
  registrations,
  ignoredFiles: ['smoke.mjs', 'ci-hardening.mjs'],
  delegatedFiles: ['architecture-guardian-evals.mjs']
});

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