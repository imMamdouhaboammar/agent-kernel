// test/public-cli-dashboard.mjs
//
// Invariants:
//   1. The dashboard is a self-contained read-only local HTML snapshot.
//   2. Human mode opens the generated file; JSON mode does not unless requested.
//   3. Pending records expose copy-only inbox, approval, rejection, and ID controls.
//   4. Stored secrets and absolute local paths never enter the HTML.

import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { makeEnv, repo, runCli } from './_lib/helpers.mjs';

const publicCli = path.join(repo.root, 'bin', 'agent-kernel-router.mjs');

function runPublic(env, ...args) {
  return childProcess.execFileSync(process.execPath, [publicCli, ...args], {
    cwd: repo.root,
    env,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

function fakeBrowser(homeDir) {
  const script = path.join(homeDir, 'fake-browser.mjs');
  const log = path.join(homeDir, 'browser-open.json');
  fs.writeFileSync(script, `#!/usr/bin/env node\nimport fs from 'node:fs';\nfs.writeFileSync(process.env.AGENT_KERNEL_BROWSER_LOG, JSON.stringify(process.argv.slice(2)));\n`, { mode: 0o755 });
  return { script, log };
}

export async function run() {
  const isolated = makeEnv();
  runCli(isolated.env, 'init', '--sync');

  const secret = 'ghp_' + 'dashboardfixture1234567890123456';
  const pendingPath = path.join(isolated.kernelHome, 'inbox', 'pending', 'proposal_dashboard_pending.json');
  writeJson(pendingPath, {
    id: 'proposal_dashboard_pending',
    type: 'rule',
    scope: 'global',
    level: 'standard',
    status: 'pending',
    text: `Review-first dashboard proposal ${secret}`,
    reason: 'A local agent proposed this memory.',
    targets: ['all'],
    tags: ['dashboard'],
    source: { proposedBy: 'codex' },
    createdAt: '2026-07-14T10:00:00.000Z'
  });

  const rulePath = path.join(isolated.kernelHome, 'source', 'memories', 'dashboard-rules.json');
  writeJson(rulePath, [{
    id: 'memory_dashboard_rule',
    type: 'rule',
    scope: 'global',
    level: 'standard',
    status: 'approved',
    text: 'Keep approval user-owned.',
    targets: ['all'],
    tags: ['dashboard']
  }]);

  const sourceBefore = fs.readFileSync(pendingPath, 'utf8');
  const browser = fakeBrowser(isolated.homeDir);
  const env = {
    ...isolated.env,
    AGENT_KERNEL_BROWSER_BIN: process.execPath,
    AGENT_KERNEL_BROWSER_ARGS_JSON: JSON.stringify([browser.script]),
    AGENT_KERNEL_BROWSER_LOG: browser.log
  };

  const output = runPublic(env, 'dashboard');
  const dashboardPath = path.join(isolated.kernelHome, 'reports', 'dashboard.html');
  if (!output.includes('Generated static dashboard:') || !fs.existsSync(dashboardPath)) {
    throw new Error(`dashboard did not generate the default file: ${output}`);
  }
  if (!fs.existsSync(browser.log)) throw new Error('human dashboard mode did not invoke the browser');
  const openedArgs = JSON.parse(fs.readFileSync(browser.log, 'utf8'));
  if (openedArgs.length !== 1 || openedArgs[0] !== dashboardPath) {
    throw new Error(`browser received unexpected arguments: ${JSON.stringify(openedArgs)}`);
  }

  const html = fs.readFileSync(dashboardPath, 'utf8');
  for (const required of [
    'Agent Kernel Memory Dashboard',
    'Pending review',
    'Rules',
    'agent-kernel inbox',
    'agent-kernel approve proposal_dashboard_pending --publish',
    'agent-kernel reject proposal_dashboard_pending',
    'navigator.clipboard',
    'dashboard-search'
  ]) {
    if (!html.includes(required)) throw new Error(`dashboard omitted required content: ${required}`);
  }
  if (html.includes(secret) || html.includes(isolated.kernelHome)) {
    throw new Error('dashboard leaked a secret or the absolute Agent Kernel home');
  }
  if (/https?:\/\//i.test(html) || /<script[^>]+src=/i.test(html) || /<link[^>]+href=/i.test(html)) {
    throw new Error('dashboard contains an external URL or asset');
  }
  for (const forbidden of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'EventSource']) {
    if (html.includes(forbidden)) throw new Error(`dashboard contains forbidden network primitive: ${forbidden}`);
  }
  if (fs.readFileSync(pendingPath, 'utf8') !== sourceBefore) {
    throw new Error('dashboard changed a pending proposal');
  }

  fs.rmSync(browser.log, { force: true });
  const jsonResult = JSON.parse(runPublic(env, 'dashboard', '--json'));
  if (!jsonResult.ok || jsonResult.path !== dashboardPath || jsonResult.opened !== false) {
    throw new Error(`dashboard JSON result was incorrect: ${JSON.stringify(jsonResult)}`);
  }
  if (fs.existsSync(browser.log)) throw new Error('dashboard JSON mode opened the browser without --open');
}

export const name = 'public-cli-dashboard';
