#!/usr/bin/env node
import {
  vaultDoctor,
  vaultGetStatus,
  vaultHistory,
  vaultLinkProject,
  vaultListProjects,
  vaultMigrateLegacyProject,
  vaultPurgeProject,
  vaultRestoreProject,
  vaultRestoreRevision,
  vaultSyncProject,
  vaultUnlinkProject,
  watchVaultProject
} from '../src/env-vault.mjs';

const VALUE_FLAGS = new Set([
  'include',
  'exclude',
  'file',
  'revision',
  'interval',
  'max-bytes',
  'project'
]);
const REPEATED_FLAGS = new Set(['include', 'exclude', 'file']);

function parseFlags(argv) {
  const flags = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith('--')) {
      flags._.push(argument);
      continue;
    }
    const raw = argument.slice(2);
    const equals = raw.indexOf('=');
    const key = equals >= 0 ? raw.slice(0, equals) : raw;
    let value = equals >= 0 ? raw.slice(equals + 1) : true;
    if (equals < 0 && VALUE_FLAGS.has(key)) {
      const next = argv[index + 1];
      if (!next || next.startsWith('--')) throw new Error(`--${key} requires a value`);
      value = next;
      index += 1;
    }
    if (REPEATED_FLAGS.has(key)) {
      flags[key] = [...(flags[key] || []), value];
    } else {
      flags[key] = value;
    }
  }
  return flags;
}

function usage() {
  process.stdout.write(`Project Environment Vault\n\nCommands:\n  agent-kernel env link [project] [--include path] [--exclude pattern] [--allow-empty]\n  agent-kernel env status [project] [--json]\n  agent-kernel env push [project] [--file path] [--prune] [--dry-run]\n  agent-kernel env pull [project] [--file path] [--force] [--no-backup] [--dry-run]\n  agent-kernel env watch [project] [--interval seconds]\n  agent-kernel env doctor [project] [--repair-permissions] [--migrate]\n  agent-kernel env history [project] [--file path]\n  agent-kernel env restore [project] --file path --revision id [--force]\n  agent-kernel env list\n  agent-kernel env unlink [project]\n  agent-kernel env purge [project] --yes\n\nCommon flags:\n  --json\n  --allow-path-identity\n  --max-bytes number\n`);
}

function optionsFrom(flags) {
  return {
    include: flags.include,
    exclude: flags.exclude,
    files: flags.file,
    file: Array.isArray(flags.file) && flags.file.length === 1 ? flags.file[0] : flags.file,
    revision: flags.revision,
    allowEmpty: flags['allow-empty'] === true,
    allowPathIdentity: flags['allow-path-identity'] === true,
    force: flags.force === true,
    noBackup: flags['no-backup'] === true,
    prune: flags.prune === true,
    repairPermissions: flags['repair-permissions'] === true,
    confirm: flags.yes === true,
    maxBytes: flags['max-bytes'] ? Number(flags['max-bytes']) : undefined
  };
}

function projectFrom(flags) {
  return String(flags.project || flags._[1] || '.');
}

function outputJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function outputStatus(status) {
  process.stdout.write(`Environment Vault status\n`);
  process.stdout.write(`Linked: ${status.linked ? 'YES' : 'NO'}\n`);
  process.stdout.write(`Healthy: ${status.healthy === false ? 'NO' : 'YES'}\n`);
  if (status.fingerprint) process.stdout.write(`Fingerprint: ${status.fingerprint}\n`);
  if (status.canonical) process.stdout.write(`Identity: ${status.canonical}\n`);
  if (status.error) process.stdout.write(`Error: ${status.error}\n`);
  for (const item of status.diffs || []) process.stdout.write(`- ${item.file}: ${item.status}\n`);
}

function outputResult(command, result) {
  if (command === 'link') {
    process.stdout.write('Linked project to Environment Vault\n');
    process.stdout.write(`Fingerprint: ${result.fingerprint}\n`);
    process.stdout.write(`Files: ${result.syncedFiles.length ? result.syncedFiles.join(', ') : 'none'}\n`);
    return;
  }
  if (command === 'push') {
    process.stdout.write(`Environment Vault push complete\nChanged: ${result.changedFiles?.length || 0}\nUnchanged: ${result.unchangedFiles?.length || 0}\n`);
    return;
  }
  if (command === 'pull') {
    process.stdout.write(`Environment Vault pull ${result.ok ? 'complete' : 'blocked by conflicts'}\n`);
    for (const file of result.restoredFiles || []) process.stdout.write(`Restored ${file}\n`);
    for (const conflict of result.conflicts || []) process.stdout.write(`Conflict ${conflict.file}\n`);
    for (const backup of result.backups || []) process.stdout.write(`Backup ${backup.file}: ${backup.backupPath}\n`);
    return;
  }
  if (command === 'unlink') {
    process.stdout.write(result.ok ? 'Unlinked project from Environment Vault, stored files retained\n' : `${result.reason}\n`);
    return;
  }
  if (command === 'purge') {
    process.stdout.write(result.ok ? 'Purged Environment Vault data\n' : `${result.reason}\n`);
    return;
  }
  if (command === 'doctor') {
    process.stdout.write(`Environment Vault doctor: ${result.ok ? 'healthy' : 'issues found'}\n`);
    for (const issue of result.issues || []) process.stdout.write(`- ${issue.code}: ${issue.file || issue.path || issue.message || ''}\n`);
    for (const repair of result.repairs || []) process.stdout.write(`- repaired ${repair.path}\n`);
    return;
  }
  if (command === 'history') {
    for (const item of result) {
      process.stdout.write(`${item.file}\n`);
      for (const revision of item.revisions) process.stdout.write(`- ${revision.id} ${revision.createdAt} ${revision.sha256}\n`);
    }
    return;
  }
  if (command === 'restore') {
    process.stdout.write(result.ok ? `Restored revision ${result.revision}\n` : 'Revision restore blocked by conflict\n');
    return;
  }
  outputJson(result);
}

