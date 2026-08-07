#!/usr/bin/env node
import childProcess from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prependPathEntry } from './agent-kernel-env.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const wrapperPath = path.join(here, 'agent-kernel.mjs');
const searchPath = path.join(here, 'agent-kernel-search.mjs');
const mcpPath = path.join(here, 'agent-kernel-mcp-safe.mjs');
const commitPath = path.join(here, 'agent-kernel-commit.mjs');
const failurePatternsPath = path.join(here, 'agent-kernel-failure-patterns.mjs');
const patternProposalPath = path.join(here, 'agent-kernel-pattern-proposal.mjs');
const identityCommandPath = path.join(here, 'agent-kernel-identity-command.mjs');
const registryPath = path.join(here, 'agent-kernel-registry.mjs');
const brokerPath = path.join(here, 'agent-kernel-project-broker-platform.mjs');
const contextFsPath = path.join(here, 'agent-kernel-contextfs.mjs');
const contextProjectPath = path.join(here, 'agent-kernel-context-projects.mjs');
const contextUsedPath = path.join(here, 'agent-kernel-context-used.mjs');
const contextCommitPath = path.join(here, 'agent-kernel-context-commit.mjs');
const architecturePath = path.join(here, 'agent-kernel-architecture.mjs');
const portabilityPath = path.join(here, 'agent-kernel-portability.mjs');
const dashboardPath = path.join(here, 'agent-kernel-dashboard.mjs');
const envVaultPath = path.join(here, 'agent-kernel-env-vault.mjs');
const updatePath = path.join(here, 'agent-kernel-update.mjs');
const updateRunnerPath = path.join(here, 'agent-kernel-update-runner.mjs');
const routedUpdatePath = process.platform === 'win32' ? updateRunnerPath : updatePath;
const updateGuidancePath = path.join(here, 'agent-kernel-update-guidance.mjs');
const CONTEXT_URI_SECRET_PATTERNS = [
  /OPENAI_API_KEY\s*=\s*["']?[^\s"']+/iu,
  /ANTHROPIC_API_KEY\s*=\s*["']?[^\s"']+/iu,
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*["']?[^\s"']+/iu,
  /AIza[0-9A-Za-z\-_]{35}/u,
  /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/u,
  /ghp_[A-Za-z0-9]{20,}/u,
  /github_pat_[A-Za-z0-9_]{20,}/u,
  /xox[abposr]-[A-Za-z0-9-]{10,}/u
];
const args = process.argv.slice(2);
const command = args[0];
const jsonRequested = args.some((arg) => arg === '--json' || arg.startsWith('--json='));
const commitLinkHook = command === 'git-hook' && args[1] === 'install' && args.includes('--commit-link');
const failurePatterns = command === 'failure' && args[1] === 'patterns';
const patternProposal = command === 'failure' && args[1] === 'propose-pattern';
const portabilityCommand = ['retention', 'export', 'import', 'view', 'report'].includes(command) ||
  (command === 'session' && args[1] === 'compact');
const searchIdentityOrProject = command === 'search' && args.some((arg) =>
  arg === '--agent' || arg.startsWith('--agent=') ||
  arg === '--project' || arg.startsWith('--project=') ||
  arg === '--project-id' || arg.startsWith('--project-id=') ||
  arg === '--projectId' || arg.startsWith('--projectId=')
);
const identityAware = command === 'propose' || command === 'session' || searchIdentityOrProject;
const contextUsedCommand = command === 'context' && args[1] === 'used';
const contextCommitCommand = command === 'context' && args[1] === 'commit';
const contextFsCommand = command === 'context' && ['tree', 'read', 'find'].includes(args[1]);
const contextProjectCommand = contextFsCommand && (
  args.some((arg) => arg.startsWith('ak://projects/')) ||
  args.some((arg) => arg === '--project' || arg.startsWith('--project='))
);
const brokerCommand = [
  'projects',
  'auth',
  'provider',
  'gates',
  'approvals',
  'audit',
  'connect',
  'disconnect'
].includes(command) ||
  (command === 'project' && ['init', 'register', 'inspect', 'verify', 'connect', 'disconnect', 'status', 'doctor', 'reconnect'].includes(args[1])) ||
  (command === 'context' && ['enter', 'current', 'verify', 'doctor', 'switch'].includes(args[1]));
const registryCommand = command === 'agent' || (command === 'project' && !brokerCommand);

function kernelHome() {
  return process.env.AGENT_KERNEL_HOME || path.join(os.homedir(), '.agent-kernel');
}

function hasRecognizedContextUriSecret(value) {
  const text = String(value || '');
  return CONTEXT_URI_SECRET_PATTERNS.some((pattern) => pattern.test(text));
}

function rejectSecretBearingContextUriArgs() {
  if (!(contextFsCommand || contextUsedCommand)) return;
  for (const arg of args) {
    const raw = String(arg || '');
    const marker = raw.indexOf('ak://');
    if (marker < 0) continue;
    let decoded = raw.slice(marker);
    try { decoded = decodeURIComponent(decoded); } catch {}
    if (!hasRecognizedContextUriSecret(decoded)) continue;
    process.stderr.write('Invalid ContextFS URI: secret-bearing values are not allowed\n');
    process.exit(1);
  }
}

function linkProjectArg() {
  const linkArgs = args.slice(1);
  let positionalOnly = false;
  for (const arg of linkArgs) {
    if (positionalOnly) return arg;
    if (arg === '--') {
      positionalOnly = true;
      continue;
    }
    if (['--dry-run', '--force', '--no-backup', '--help', '-h'].includes(arg)) continue;
    if (!arg.startsWith('-')) return arg;
  }
  return '.';
}

function updateStatePaths() {
  const root = kernelHome();
  return {
    config: path.join(root, 'config.json'),
    cache: path.join(root, 'runtime', 'update-status.json')
  };
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function shouldRefreshUpdateCheck() {
  if (!['doctor', 'start', 'compile', 'sync', 'status'].includes(command)) return false;
  if (jsonRequested || process.env.AGENT_KERNEL_DISABLE_AUTO_UPDATE_CHECK === '1') return false;
  const state = updateStatePaths();
  const config = readJson(state.config);
  if (config?.updates?.mode !== 'agent-approved') return false;
  const hours = Number(config.updates.checkIntervalHours || 24);
  const intervalMs = Number.isFinite(hours) && hours > 0 ? hours * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const cache = readJson(state.cache);
  const checkedAt = Date.parse(cache?.checkedAt || '');
  if (!Number.isFinite(checkedAt)) return true;
  return Date.now() - checkedAt >= intervalMs;
}

function refreshUpdateCheckIfDue() {
  if (!shouldRefreshUpdateCheck()) return;
  childProcess.spawnSync(process.execPath, [routedUpdatePath, 'check', '--json'], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'ignore',
    timeout: 20000
  });
}

function cachedUpdateNotice() {
  if (command === 'update' || jsonRequested) return '';
  const cache = readJson(updateStatePaths().cache);
  if (cache?.updateAvailable !== true || !cache.currentVersion || !cache.targetVersion) return '';
  return `Agent Kernel update available: ${cache.currentVersion} -> ${cache.targetVersion}. Run: agent-kernel update status\n`;
}

function refreshUpdateGuidance() {
  if (!['update', 'init', 'compile', 'sync', 'link'].includes(command)) return;
  const guidanceArgs = [updateGuidancePath];
  if (command === 'link') guidanceArgs.push('--project', linkProjectArg());
  childProcess.spawnSync(process.execPath, guidanceArgs, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'ignore'
  });
}

rejectSecretBearingContextUriArgs();
refreshUpdateCheckIfDue();
const notice = cachedUpdateNotice();
if (notice) process.stderr.write(notice);

const target = command === 'dashboard'
  ? dashboardPath
  : command === 'env'
    ? envVaultPath
    : command === 'update'
      ? routedUpdatePath
      : command === 'architecture'
        ? architecturePath
        : contextUsedCommand
          ? contextUsedPath
          : contextCommitCommand
            ? contextCommitPath
            : contextProjectCommand
              ? contextProjectPath
              : contextFsCommand
                ? contextFsPath
                : brokerCommand
                  ? brokerPath
                  : command === 'reindex' || (command === 'search' && !identityAware)
                    ? searchPath
                    : command === 'mcp'
                      ? mcpPath
                      : portabilityCommand
                        ? portabilityPath
                        : command === 'commit' || commitLinkHook
                          ? commitPath
                          : failurePatterns
                            ? failurePatternsPath
                            : patternProposal
                              ? patternProposalPath
                              : registryCommand
                                ? registryPath
                                : identityAware
                                  ? identityCommandPath
                                  : wrapperPath;

const shimsDir = path.join(kernelHome(), 'runtime', 'shims');
const customEnv = { ...process.env };
if (fs.existsSync(shimsDir)) {
  customEnv.PATH = prependPathEntry(shimsDir, process.env.PATH || '');
}

const routedTopLevel = ['architecture', 'update', 'dashboard', 'env'];
const targetArgs = contextUsedCommand || contextCommitCommand
  ? args.slice(2)
  : contextFsCommand
    ? args.slice(1)
    : routedTopLevel.includes(command)
      ? args.slice(1)
      : args;
const result = childProcess.spawnSync(process.execPath, [target, ...targetArgs], {
  cwd: process.cwd(),
  env: customEnv,
  stdio: 'inherit'
});
if (result.error) {
  process.stderr.write(`${result.error.message}\n`);
  process.exit(1);
}
if (result.status === 0) refreshUpdateGuidance();
process.exit(result.status ?? 1);
