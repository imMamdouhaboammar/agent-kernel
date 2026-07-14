#!/usr/bin/env node
import childProcess from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const PACKAGE_NAME = '@mamdouh-aboammar/agent-kernel';
const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(here, '..', 'package.json'), 'utf8'));
const CURRENT_VERSION = String(pkg.version);
const DEFAULT_UPDATES = Object.freeze({
  mode: 'disabled',
  channel: 'latest',
  trustedAgents: [],
  checkIntervalHours: 24
});
const AGENT_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const TAG_PATTERN = /^[a-z][a-z0-9._-]{0,63}$/;
const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function kernelHome() {
  return process.env.AGENT_KERNEL_HOME || path.join(os.homedir(), '.agent-kernel');
}

function paths() {
  const root = kernelHome();
  return {
    root,
    config: path.join(root, 'config.json'),
    cache: path.join(root, 'runtime', 'update-status.json'),
    audit: path.join(root, 'logs', 'updates.jsonl')
  };
}

function nowIso() {
  return new Date().toISOString();
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function atomicWriteJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  const temporary = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', 'utf8');
  fs.renameSync(temporary, filePath);
}

function appendAudit(event) {
  const p = paths();
  ensureDir(path.dirname(p.audit));
  const allowed = {
    at: nowIso(),
    action: String(event.action || 'unknown').slice(0, 64),
    outcome: String(event.outcome || 'unknown').slice(0, 32),
    error: event.error ? String(event.error).slice(0, 64) : null,
    agent: event.agent ? String(event.agent).slice(0, 64) : null,
    channel: event.channel ? String(event.channel).slice(0, 64) : null,
    previousVersion: event.previousVersion ? String(event.previousVersion).slice(0, 64) : null,
    targetVersion: event.targetVersion ? String(event.targetVersion).slice(0, 64) : null
  };
  fs.appendFileSync(p.audit, JSON.stringify(allowed) + '\n', 'utf8');
}

function parseFlags(argv) {
  const flags = { _: [] };
  for (let index = 0; index < argv.length; index++) {
    const value = argv[index];
    if (!value.startsWith('--')) {
      flags._.push(value);
      continue;
    }
    const raw = value.slice(2);
    const equals = raw.indexOf('=');
    if (equals >= 0) {
      flags[raw.slice(0, equals)] = raw.slice(equals + 1);
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      flags[raw] = next;
      index++;
    } else {
      flags[raw] = true;
    }
  }
  return flags;
}

function normalizeAgent(value) {
  const agent = String(value || '').trim().toLowerCase();
  if (!AGENT_PATTERN.test(agent)) throw new UpdateError('invalid-agent', `Invalid agent identity: ${value || '(empty)'}`);
  return agent;
}

function normalizeAgentList(value) {
  const agents = String(value || '').split(',').map((item) => item.trim()).filter(Boolean).map(normalizeAgent);
  return [...new Set(agents)];
}

function parseSemver(value) {
  const match = String(value || '').match(SEMVER_PATTERN);
  if (!match) return null;
  return {
    raw: String(value),
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split('.') : []
  };
}

function compareIdentifiers(left, right) {
  const leftNumeric = /^\d+$/.test(left);
  const rightNumeric = /^\d+$/.test(right);
  if (leftNumeric && rightNumeric) return Number(left) - Number(right);
  if (leftNumeric) return -1;
  if (rightNumeric) return 1;
  return left.localeCompare(right);
}

function compareVersions(leftValue, rightValue) {
  const left = parseSemver(leftValue);
  const right = parseSemver(rightValue);
  if (!left || !right) throw new UpdateError('invalid-version', `Invalid semantic version comparison: ${leftValue} and ${rightValue}`);
  for (const field of ['major', 'minor', 'patch']) {
    if (left[field] !== right[field]) return left[field] - right[field];
  }
  if (!left.prerelease.length && !right.prerelease.length) return 0;
  if (!left.prerelease.length) return 1;
  if (!right.prerelease.length) return -1;
  const length = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < length; index++) {
    if (left.prerelease[index] === undefined) return -1;
    if (right.prerelease[index] === undefined) return 1;
    const compared = compareIdentifiers(left.prerelease[index], right.prerelease[index]);
    if (compared !== 0) return compared;
  }
  return 0;
}

function validateChannel(value) {
  const channel = String(value || '').trim();
  if (parseSemver(channel) || TAG_PATTERN.test(channel)) return channel;
  throw new UpdateError('invalid-channel', `Invalid update channel: ${value || '(empty)'}`);
}