function setExitCode(result) {
  if (result?.ok === false || result?.healthy === false) process.exitCode = 2;
}

function main() {
  const flags = parseFlags(process.argv.slice(2));
  const command = flags._[0] || 'status';
  if (flags.help || command === 'help') return usage();
  const project = projectFrom(flags);
  const options = optionsFrom(flags);

  if (command === 'status') {
    const result = vaultGetStatus(project, options);
    flags.json ? outputJson(result) : outputStatus(result);
    if (result.linked && result.healthy === false) process.exitCode = 2;
    return;
  }

  if (command === 'list') {
    const result = vaultListProjects();
    if (flags.json) outputJson(result);
    else if (!result.length) process.stdout.write('No Environment Vault projects found\n');
    else for (const item of result) process.stdout.write(`${item.projectName || 'unknown'}  ${item.fingerprint}  ${item.healthy ? 'healthy' : 'unhealthy'}\n`);
    return;
  }

  if (flags['dry-run'] === true && ['push', 'pull'].includes(command)) {
    const result = { ok: true, dryRun: true, command, status: vaultGetStatus(project, options) };
    flags.json ? outputJson(result) : process.stdout.write(`Dry run for env ${command}\nNo files were changed\n`);
    return;
  }

  if (command === 'link') {
    const result = vaultLinkProject(project, options);
    flags.json ? outputJson(result) : outputResult(command, result);
    return;
  }
  if (command === 'push' || command === 'sync') {
    const result = vaultSyncProject(project, options);
    flags.json ? outputJson(result) : outputResult('push', result);
    setExitCode(result);
    return;
  }
  if (command === 'pull') {
    const result = vaultRestoreProject(project, options);
    flags.json ? outputJson(result) : outputResult(command, result);
    setExitCode(result);
    return;
  }
  if (command === 'unlink') {
    const result = vaultUnlinkProject(project, options);
    flags.json ? outputJson(result) : outputResult(command, result);
    setExitCode(result);
    return;
  }
  if (command === 'purge') {
    const result = vaultPurgeProject(project, options);
    flags.json ? outputJson(result) : outputResult(command, result);
    setExitCode(result);
    return;
  }
  if (command === 'doctor') {
    let migration = null;
    if (flags.migrate === true) migration = vaultMigrateLegacyProject(project, options);
    const result = vaultDoctor(project, options);
    const combined = migration ? { ...result, migration } : result;
    flags.json ? outputJson(combined) : outputResult(command, combined);
    setExitCode(result);
    return;
  }
  if (command === 'history') {
    const result = vaultHistory(project, options);
    flags.json ? outputJson(result) : outputResult(command, result);
    return;
  }
  if (command === 'restore') {
    const result = vaultRestoreRevision(project, options);
    flags.json ? outputJson(result) : outputResult(command, result);
    setExitCode(result);
    return;
  }
  if (command === 'watch') {
    const intervalSeconds = Number(flags.interval || 30);
    const watcher = watchVaultProject(project, {
      ...options,
      intervalMs: Math.max(1, intervalSeconds) * 1000,
      onSync(result) {
        if (!flags.json && result.changedFiles?.length) {
          process.stdout.write(`Synced ${result.changedFiles.join(', ')}\n`);
        }
      },
      onError(error) {
        process.stderr.write(`${error.message}\n`);
      }
    });
    if (flags.json) outputJson({ ok: true, watching: watcher.selectedFiles, fingerprint: watcher.fingerprint });
    else process.stdout.write(`Watching ${watcher.selectedFiles.length} environment files\nPress Ctrl+C to stop\n`);
    const close = () => {
      watcher.close();
      process.exit(0);
    };
    process.once('SIGINT', close);
    process.once('SIGTERM', close);
    return;
  }

  throw new Error(`Unknown Environment Vault command: ${command}`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error?.message || String(error)}\n`);
  process.exitCode = 1;
}
