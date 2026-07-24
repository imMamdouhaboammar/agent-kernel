#!/usr/bin/env node
import childProcess from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const originalExecFileSync = childProcess.execFileSync.bind(childProcess);

function quoteCmdArgument(value) {
  const escaped = String(value).replace(/%/g, '%%').replace(/"/g, '""');
  return `"${escaped}"`;
}

export function normalizeUpdateCommand(command, args = [], options = {}) {
  const platform = options.platform || process.platform;
  const comspec = options.comspec || process.env.ComSpec || 'cmd.exe';
  const node = options.node || process.execPath;
  const executable = String(command);
  const commandArgs = Array.isArray(args) ? [...args] : [];

  if (platform === 'win32' && /\.(?:cmd|bat)$/i.test(executable)) {
    const commandLine = [executable, ...commandArgs].map(quoteCmdArgument).join(' ');
    return {
      command: comspec,
      args: ['/d', '/s', '/c', `"${commandLine}"`],
      windowsVerbatimArguments: true
    };
  }

  if (platform === 'win32' && /\.[cm]?js$/i.test(executable)) {
    return { command: node, args: [executable, ...commandArgs] };
  }

  return { command: executable, args: commandArgs };
}

function executeUpdateCommand(command, args, options = {}) {
  const normalized = normalizeUpdateCommand(command, args);
  return originalExecFileSync(normalized.command, normalized.args, {
    ...options,
    ...(normalized.windowsVerbatimArguments === undefined
      ? {}
      : { windowsVerbatimArguments: normalized.windowsVerbatimArguments })
  });
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const modulePath = fileURLToPath(import.meta.url);

if (invokedPath === modulePath) {
  childProcess.execFileSync = executeUpdateCommand;
  await import('./agent-kernel-update.mjs');
}