function validateUpdates(updates) {
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    throw new UpdateError('invalid-config', 'Update configuration must be an object.');
  }
  if (!['disabled', 'agent-approved'].includes(updates.mode)) {
    throw new UpdateError('invalid-config', `Invalid update mode: ${updates.mode}`);
  }
  const channel = validateChannel(updates.channel);
  const trustedAgents = Array.isArray(updates.trustedAgents)
    ? [...new Set(updates.trustedAgents.map(normalizeAgent))]
    : (() => { throw new UpdateError('invalid-config', 'trustedAgents must be an array.'); })();
  const checkIntervalHours = Number(updates.checkIntervalHours);
  if (!Number.isFinite(checkIntervalHours) || checkIntervalHours < 1 || checkIntervalHours > 168) {
    throw new UpdateError('invalid-config', 'checkIntervalHours must be between 1 and 168.');
  }
  return { mode: updates.mode, channel, trustedAgents, checkIntervalHours };
}

function loadConfig() {
  const p = paths();
  const base = readJson(p.config, {});
  if (!base || typeof base !== 'object' || Array.isArray(base)) {
    throw new UpdateError('invalid-config', `Invalid JSON configuration at ${p.config}`);
  }
  return {
    ...base,
    updates: validateUpdates({ ...DEFAULT_UPDATES, ...(base.updates || {}) })
  };
}

function saveConfig(config) {
  const validated = { ...config, updates: validateUpdates(config.updates) };
  atomicWriteJson(paths().config, validated);
  return validated;
}

function readCache() {
  const cache = readJson(paths().cache, null);
  if (!cache || cache.schemaVersion !== 1 || cache.packageName !== PACKAGE_NAME) return null;
  return cache;
}

function cacheIsFresh(cache, config) {
  if (!cache || cache.channel !== config.updates.channel || cache.currentVersion !== CURRENT_VERSION || cache.error) return false;
  const checkedAt = Date.parse(cache.checkedAt || '');
  if (!Number.isFinite(checkedAt)) return false;
  return Date.now() - checkedAt < config.updates.checkIntervalHours * 60 * 60 * 1000;
}

function npmBin() {
  return process.env.AGENT_KERNEL_NPM_BIN || 'npm';
}

function cliBin() {
  if (process.env.AGENT_KERNEL_UPDATE_CLI_BIN) return process.env.AGENT_KERNEL_UPDATE_CLI_BIN;
  return process.platform === 'win32' ? 'agent-kernel.cmd' : 'agent-kernel';
}

function runFile(command, args, options = {}) {
  return childProcess.execFileSync(command, args, {
    encoding: 'utf8',
    timeout: options.timeout || 30000,
    stdio: options.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    env: process.env
  });
}

function selectVersion(raw) {
  let parsed;
  try {
    parsed = JSON.parse(String(raw).trim());
  } catch {
    parsed = String(raw).trim().replace(/^['"]|['"]$/g, '');
  }
  const candidates = Array.isArray(parsed) ? parsed : [parsed];
  const versions = candidates.map(String).filter((item) => parseSemver(item));
  if (!versions.length) throw new UpdateError('registry-invalid-response', 'The npm registry returned no valid semantic version.');
  versions.sort(compareVersions);
  return versions[versions.length - 1];
}

function writeCheckFailure(config, category) {
  const cache = {
    schemaVersion: 1,
    packageName: PACKAGE_NAME,
    currentVersion: CURRENT_VERSION,
    channel: config.updates.channel,
    targetVersion: null,
    updateAvailable: false,
    checkedAt: nowIso(),
    error: category
  };
  atomicWriteJson(paths().cache, cache);
  appendAudit({ action: 'check', outcome: 'failure', error: category, channel: config.updates.channel, previousVersion: CURRENT_VERSION });
}

function checkForUpdate(config, { force = false } = {}) {
  const cached = readCache();
  if (!force && cacheIsFresh(cached, config)) return { ...cached, cached: true };
  try {
    const raw = runFile(npmBin(), ['view', `${PACKAGE_NAME}@${config.updates.channel}`, 'version', '--json'], { timeout: 15000 });
    const targetVersion = selectVersion(raw);
    const cache = {
      schemaVersion: 1,
      packageName: PACKAGE_NAME,
      currentVersion: CURRENT_VERSION,
      channel: config.updates.channel,
      targetVersion,
      updateAvailable: compareVersions(targetVersion, CURRENT_VERSION) > 0,
      checkedAt: nowIso(),
      error: null
    };
    atomicWriteJson(paths().cache, cache);
    appendAudit({
      action: 'check',
      outcome: 'success',
      channel: config.updates.channel,
      previousVersion: CURRENT_VERSION,
      targetVersion
    });
    return { ...cache, cached: false };
  } catch (error) {
    const category = error instanceof UpdateError ? error.category : 'registry-unavailable';
    writeCheckFailure(config, category);
    throw new UpdateError(category === 'registry-invalid-response' ? category : 'registry-unavailable', 'Unable to resolve the configured update channel.');
  }
}

async function confirmed(action, flags) {
  if (flags.yes === true || flags.yes === 'true') return true;
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new UpdateError('confirmation-required', `${action} requires interactive confirmation or --yes.`);
  }
  const interfaceHandle = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await interfaceHandle.question(`${action}. Continue? [y/N] `);
    if (!/^y(es)?$/i.test(answer.trim())) throw new UpdateError('confirmation-declined', 'Update configuration change was not confirmed.');
    return true;
  } finally {
    interfaceHandle.close();
  }
}

