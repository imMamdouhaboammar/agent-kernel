import fs from 'node:fs';
import path from 'node:path';

function quoteCmdArgument(value) {
  const escaped = String(value).replace(/%/g, '%:~,%').replace(/"/g, '""');
  return `"${escaped}"`;
}

function isRegularFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function normalizeWindowsPath(filePath) {
  return path.win32.normalize(String(filePath)).toLowerCase();
}

function resolveWindowsCommandProcessor(runtime) {
  const systemRoot = runtime.systemRoot || process.env.SystemRoot || 'C:\\Windows';
  const expected = path.win32.join(systemRoot, 'System32', 'cmd.exe');
  const candidate = runtime.comspec || process.env.ComSpec || expected;
  if (normalizeWindowsPath(candidate) !== normalizeWindowsPath(expected)) {
    throw new Error(`Refusing untrusted Windows command processor: ${candidate}`);
  }
  if (runtime.validateFiles !== false && !isRegularFile(candidate)) {
    throw new Error(`Windows command processor is not a regular file: ${candidate}`);
  }
  return candidate;
}

function validateBatchLauncher(executable, runtime) {
  if (!path.win32.isAbsolute(executable)) {
    throw new Error(`Windows batch launcher must use an absolute path: ${executable}`);
  }
  const basename = path.win32.basename(executable, path.win32.extname(executable)).toLowerCase();
  const allowed = new Set((runtime.allowedBatchNames || []).map((name) => String(name).toLowerCase()));
  if (!allowed.has(basename)) {
    throw new Error(`Windows batch launcher is not allowlisted: ${basename}`);
  }
  if (runtime.validateFiles !== false) {
    const directory = normalizeWindowsPath(path.win32.dirname(executable));
    const allowedDirectories = new Set(
      (runtime.allowedBatchDirectories || []).map((item) => normalizeWindowsPath(item))
    );
    if (!allowedDirectories.has(directory)) {
      throw new Error(`Windows batch launcher directory is not trusted: ${path.win32.dirname(executable)}`);
    }
    if (!isRegularFile(executable)) {
      throw new Error(`Windows batch launcher is not a regular file: ${executable}`);
    }
  }
}

function redirectWindowsEntryPoint(executable, args, runtime) {
  const node = runtime.node || process.execPath;
  if (normalizeWindowsPath(executable) !== normalizeWindowsPath(node) || args.length === 0) return args;
  const redirects = Object.entries(runtime.entryPointRedirects || {});
  const requested = normalizeWindowsPath(args[0]);
  const redirect = redirects.find(([source]) => normalizeWindowsPath(source) === requested);
  if (!redirect) return args;
  const target = redirect[1];
  if (!path.win32.isAbsolute(target)) {
    throw new Error(`Windows entry-point redirect must use an absolute path: ${target}`);
  }
  if (runtime.validateFiles !== false && !isRegularFile(target)) {
    throw new Error(`Windows entry-point redirect is not a regular file: ${target}`);
  }
  return [target, ...args.slice(1)];
}

export function normalizeChildCommand(command, args = [], runtime = {}) {
  const platform = runtime.platform || process.platform;
  const node = runtime.node || process.execPath;
  const executable = String(command);
  const commandArgs = Array.isArray(args) ? [...args] : [];

  if (platform === 'win32') {
    const redirectedArgs = redirectWindowsEntryPoint(executable, commandArgs, runtime);
    if (redirectedArgs !== commandArgs) {
      return { command: executable, args: redirectedArgs };
    }
  }

  if (platform === 'win32' && /\.(?:cmd|bat)$/i.test(executable)) {
    validateBatchLauncher(executable, runtime);
    const commandLine = [executable, ...commandArgs].map(quoteCmdArgument).join(' ');
    return {
      command: resolveWindowsCommandProcessor(runtime),
      args: ['/d', '/s', '/c', `"${commandLine}"`],
      windowsVerbatimArguments: true
    };
  }

  if (platform === 'win32' && runtime.allowJavaScript === true && /\.[cm]?js$/i.test(executable)) {
    if (!path.win32.isAbsolute(executable)) {
      throw new Error(`Windows JavaScript launcher must use an absolute path: ${executable}`);
    }
    if (runtime.validateFiles !== false && !isRegularFile(executable)) {
      throw new Error(`Windows JavaScript launcher is not a regular file: ${executable}`);
    }
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
    // codeql[js/shell-command-injection-from-environment] Batch launchers and ComSpec are allowlisted and validated above.
    return originalExecFileSync.call(childProcessModule, call.command, call.args, call.options);
  };

  childProcessModule.spawnSync = function compatibleSpawnSync(command, argsOrOptions, maybeOptions) {
    const call = normalizeSyncCall(command, argsOrOptions, maybeOptions, runtime);
    // codeql[js/shell-command-injection-from-environment] Batch launchers and ComSpec are allowlisted and validated above.
    return originalSpawnSync.call(childProcessModule, call.command, call.args, call.options);
  };

  return () => {
    childProcessModule.execFileSync = originalExecFileSync;
    childProcessModule.spawnSync = originalSpawnSync;
  };
}
