#!/usr/bin/env node
import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installChildProcessCompatibility } from './agent-kernel-command-runner.mjs';

const modulePath = fileURLToPath(import.meta.url);
const brokerModulePath = fileURLToPath(new URL('./agent-kernel-project-broker.mjs', import.meta.url));

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
  if (command !== 'auth' || !['add', 'remove'].includes(action) || platform === 'darwin') {
    return { allowed: true, exitCode: 0, message: '' };
  }

  const guidance = provider === 'supabase'
    ? supabaseEnvironmentGuidance(action)
    : 'Configure credentials through the provider CLI or environment without storing them in repository files.';
  const backendMessage = platform === 'win32'
    ? 'a Windows Credential Manager backend is not configured'
    : `a secure credential backend is not configured for ${platform}`;
  return {
    allowed: false,
    exitCode: 2,
    message: `Agent Kernel auth ${action} is unavailable because ${backendMessage}. ${guidance}`
  };
}

function isRegularFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

export function sanitizeWindowsBrokerPath(pathValue, platform = process.platform) {
  if (platform !== 'win32') return pathValue || '';
  const names = ['security', 'supabase', 'gcloud'];
  return String(pathValue || '').split(path.delimiter).filter((entry) => {
    if (!entry) return false;
    const directory = path.resolve(entry);
    return !names.some((name) => {
      const extensionless = path.join(directory, name);
      const recognized = ['.cmd', '.exe', '.bat'].some((ext) => isRegularFile(path.join(directory, `${name}${ext}`)));
      return isRegularFile(extensionless) && !recognized;
    });
  }).join(path.delimiter);
}

export function installWindowsPathCompatibility(platform = process.platform) {
  if (platform !== 'win32') return;
  process.env.PATH = sanitizeWindowsBrokerPath(process.env.PATH, platform);
}

function trustedWindowsPathDirectories() {
  return String(process.env.PATH || '')
    .split(path.delimiter)
    .filter(Boolean)
    .map((entry) => path.resolve(entry));
}

async function loadBrokerMain() {
  const { main } = await import('./agent-kernel-project-broker.mjs');
  return main;
}

export async function runBroker(
  args = process.argv.slice(2),
  platform = process.platform,
  loadMain = loadBrokerMain
) {
  const policy = credentialCommandPolicy(args, platform);
  if (!policy.allowed) {
    process.stderr.write(`${policy.message}\n`);
    process.exitCode = policy.exitCode;
    return policy.exitCode;
  }

  installWindowsPathCompatibility(platform);
  const restoreChildProcess = platform === 'win32'
    ? installChildProcessCompatibility(childProcess, {
        platform,
        allowedBatchNames: ['supabase', 'gcloud'],
        allowedBatchDirectories: trustedWindowsPathDirectories,
        entryPointRedirects: { [brokerModulePath]: modulePath }
      })
    : () => {};
  try {
    const main = await loadMain();
    await main();
    return process.exitCode || 0;
  } finally {
    restoreChildProcess();
  }
}

function canonicalInvocationPath(filePath) {
  if (!filePath) return '';
  try {
    return fs.realpathSync.native(filePath);
  } catch {
    return path.resolve(filePath);
  }
}

const invokedPath = canonicalInvocationPath(process.argv[1]);
if (invokedPath === canonicalInvocationPath(modulePath)) await runBroker();