function statusPayload(config) {
  const cache = readCache();
  return {
    ok: true,
    packageName: PACKAGE_NAME,
    currentVersion: CURRENT_VERSION,
    mode: config.updates.mode,
    channel: config.updates.channel,
    trustedAgents: config.updates.trustedAgents,
    checkIntervalHours: config.updates.checkIntervalHours,
    cache
  };
}

function authorize(config, flags) {
  if (config.updates.mode !== 'agent-approved') {
    appendAudit({ action: 'apply', outcome: 'denied', error: 'updates-disabled', channel: config.updates.channel, previousVersion: CURRENT_VERSION });
    throw new UpdateError('updates-disabled', 'Agent-approved updates are disabled.');
  }
  const identity = flags.agent || process.env.AGENT_KERNEL_AGENT_ID;
  if (!identity) {
    appendAudit({ action: 'apply', outcome: 'denied', error: 'missing-agent', channel: config.updates.channel, previousVersion: CURRENT_VERSION });
    throw new UpdateError('missing-agent', 'Update apply requires --agent or AGENT_KERNEL_AGENT_ID.');
  }
  const agent = normalizeAgent(identity);
  if (!config.updates.trustedAgents.includes(agent)) {
    appendAudit({ action: 'apply', outcome: 'denied', error: 'unauthorized-agent', agent, channel: config.updates.channel, previousVersion: CURRENT_VERSION });
    throw new UpdateError('unauthorized-agent', `Agent is not trusted to update Agent Kernel: ${agent}`);
  }
  return agent;
}

function installVersion(version, inherit) {
  return runFile(npmBin(), ['install', '--global', `${PACKAGE_NAME}@${version}`], { timeout: 120000, inherit });
}

function installedVersion() {
  return String(runFile(cliBin(), ['version'], { timeout: 15000 })).trim();
}

function verifyInstalled(version, inherit) {
  const actual = installedVersion();
  if (actual !== version) throw new UpdateError('verification-failed', `Installed CLI reported ${actual}; expected ${version}.`);
  runFile(cliBin(), ['doctor'], { timeout: 30000, inherit });
  runFile(cliBin(), ['compile'], { timeout: 30000, inherit });
  runFile(cliBin(), ['sync'], { timeout: 30000, inherit });
}

function rollbackVersion(previousVersion, inherit) {
  try {
    installVersion(previousVersion, inherit);
    const actual = installedVersion();
    return actual === previousVersion;
  } catch {
    return false;
  }
}

function updateSuccessCache(config, version) {
  atomicWriteJson(paths().cache, {
    schemaVersion: 1,
    packageName: PACKAGE_NAME,
    currentVersion: version,
    channel: config.updates.channel,
    targetVersion: version,
    updateAvailable: false,
    checkedAt: nowIso(),
    error: null
  });
}

function emit(payload, flags) {
  if (flags.json) {
    process.stdout.write(JSON.stringify(payload) + '\n');
    return;
  }
  if (payload.message) process.stdout.write(payload.message + '\n');
  else process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
}

function emitError(error, flags) {
  const payload = {
    ok: false,
    error: error.category || 'update-failed',
    message: error.message,
    ...(error.details || {})
  };
  if (flags.json) process.stdout.write(JSON.stringify(payload) + '\n');
  else process.stderr.write(`${payload.error}: ${payload.message}\n`);
  process.exitCode = 1;
}

class UpdateError extends Error {
  constructor(category, message, details = null) {
    super(message);
    this.category = category;
    this.details = details;
  }
}

function usage() {
  process.stdout.write(`Agent Kernel updater\n\nUsage:\n  agent-kernel update status [--json]\n  agent-kernel update check [--force] [--json]\n  agent-kernel update enable --agents claude,codex [--yes] [--json]\n  agent-kernel update disable [--yes] [--json]\n  agent-kernel update channel <latest|next|semver> [--yes] [--json]\n  agent-kernel update trust <agent-id> [--yes] [--json]\n  agent-kernel update revoke <agent-id> [--yes] [--json]\n  agent-kernel update apply --agent <agent-id> [--json]\n`);
}

