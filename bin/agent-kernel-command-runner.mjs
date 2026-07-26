import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import os from 'node:os';
import path from 'node:path';

let batchEnvironmentSequence = 0;

function batchEnvironmentValue(value) {
  const text = String(value);
  if (/[\0\r\n]/.test(text)) {
    throw new Error('Windows batch arguments must not contain NUL or line breaks');
  }
  return text.replace(/"/g, '""');
}

function createBatchEnvironmentInvocation(executable, args) {
  const prefix = `AGENT_KERNEL_CMD_${process.pid}_${batchEnvironmentSequence++}`;
  const environment = {};
  const references = [executable, ...args].map((value, index) => {
    const name = `${prefix}_${index}`;
    environment[name] = batchEnvironmentValue(value);
    return `"%${name}%"`;
  });
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-kernel-cmd-'));
  const scriptPath = path.join(temporaryDirectory, 'invoke.cmd');
  const source = `@echo off\r\n${references.join(' ')}\r\nexit /b %errorlevel%\r\n`;
  fs.writeFileSync(scriptPath, source, { encoding: 'utf8', mode: 0o600 });
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    process.off('exit', cleanup);
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  };
  process.once('exit', cleanup);
  return { scriptPath, environment, cleanup };
}

function resolvedWindowsPath(filePath) {
  return path.win32.resolve(String(filePath));
}

function isRegularFile(filePath) {
  try {
    return fs.statSync(resolvedWindowsPath(filePath)).isFile();
  } catch {
    return false;
  }
}

function normalizeWindowsPath(filePath) {
  return path.win32.normalize(resolvedWindowsPath(filePath)).toLowerCase();
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
  return resolvedWindowsPath(candidate);
}

function configuredBatchDirectories(runtime) {
  if (typeof runtime.allowedBatchDirectories === 'function') return runtime.allowedBatchDirectories();
  if (Array.isArray(runtime.allowedBatchDirectories)) return runtime.allowedBatchDirectories;
  return String(process.env.PATH || '').split(path.delimiter).filter(Boolean);
}

function hasConfiguredBatchExecutables(runtime) {
  return typeof runtime.allowedBatchExecutables === 'function' ||
    Array.isArray(runtime.allowedBatchExecutables);
}

function configuredBatchExecutables(runtime) {
  if (typeof runtime.allowedBatchExecutables === 'function') return runtime.allowedBatchExecutables();
  if (Array.isArray(runtime.allowedBatchExecutables)) return runtime.allowedBatchExecutables;
  return [];
}

function validateBatchLauncher(executable, runtime) {
  if (!path.win32.isAbsolute(executable)) {
    throw new Error(`Windows batch launcher must use an absolute path: ${executable}`);
  }
  const resolvedExecutable = resolvedWindowsPath(executable);
  const basename = path.win32.basename(resolvedExecutable, path.win32.extname(resolvedExecutable)).toLowerCase();
  const allowed = new Set((runtime.allowedBatchNames || []).map((name) => String(name).toLowerCase()));
  if (!allowed.has(basename)) {
    throw new Error(`Windows batch launcher is not allowlisted: ${basename}`);
  }
  if (runtime.validateFiles !== false) {
    const exactPolicyConfigured = hasConfiguredBatchExecutables(runtime);
    const exactLaunchers = new Set(configuredBatchExecutables(runtime).map(normalizeWindowsPath));
    if (exactPolicyConfigured && exactLaunchers.size === 0) {
      throw new Error('Windows batch launcher exact allowlist is configured but empty');
    }
    if (exactPolicyConfigured && !exactLaunchers.has(normalizeWindowsPath(resolvedExecutable))) {
      throw new Error(`Windows batch launcher path is not trusted: ${resolvedExecutable}`);
    }
    if (!exactPolicyConfigured) {
      const directory = normalizeWindowsPath(path.win32.dirname(resolvedExecutable));
      const allowedDirectories = new Set(configuredBatchDirectories(runtime).map(normalizeWindowsPath));
      if (!allowedDirectories.has(directory)) {
        throw new Error(`Windows batch launcher directory is not trusted: ${path.win32.dirname(resolvedExecutable)}`);
      }
    }
    if (!isRegularFile(resolvedExecutable)) {
      throw new Error(`Windows batch launcher is not a regular file: ${resolvedExecutable}`);
    }
  }
  return resolvedExecutable;
}

function redirectWindowsEntryPoint(executable, args, runtime) {
  const node = runtime.node || process.execPath;
  if (normalizeWindowsPath(executable) !== normalizeWindowsPath(node) || args.length === 0) return args;
  const redirects = Object.entries(runtime.entryPointRedirects || {});
  const requested = normalizeWindowsPath(args[0]);
  const redirect = redirects.find(([source]) => normalizeWindowsPath(source) === requested);
  if (!redirect) return args;
  const target = resolvedWindowsPath(redirect[1]);
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
    if (redirectedArgs !== commandArgs) return { command: executable, args: redirectedArgs };
  }

  if (platform === 'win32' && /\.(?:cmd|bat)$/i.test(executable)) {
    const trustedExecutable = validateBatchLauncher(executable, runtime);
    const invocation = createBatchEnvironmentInvocation(trustedExecutable, commandArgs);
    return {
      command: resolveWindowsCommandProcessor(runtime),
      args: ['/d', '/v:off', '/c', invocation.scriptPath],
      environment: invocation.environment,
      cleanup: invocation.cleanup,
      shell: false,
      windowsVerbatimArguments: false
    };
  }

  if (platform === 'win32' && runtime.allowJavaScript === true && /\.[cm]?js$/i.test(executable)) {
    if (!path.win32.isAbsolute(executable)) {
      throw new Error(`Windows JavaScript launcher must use an absolute path: ${executable}`);
    }
    const resolvedExecutable = resolvedWindowsPath(executable);
    if (runtime.validateFiles !== false && !isRegularFile(resolvedExecutable)) {
      throw new Error(`Windows JavaScript launcher is not a regular file: ${resolvedExecutable}`);
    }
    return { command: node, args: [resolvedExecutable, ...commandArgs] };
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
    cleanup: normalized.cleanup,
    options: {
      ...options,
      ...(normalized.environment === undefined
        ? {}
        : { env: { ...process.env, ...(options.env || {}), ...normalized.environment } }),
      ...(normalized.shell === undefined ? {} : { shell: normalized.shell }),
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
    try {
      return originalExecFileSync.call(childProcessModule, call.command, call.args, call.options);
    } finally {
      call.cleanup?.();
    }
  };
  childProcessModule.spawnSync = function compatibleSpawnSync(command, argsOrOptions, maybeOptions) {
    const call = normalizeSyncCall(command, argsOrOptions, maybeOptions, runtime);
    try {
      return originalSpawnSync.call(childProcessModule, call.command, call.args, call.options);
    } finally {
      call.cleanup?.();
    }
  };
  syncBuiltinESMExports();

  return () => {
    childProcessModule.execFileSync = originalExecFileSync;
    childProcessModule.spawnSync = originalSpawnSync;
    syncBuiltinESMExports();
  };
}
