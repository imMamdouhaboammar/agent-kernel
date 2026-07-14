#!/usr/bin/env node
import childProcess from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const wrapperPath = path.join(here, 'agent-kernel.mjs');
const searchPath = path.join(here, 'agent-kernel-search.mjs');
const mcpPath = path.join(here, 'agent-kernel-mcp-safe.mjs');
const commitPath = path.join(here, 'agent-kernel-commit.mjs');
const failurePatternsPath = path.join(here, 'agent-kernel-failure-patterns.mjs');
const patternProposalPath = path.join(here, 'agent-kernel-pattern-proposal.mjs');
const identityCommandPath = path.join(here, 'agent-kernel-identity-command.mjs');
const registryPath = path.join(here, 'agent-kernel-registry.mjs');
const architecturePath = path.join(here, 'agent-kernel-architecture.mjs');
const portabilityPath = path.join(here, 'agent-kernel-portability.mjs');
const updatePath = path.join(here, 'agent-kernel-update.mjs');
const updateGuidancePath = path.join(here, 'agent-kernel-update-guidance.mjs');
const args = process.argv.slice(2);
const command = args[0];
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
const registryCommand = command === 'agent' || command === 'project';

function cachedUpdateNotice() {
  if (command === 'update' || args.includes('--json')) return '';
  const root = process.env.AGENT_KERNEL_HOME || path.join(os.homedir(), '.agent-kernel');
  const cachePath = path.join(root, 'runtime', 'update-status.json');
  try {
    const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    if (cache?.updateAvailable !== true || !cache.currentVersion || !cache.targetVersion) return '';
    return `Agent Kernel update available: ${cache.currentVersion} -> ${cache.targetVersion}. Run: agent-kernel update status\n`;
  } catch {
    return '';
  }
}

function refreshUpdateGuidance() {
  if (!['update', 'init', 'compile', 'sync', 'link'].includes(command)) return;
  const guidanceArgs = [updateGuidancePath];
  if (command === 'link') guidanceArgs.push('--project', args[1] || '.');
  childProcess.spawnSync(process.execPath, guidanceArgs, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'ignore'
  });
}

const notice = cachedUpdateNotice();
if (notice) process.stderr.write(notice);

const target = command === 'update'
  ? updatePath
  : command === 'architecture'
    ? architecturePath
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
const targetArgs = command === 'architecture' || command === 'update' ? args.slice(1) : args;
const result = childProcess.spawnSync(process.execPath, [target, ...targetArgs], {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit'
});
if (result.error) {
  process.stderr.write(`${result.error.message}\n`);
  process.exit(1);
}
if (result.status === 0) refreshUpdateGuidance();
process.exit(result.status ?? 1);
