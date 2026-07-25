import path from 'node:path';

function quoteCmdArgument(value) {
  const escaped = String(value).replace(/%/g, '%%').replace(/"/g, '""');
  return `"${escaped}"`;
}

export function normalizeChildCommand(command, args = [], runtime = {}) {
  const platform = runtime.platform || process.platform;
  const comspec = runtime.comspec || process.env.ComSpec || 'cmd.exe';
  const node = runtime.node || process.execPath;
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

function normalizeSyncCall(command, argsOrOptions, maybeOptions, runtime) {
  const hasArgumentArray = Array.isArray(argsOrOptions);
  const args = hasArgumentArray ? argsOrOptions : [];
  const options = hasArgumentArray ? (maybeOptions || {}) : (argsOrOptions || {});
  const normalized = normalizeChildCommand(command, args, runtime);
  return {
    command: normalized.command,
    args: normalized.args,
    options: {
      ...options,
      ...(normalized.windowsVerbatimArguments === undefined
        ? {}
        : { windowsVerbatimArguments: normalized.windowsVerbatimArguments })
    }
  };
}

export function installChildProcessCompatibility(childProcessModule, runtime = {}) {
  const originalExecFileSync = childProcessModule.execFileSync;
  const originalSpawnSync = childProcessModule.spawnSync;

  childProcessModule.execFileSync = function compatibleExecFileSync(command, argsOrOptions, maybeOptions) {
    const call = normalizeSyncCall(command, argsOrOptions, maybeOptions, runtime);
    return originalExecFileSync.call(childProcessModule, call.command, call.args, call.options);
  };

  childProcessModule.spawnSync = function compatibleSpawnSync(command, argsOrOptions, maybeOptions) {
    const call = normalizeSyncCall(command, argsOrOptions, maybeOptions, runtime);
    return originalSpawnSync.call(childProcessModule, call.command, call.args, call.options);
  };

  return () => {
    childProcessModule.execFileSync = originalExecFileSync;
    childProcessModule.spawnSync = originalSpawnSync;
  };
}

export function commandExtension(command) {
  return path.extname(String(command)).toLowerCase();
}
