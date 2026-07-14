// test/public-cli-update.mjs
//
// Invariants:
//   1. Agent-approved updates are disabled by default.
//   2. Governance changes require explicit user confirmation.
//   3. Channels and agent identities are validated before persistence.
//   4. Registry checks are cached and never required by unrelated commands.
//   5. Only allowlisted agents can apply an exact resolved version.
//   6. Verification failure triggers one rollback attempt.
//   7. Update notifications reach generated agent guidance and router stderr.
//   8. Audit records never include arbitrary subprocess output or secrets.

import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { makeEnv, repo, runCli } from './_lib/helpers.mjs';

export const name = 'public-cli-update';

const publicCli = path.join(repo.root, 'bin', 'agent-kernel-router.mjs');

function writeExecutable(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  fs.chmodSync(filePath, 0o755);
}

function runPublic(env, ...args) {
  return childProcess.execFileSync(process.execPath, [publicCli, ...args], {
    cwd: repo.root,
    env,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
}

function runPublicResult(env, ...args) {
  try {
    const stdout = runPublic(env, ...args);
    return { status: 0, stdout, stderr: '' };
  } catch (error) {
    return {
      status: error.status || 1,
      stdout: String(error.stdout || ''),
      stderr: String(error.stderr || '')
    };
  }
}

function runPublicCapture(env, ...args) {
  return childProcess.spawnSync(process.execPath, [publicCli, ...args], {
    cwd: repo.root,
    env,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonLines(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

function countNpmCalls(logPath, command) {
  return readJsonLines(logPath).filter((entry) => entry.args[0] === command).length;
}

function createFakeTools(homeDir) {
  const binDir = path.join(homeDir, 'fake-bin');
  const npmPath = path.join(binDir, 'fake-npm.mjs');
  const cliPath = path.join(binDir, 'fake-agent-kernel.mjs');
  const npmLog = path.join(homeDir, 'fake-npm.jsonl');
  const cliLog = path.join(homeDir, 'fake-cli.jsonl');
  const installedVersionFile = path.join(homeDir, 'installed-version.txt');

  writeExecutable(npmPath, `#!/usr/bin/env node
import fs from 'node:fs';
const args = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_NPM_LOG, JSON.stringify({ args }) + '\\n');
if (args[0] === 'view') {
  if (process.env.FAKE_NPM_VIEW_FAIL === '1') {
    process.stderr.write(process.env.FAKE_NPM_ERROR_TEXT || 'registry unavailable');
    process.exit(17);
  }
  process.stdout.write(JSON.stringify(process.env.FAKE_NPM_VIEW_VERSION || '1.9.0'));
  process.exit(0);
}
if (args[0] === 'install') {
  if (process.env.FAKE_NPM_INSTALL_FAIL === '1') process.exit(23);
  const spec = args.find((arg) => arg.startsWith('@mamdouh-aboammar/agent-kernel@')) || '';
  const version = spec.slice('@mamdouh-aboammar/agent-kernel@'.length);
  fs.writeFileSync(process.env.FAKE_INSTALLED_VERSION_FILE, version + '\\n');
  process.stdout.write('installed ' + version);
  process.exit(0);
}
process.stderr.write('unexpected fake npm call: ' + args.join(' '));
process.exit(31);
`);

  writeExecutable(cliPath, `#!/usr/bin/env node
import fs from 'node:fs';
const args = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_CLI_LOG, JSON.stringify({ args }) + '\\n');
const installed = fs.existsSync(process.env.FAKE_INSTALLED_VERSION_FILE)
  ? fs.readFileSync(process.env.FAKE_INSTALLED_VERSION_FILE, 'utf8').trim()
  : '1.9.0';
if (args[0] === 'version') {
  if (process.env.FAKE_CLI_MISMATCH_TARGET && installed === process.env.FAKE_CLI_MISMATCH_TARGET) {
    process.stdout.write('0.0.0\\n');
  } else {
    process.stdout.write(installed + '\\n');
  }
  process.exit(0);
}
if (['doctor', 'compile', 'sync'].includes(args[0])) {
  process.stdout.write(args[0] + ': ok\\n');
  process.exit(0);
}
process.stderr.write('unexpected fake cli call: ' + args.join(' '));
process.exit(41);
`);

  fs.writeFileSync(installedVersionFile, '1.9.0\n');
  return { npmPath, cliPath, npmLog, cliLog, installedVersionFile };
}

export async function run() {
  const fixture = makeEnv();
  const tools = createFakeTools(fixture.homeDir);
  const fakeSecret = 'ghp_' + 'abcdefghijklmnopqrstuvwxyz123456';
  const baseEnv = {
    ...fixture.env,
    AGENT_KERNEL_NPM_BIN: tools.npmPath,
    AGENT_KERNEL_UPDATE_CLI_BIN: tools.cliPath,
    FAKE_NPM_LOG: tools.npmLog,
    FAKE_CLI_LOG: tools.cliLog,
    FAKE_INSTALLED_VERSION_FILE: tools.installedVersionFile,
    FAKE_NPM_VIEW_VERSION: '1.10.0'
  };

  runCli(baseEnv, 'init');

  const status = JSON.parse(runPublic(baseEnv, 'update', 'status', '--json'));
  assert.equal(status.mode, 'disabled');
  assert.equal(status.channel, 'latest');
  assert.deepEqual(status.trustedAgents, []);
  assert.equal(status.currentVersion, '1.9.0');

  const enableWithoutConfirmation = runPublicResult(baseEnv, 'update', 'enable', '--agents', 'claude,codex', '--json');
  assert.notEqual(enableWithoutConfirmation.status, 0);
  assert.match(enableWithoutConfirmation.stderr, /--yes|confirmation/i);

  const enabled = JSON.parse(runPublic(baseEnv, 'update', 'enable', '--agents', 'Claude,codex', '--yes', '--json'));
  assert.equal(enabled.mode, 'agent-approved');
  assert.deepEqual(enabled.trustedAgents, ['claude', 'codex']);

  const invalidChannel = runPublicResult(baseEnv, 'update', 'channel', 'latest;rm', '--yes', '--json');
  assert.notEqual(invalidChannel.status, 0);
  assert.match(invalidChannel.stderr, /invalid update channel/i);

  const channel = JSON.parse(runPublic(baseEnv, 'update', 'channel', 'next', '--yes', '--json'));
  assert.equal(channel.channel, 'next');
  const restoredChannel = JSON.parse(runPublic(baseEnv, 'update', 'channel', 'latest', '--yes', '--json'));
  assert.equal(restoredChannel.channel, 'latest');

  const trusted = JSON.parse(runPublic(baseEnv, 'update', 'trust', 'cursor', '--yes', '--json'));
  assert.deepEqual(trusted.trustedAgents, ['claude', 'codex', 'cursor']);
  const revoked = JSON.parse(runPublic(baseEnv, 'update', 'revoke', 'cursor', '--yes', '--json'));
  assert.deepEqual(revoked.trustedAgents, ['claude', 'codex']);

  const checked = JSON.parse(runPublic(baseEnv, 'update', 'check', '--json'));
  assert.equal(checked.updateAvailable, true);
  assert.equal(checked.targetVersion, '1.10.0');
  assert.equal(checked.channel, 'latest');
  assert.equal(countNpmCalls(tools.npmLog, 'view'), 1);

  const checkedFromCache = JSON.parse(runPublic(baseEnv, 'update', 'check', '--json'));
  assert.equal(checkedFromCache.cached, true);
  assert.equal(countNpmCalls(tools.npmLog, 'view'), 1);

  JSON.parse(runPublic(baseEnv, 'update', 'check', '--force', '--json'));
  assert.equal(countNpmCalls(tools.npmLog, 'view'), 2);

  const cachePath = path.join(fixture.kernelHome, 'runtime', 'update-status.json');
  const cached = readJson(cachePath);
  assert.equal(cached.schemaVersion, 1);
  assert.equal(cached.packageName, '@mamdouh-aboammar/agent-kernel');

  const registryFailure = runPublicResult({
    ...baseEnv,
    FAKE_NPM_VIEW_FAIL: '1',
    FAKE_NPM_ERROR_TEXT: `registry failed with ${fakeSecret}`
  }, 'update', 'check', '--force', '--json');
  assert.notEqual(registryFailure.status, 0);
  assert.match(registryFailure.stderr, /registry-unavailable/i);

  const untrusted = runPublicResult(baseEnv, 'update', 'apply', '--agent', 'cursor', '--json');
  assert.notEqual(untrusted.status, 0);
  assert.match(untrusted.stderr, /unauthorized-agent/i);
  assert.equal(countNpmCalls(tools.npmLog, 'install'), 0);

  const applied = JSON.parse(runPublic(baseEnv, 'update', 'apply', '--agent', 'claude', '--json'));
  assert.equal(applied.ok, true);
  assert.equal(applied.previousVersion, '1.9.0');
  assert.equal(applied.targetVersion, '1.10.0');
  assert.equal(applied.agent, 'claude');
  assert.equal(applied.rollbackAttempted, false);
  assert.equal(countNpmCalls(tools.npmLog, 'install'), 1);
  assert.ok(readJsonLines(tools.npmLog).some((entry) => entry.args.includes('@mamdouh-aboammar/agent-kernel@1.10.0')));

  fs.writeFileSync(tools.installedVersionFile, '1.9.0\n');
  const envIdentityApplied = JSON.parse(runPublic({ ...baseEnv, AGENT_KERNEL_AGENT_ID: 'codex' }, 'update', 'apply', '--json'));
  assert.equal(envIdentityApplied.ok, true);
  assert.equal(envIdentityApplied.agent, 'codex');

  fs.writeFileSync(tools.installedVersionFile, '1.9.0\n');
  JSON.parse(runPublic(baseEnv, 'update', 'channel', '1.11.0', '--yes', '--json'));
  JSON.parse(runPublic({ ...baseEnv, FAKE_NPM_VIEW_VERSION: '1.11.0' }, 'update', 'check', '--force', '--json'));
  const rollback = runPublicResult({
    ...baseEnv,
    FAKE_NPM_VIEW_VERSION: '1.11.0',
    FAKE_CLI_MISMATCH_TARGET: '1.11.0'
  }, 'update', 'apply', '--agent', 'claude', '--json');
  assert.notEqual(rollback.status, 0);
  const rollbackPayload = JSON.parse(rollback.stderr.trim());
  assert.equal(rollbackPayload.error, 'verification-failed');
  assert.equal(rollbackPayload.rollbackAttempted, true);
  assert.equal(rollbackPayload.rollbackSucceeded, true);
  assert.ok(readJsonLines(tools.npmLog).some((entry) => entry.args.includes('@mamdouh-aboammar/agent-kernel@1.9.0')));

  const auditPath = path.join(fixture.kernelHome, 'logs', 'updates.jsonl');
  const auditText = fs.readFileSync(auditPath, 'utf8');
  assert.ok(auditText.includes('registry-unavailable'));
  assert.ok(auditText.includes('unauthorized-agent'));
  assert.ok(!auditText.includes(fakeSecret));

  fs.writeFileSync(cachePath, JSON.stringify({
    schemaVersion: 1,
    packageName: '@mamdouh-aboammar/agent-kernel',
    currentVersion: '1.9.0',
    channel: 'latest',
    targetVersion: '1.12.0',
    updateAvailable: true,
    checkedAt: new Date().toISOString(),
    error: null
  }, null, 2) + '\n');
  runPublic(baseEnv, 'compile');
  const constitution = fs.readFileSync(path.join(fixture.kernelHome, 'dist', 'AGENTS.md'), 'utf8');
  assert.match(constitution, /Agent Kernel update available/);
  assert.match(constitution, /1\.9\.0.*1\.12\.0/s);
  assert.match(constitution, /agent-kernel update apply --agent <agent-id>/);

  const routedVersion = runPublicCapture(baseEnv, 'version');
  assert.equal(routedVersion.status, 0);
  assert.match(routedVersion.stderr, /Agent Kernel update available: 1\.9\.0 -> 1\.12\.0/);
  const npmCallsBeforeJson = readJsonLines(tools.npmLog).length;
  const routedJsonStatus = runPublicCapture(baseEnv, 'update', 'status', '--json');
  assert.equal(routedJsonStatus.status, 0);
  assert.equal(routedJsonStatus.stderr, '');
  assert.equal(readJsonLines(tools.npmLog).length, npmCallsBeforeJson);

  const disabled = JSON.parse(runPublic(baseEnv, 'update', 'disable', '--yes', '--json'));
  assert.equal(disabled.mode, 'disabled');
}
