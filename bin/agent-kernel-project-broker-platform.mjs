#!/usr/bin/env node
import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeUpdateCommand } from './agent-kernel-update-runner.mjs';

const originalExecFileSync = childProcess.execFileSync.bind(childProcess);
const originalSpawnSync = childProcess.spawnSync.bind(childProcess);
let compatibilityInstalled = false;

function supabaseEnvironmentGuidance(action) {
  const prefix = action === 'remove'
    ? 'Remove SUPABASE_ACCESS_TOKEN or SUPABASE_TOKEN from the process environment instead.'
    : 'Set SUPABASE_ACCESS_TOKEN or SUPABASE_TOKEN for provider execution instead.';
  return `${prefix} Agent Kernel does not write environment credentials to disk.`;
}

export function credentialCommandPolicy(args, platform = process.platform) {
  const command = args[0];
  const action = args[1];
  const provider = args[2] || 'provider';
  if (platform !== 'win32' || command !== 'auth' || !['add', 'remove'].includes(action)) {
    return { allowed: true, exitCode: 0, message: '' };
  }

  const guidance = provider === 'supabase'
    ? supabaseEnvironmentGuidance(action)
    : 'Configure credentials through the provider CLI or environment without storing them in repository files.';
  return {
    allowed: false,
    exitCode: 2,
    message: `Agent Kernel auth ${action} is unavailable on Windows because a Windows Credential Manager backend is not configured. ${guidance}`
  };
}

export function sanitizeWindowsBrokerPath(pathValue, platform = process.platform) {
  if (platform !== 'win32') return pathValue || '';
  const names = ['security', 'supabase', 'gcloud'];
  return String(pathValue || '').split(path.delimiter).filter((dir) => {
    if (!dir) return false;
    return !names.some((name) => {
      const extensionless = path.join(dir, name);
      const recognized = ['.cmd', '.exe', '.bat'].some((ext) => fs.existsSync(path.join(dir, `${name}${ext}`)));
      return fs.existsSync(extensionless) && !recognized;
    });
  }).join(path.delimiter);
}

function normalizeInvocation(command, args, options, platform) {
  const commandArgs = Array.isArray(args) ? args : [];
  const commandOptions = Array.isArray(args) ? (options || {}) : (args || {});
  const normalized = normalizeUpdateCommand(command, commandArgs, { platform });
  return {
    command: normalized.command,
    args: normalized.args,
    options: {
      ...commandOptions,
      ...(normalized.windowsVerbatimArguments === undefined
        ? {}
        : { windowsVerbatimArguments: normalized.windowsVerbatimArguments })
    }
  };
}

export function installWindowsCommandCompatibility(platform = process.platform) {
  if (platform !== 'win32' || compatibilityInstalled) return;
  process.env.PATH = sanitizeWindowsBrokerPath(process.env.PATH, platform);
  childProcess.execFileSync = (command, args, options) => {
    const normalized = normalizeInvocation(command, args, options, platform);
    return originalExecFileSync(normalized.command, normalized.args, normalized.options);
  };
  childProcess.spawnSync = (command, args, options) => {
    const normalized = normalizeInvocation(command, args, options, platform);
    return originalSpawnSync(normalized.command, normalized.args, normalized.options);
  };
  compatibilityInstalled = true;
}

export async function runBroker(args = process.argv.slice(2), platform = process.platform) {
  const policy = credentialCommandPolicy(args, platform);
  if (!policy.allowed) {
    process.stderr.write(`${policy.message}\n`);
    process.exitCode = policy.exitCode;
    return policy.exitCode;
  }
  installWindowsCommandCompatibility(platform);
  const { main } = await import('./agent-kernel-project-broker.mjs');
  main();
  return process.exitCode || 0;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const modulePath = fileURLToPath(import.meta.url);
if (invokedPath === modulePath) await runBroker();
