#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

export async function runBroker(args = process.argv.slice(2), platform = process.platform) {
  const policy = credentialCommandPolicy(args, platform);
  if (!policy.allowed) {
    process.stderr.write(`${policy.message}\n`);
    process.exitCode = policy.exitCode;
    return policy.exitCode;
  }
  const { main } = await import('./agent-kernel-project-broker.mjs');
  main();
  return process.exitCode || 0;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const modulePath = fileURLToPath(import.meta.url);
if (invokedPath === modulePath) await runBroker();