async function main() {
  const [action, ...argv] = process.argv.slice(2);
  const flags = parseFlags(argv);
  try {
    if (!action || action === 'help' || flags.help) return usage();
    let config = loadConfig();

    if (action === 'status') return emit(statusPayload(config), flags);

    if (action === 'check') {
      const checked = checkForUpdate(config, { force: Boolean(flags.force) });
      return emit({ ok: true, ...checked }, flags);
    }

    if (action === 'enable') {
      await confirmed('Enable agent-approved updates', flags);
      const trustedAgents = normalizeAgentList(flags.agents);
      if (!trustedAgents.length) throw new UpdateError('invalid-agent', 'Enable requires --agents with at least one agent identity.');
      config = saveConfig({ ...config, updates: { ...config.updates, mode: 'agent-approved', trustedAgents } });
      appendAudit({ action: 'enable', outcome: 'success', channel: config.updates.channel });
      return emit(statusPayload(config), flags);
    }

    if (action === 'disable') {
      await confirmed('Disable agent-approved updates', flags);
      config = saveConfig({ ...config, updates: { ...config.updates, mode: 'disabled' } });
      appendAudit({ action: 'disable', outcome: 'success', channel: config.updates.channel });
      return emit(statusPayload(config), flags);
    }

    if (action === 'channel') {
      const channel = validateChannel(flags._[0]);
      await confirmed(`Set update channel to ${channel}`, flags);
      config = saveConfig({ ...config, updates: { ...config.updates, channel } });
      try { fs.unlinkSync(paths().cache); } catch {}
      appendAudit({ action: 'channel', outcome: 'success', channel });
      return emit(statusPayload(config), flags);
    }

    if (action === 'trust') {
      const agent = normalizeAgent(flags._[0]);
      await confirmed(`Trust agent ${agent}`, flags);
      const trustedAgents = [...new Set([...config.updates.trustedAgents, agent])];
      config = saveConfig({ ...config, updates: { ...config.updates, trustedAgents } });
      appendAudit({ action: 'trust', outcome: 'success', agent, channel: config.updates.channel });
      return emit(statusPayload(config), flags);
    }

    if (action === 'revoke') {
      const agent = normalizeAgent(flags._[0]);
      await confirmed(`Revoke agent ${agent}`, flags);
      const trustedAgents = config.updates.trustedAgents.filter((item) => item !== agent);
      config = saveConfig({ ...config, updates: { ...config.updates, trustedAgents } });
      appendAudit({ action: 'revoke', outcome: 'success', agent, channel: config.updates.channel });
      return emit(statusPayload(config), flags);
    }

    if (action === 'apply') {
      const agent = authorize(config, flags);
      const checked = checkForUpdate(config, { force: true });
      const targetVersion = checked.targetVersion;
      if (compareVersions(targetVersion, CURRENT_VERSION) < 0) {
        throw new UpdateError('downgrade-refused', `Refusing to downgrade ${CURRENT_VERSION} to ${targetVersion}.`);
      }
      if (compareVersions(targetVersion, CURRENT_VERSION) === 0) {
        return emit({ ok: true, upToDate: true, agent, currentVersion: CURRENT_VERSION, targetVersion }, flags);
      }

      const inherit = !flags.json;
      appendAudit({ action: 'install', outcome: 'started', agent, channel: config.updates.channel, previousVersion: CURRENT_VERSION, targetVersion });
      try {
        installVersion(targetVersion, inherit);
      } catch {
        appendAudit({ action: 'install', outcome: 'failure', error: 'install-failed', agent, channel: config.updates.channel, previousVersion: CURRENT_VERSION, targetVersion });
        throw new UpdateError('install-failed', `Failed to install Agent Kernel ${targetVersion}.`);
      }

      try {
        verifyInstalled(targetVersion, inherit);
      } catch {
        const rollbackSucceeded = rollbackVersion(CURRENT_VERSION, inherit);
        appendAudit({
          action: 'rollback',
          outcome: rollbackSucceeded ? 'success' : 'failure',
          error: rollbackSucceeded ? null : 'rollback-failed',
          agent,
          channel: config.updates.channel,
          previousVersion: CURRENT_VERSION,
          targetVersion
        });
        throw new UpdateError('verification-failed', `Agent Kernel ${targetVersion} failed verification.`, {
          agent,
          previousVersion: CURRENT_VERSION,
          targetVersion,
          rollbackAttempted: true,
          rollbackSucceeded
        });
      }

      updateSuccessCache(config, targetVersion);
      appendAudit({ action: 'apply', outcome: 'success', agent, channel: config.updates.channel, previousVersion: CURRENT_VERSION, targetVersion });
      return emit({
        ok: true,
        agent,
        previousVersion: CURRENT_VERSION,
        targetVersion,
        rollbackAttempted: false,
        rollbackSucceeded: false
      }, flags);
    }

    throw new UpdateError('unknown-command', `Unknown update command: ${action}`);
  } catch (error) {
    emitError(error instanceof UpdateError ? error : new UpdateError('update-failed', 'The updater failed safely.'), flags);
  }
}

await main();
