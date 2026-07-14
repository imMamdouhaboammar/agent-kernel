// test/public-cli-dashboard.mjs
//
// Invariants:
//   1. The dashboard is a self-contained, read-only local HTML snapshot.
//   2. Human mode opens the generated file; JSON mode opens only with --open.
//   3. Every rendered value is sanitized and adaptive sections omit empty stores.
//   4. Pending records expose copy-only inbox, approve/publish, reject, and ID commands.
//   5. Unsafe output targets fail before writes and browser failures preserve the snapshot.

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

function runPublicFailure(env, ...args) {
  try {
    runPublic(env, ...args);
    return { status: 0, stdout: '', stderr: '' };
  } catch (error) {
    return {
      status: error.status || 1,
      stdout: String(error.stdout || ''),
      stderr: String(error.stderr || '')
    };
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

function createFakeBrowser(homeDir) {
  const browserScript = path.join(homeDir, 'fake-browser.mjs');
  const logPath = path.join(homeDir, 'browser-open.json');
  fs.writeFileSync(browserScript, `#!/usr/bin/env node\nimport fs from 'node:fs';\nfs.writeFileSync(process.env.AGENT_KERNEL_BROWSER_LOG, JSON.stringify(process.argv.slice(2)));\n`, { mode: 0o755 });
  return { browserScript, logPath };
}

function snapshotFiles(files) {
  return Object.fromEntries(files.map((filePath) => [filePath, fs.readFileSync(filePath, 'utf8')]));
}

function assertUnchanged(before) {
  for (const [filePath, content] of Object.entries(before)) {
    if (fs.readFileSync(filePath, 'utf8') !== content) {
      throw new Error(`dashboard changed read-only source file: ${filePath}`);
    }
  }
}

function seedDashboardState(env) {
  const now = '2026-07-14T10:00:00.000Z';
  const fakeSecret = 'ghp_' + 'dashboardsecretvalue1234567890';
  const pendingDir = path.join(env.kernelHome, 'inbox', 'pending');
  const approvedDir = path.join(env.kernelHome, 'inbox', 'approved');
  const rejectedDir = path.join(env.kernelHome, 'inbox', 'rejected');
  const pendingPath = path.join(pendingDir, 'proposal_dashboard_pending.json');
  const unsafePendingPath = path.join(pendingDir, 'proposal_dashboard_unsafe.json');
  const approvedPath = path.join(approvedDir, 'proposal_dashboard_approved.json');
  const rejectedPath = path.join(rejectedDir, 'proposal_dashboard_rejected.json');

  writeJson(pendingPath, {
    id: 'proposal_dashboard_pending',
    type: 'rule',
    scope: 'global',
    level: 'standard',
    status: 'pending',
    text: `Review dashboard rule without leaking ${fakeSecret}`,
    reason: 'Captured by a trusted local proposal path.',
    targets: ['all'],
    tags: ['dashboard', 'review'],
    source: { proposedBy: 'codex' },
    createdAt: now,
    updatedAt: now
  });
  writeJson(unsafePendingPath, {
    id: '../../unsafe-dashboard-id',
    type: 'note',
    status: 'pending',
    text: 'Unsafe IDs must never receive action commands.',
    createdAt: now
  });
  writeJson(approvedPath, {
    id: 'proposal_dashboard_approved',
    type: 'workflow',
    status: 'approved',
    text: 'Approved proposal history remains visible.',
    updatedAt: now
  });
  writeJson(rejectedPath, {
    id: 'proposal_dashboard_rejected',
    type: 'policy',
    status: 'rejected',
    text: 'Rejected proposal history remains visible.',
    updatedAt: now
  });

  const rulesPath = path.join(env.kernelHome, 'source', 'memories', 'dashboard-rules.json');
  const skillsPath = path.join(env.kernelHome, 'source', 'memories', 'dashboard-skills.json');
  const malformedPath = path.join(env.kernelHome, 'source', 'memories', 'dashboard-malformed.json');
  writeJson(rulesPath, [{
    id: 'memory_dashboard_rule',
    type: 'rule',
    status: 'approved',
    scope: 'global',
    text: 'Use review-first memory governance.',
    targets: ['all'],
    tags: ['dashboard'],
    updatedAt: now
  }]);
  writeJson(skillsPath, [{
    id: 'memory_dashboard_skill',
    type: 'skill-trigger',
    status: 'approved',
    scope: 'global',
    text: 'Load the dashboard skill for local inspection.',
    targets: ['codex'],
    tags: ['skill'],
    updatedAt: now
  }]);
  fs.writeFileSync(malformedPath, '{ malformed dashboard json\n');

  const policiesPath = path.join(env.kernelHome, 'source', 'policies', 'policies.json');
  writeJson(policiesPath, [{ id: 'policy_dashboard', title: 'Review ownership', mode: 'review', status: 'active', updatedAt: now }]);

  const episodePath = path.join(env.kernelHome, 'episodes', 'archive', 'episode_dashboard.json');
  writeJson(episodePath, { id: 'episode_dashboard', title: 'Dashboard design session', summary: 'A static read-only inspection workflow.', status: 'active', createdAt: now });

  const failuresPath = path.join(env.kernelHome, 'source', 'failures', 'failure-lessons.json');
  writeJson(failuresPath, [{ id: 'failure_dashboard', errorSignature: 'DASHBOARD_FIXTURE', rootCause: 'Fixture', fix: 'Render safely', status: 'active', occurrences: 2, updatedAt: now }]);

  const agentsPath = path.join(env.kernelHome, 'source', 'agents', 'agents.json');
  writeJson(agentsPath, { version: 1, agents: [{ agentId: 'codex', trustLevel: 'propose-only', surface: 'cli', updatedAt: now }] });
  const projectsPath = path.join(env.kernelHome, 'source', 'projects', 'projects.json');
  writeJson(projectsPath, { version: 1, projects: [{ projectId: 'dashboard-project', name: 'Dashboard Project', updatedAt: now }] });

  const sessionsPath = path.join(env.kernelHome, 'runtime', 'sessions', 'session_dashboard.json');
  writeJson(sessionsPath, { id: 'session_dashboard', agentId: 'codex', projectId: 'dashboard-project', status: 'completed', summary: 'Dashboard fixture session', startedAt: now, updatedAt: now });

  const commitsPath = path.join(env.kernelHome, 'runtime', 'commits', 'index.json');
  writeJson(commitsPath, { version: 1, commits: { deadbee: { sha: 'deadbeef1234567890', shortSha: 'deadbee', subject: 'dashboard fixture commit', sessions: ['session_dashboard'], timestamp: now } } });

  const configPath = path.join(env.kernelHome, 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  config.updates = { mode: 'agent-approved', channel: 'latest', trustedAgents: ['codex'], checkIntervalHours: 24 };
  writeJson(configPath, config);
  writeJson(path.join(env.kernelHome, 'runtime', 'update-status.json'), {
    schemaVersion: 1,
    packageName: '@mamdouh-aboammar/agent-kernel',
    currentVersion: '1.10.0',
    channel: 'latest',
    targetVersion: '1.11.0',
    updateAvailable: true,
    checkedAt: now,
    error: null
  });

  fs.mkdirSync(path.join(env.kernelHome, 'logs'), { recursive: true });
  fs.appendFileSync(path.join(env.kernelHome, 'logs', 'audit.jsonl'), JSON.stringify({ timestamp: now, actor: 'user', operation: 'dashboard.fixture', targetType: 'memory', summary: 'Fixture audit event', metadata: { hidden: fakeSecret } }) + '\n');

  const projectPath = path.join(env.homeDir, 'dashboard-project');
  const architectureDir = path.join(projectPath, '.agent-kernel', 'architecture');
  fs.mkdirSync(architectureDir, { recursive: true });
  writeJson(path.join(architectureDir, 'policy.json'), { version: 1, mode: 'review', sourceRoots: ['src'], layers: [{ name: 'cli', paths: ['bin/**'] }] });
  writeJson(path.join(architectureDir, 'map.json'), { version: 1, generatedAt: now, nodes: [{ id: 'bin/dashboard' }], edges: [] });
  writeJson(path.join(architectureDir, 'contract.json'), { version: 1, id: 'contract_dashboard', task: 'Build static dashboard', owner: 'cli', status: 'active', allowedFiles: ['bin/**'], requiredTests: ['test/public-cli-dashboard.mjs'] });
  writeJson(path.join(architectureDir, 'exceptions.json'), { version: 1, exceptions: [{ id: 'exception_dashboard', status: 'active', expiresAt: '2099-01-01T00:00:00.000Z' }] });
  writeJson(path.join(architectureDir, 'reports', 'latest.json'), { version: 1, generatedAt: now, ok: true, findings: [], summary: { blocking: 0, warning: 0 } });

  return {
    fakeSecret,
    projectPath,
    readOnlyFiles: [pendingPath, unsafePendingPath, approvedPath, rejectedPath, rulesPath, skillsPath, policiesPath, episodePath, failuresPath, agentsPath, projectsPath, sessionsPath, commitsPath, configPath]
  };
}

export async function run() {
  const env = makeEnv();
  runCli(env.env, 'init', '--sync');
  const fixture = seedDashboardState(env);
  const readOnlyBefore = snapshotFiles(fixture.readOnlyFiles);
  const browser = createFakeBrowser(env.homeDir);
  const browserEnv = {
    ...env.env,
    AGENT_KERNEL_BROWSER_BIN: process.execPath,
    AGENT_KERNEL_BROWSER_ARGS_JSON: JSON.stringify([browser.browserScript]),
    AGENT_KERNEL_BROWSER_LOG: browser.logPath
  };

  const humanOutput = runPublic(browserEnv, 'dashboard', '--project', fixture.projectPath);
  const defaultPath = path.join(env.kernelHome, 'reports', 'dashboard.html');
  if (!humanOutput.includes('Generated static dashboard:') || !fs.existsSync(defaultPath)) {
    throw new Error(`dashboard did not generate the default HTML file: ${humanOutput}`);
  }
  if (!fs.existsSync(browser.logPath)) throw new Error('human dashboard mode did not invoke the browser opener');
  const browserArgs = JSON.parse(fs.readFileSync(browser.logPath, 'utf8'));
  if (browserArgs.length !== 1 || browserArgs[0] !== defaultPath) {
    throw new Error(`browser opener received unexpected arguments: ${JSON.stringify(browserArgs)}`);
  }

  const html = fs.readFileSync(defaultPath, 'utf8');
  for (const label of ['Agent Kernel Memory Dashboard', 'Pending review', 'Approved proposals', 'Rejected proposals', 'Durable memories', 'Rules', 'Skill triggers', 'Policies', 'Episodes', 'Failure Lessons', 'Sessions', 'Agents', 'Projects', 'Commit links', 'Architecture Guardian', 'Update status', 'Retention', 'Audit summary']) {
    if (!html.includes(label)) throw new Error(`dashboard omitted adaptive section: ${label}`);
  }
  for (const command of ['agent-kernel inbox', 'agent-kernel approve proposal_dashboard_pending --publish', 'agent-kernel reject proposal_dashboard_pending']) {
    if (!html.includes(command)) throw new Error(`dashboard omitted copy command: ${command}`);
  }
  if (!html.includes('proposal_dashboard_pending') || !html.includes('Invalid action ID')) {
    throw new Error('dashboard did not expose safe IDs and suppress unsafe action IDs');
  }
  if (html.includes(fixture.fakeSecret) || html.includes(env.kernelHome) || html.includes(fixture.projectPath)) {
    throw new Error('dashboard leaked a secret or absolute local path');
  }
  if (/https?:\/\//i.test(html) || /<script[^>]+src=/i.test(html) || /<link[^>]+href=/i.test(html) || /@import/i.test(html)) {
    throw new Error('dashboard contains an external URL or asset');
  }
  if (!html.includes('navigator.clipboard') || !html.includes('data-copy') || !html.includes('dashboard-search')) {
    throw new Error('dashboard omitted copy-only and filtering interactions');
  }
  for (const forbidden of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'EventSource']) {
    if (html.includes(forbidden)) throw new Error(`dashboard inline script contains forbidden network primitive: ${forbidden}`);
  }
  if (!html.includes('Skipped malformed local records: 1')) {
    throw new Error('dashboard did not report malformed optional JSON records');
  }

  const customPath = path.join(env.homeDir, 'custom-dashboard.html');
  fs.rmSync(browser.logPath, { force: true });
  const generatedOnly = JSON.parse(runPublic(browserEnv, 'dashboard', '--out', customPath, '--project', fixture.projectPath, '--no-open', '--json'));
  if (!generatedOnly.ok || generatedOnly.path !== customPath || generatedOnly.opened !== false || !fs.existsSync(customPath)) {
    throw new Error(`dashboard --no-open JSON result was incorrect: ${JSON.stringify(generatedOnly)}`);
  }
  if (fs.existsSync(browser.logPath)) throw new Error('dashboard --no-open invoked the browser');

  const jsonDefault = JSON.parse(runPublic(browserEnv, 'dashboard', '--project', fixture.projectPath, '--json'));
  if (jsonDefault.opened !== false || fs.existsSync(browser.logPath)) throw new Error('dashboard --json opened the browser without --open');

  const jsonOpen = JSON.parse(runPublic(browserEnv, 'dashboard', '--project', fixture.projectPath, '--json', '--open'));
  if (jsonOpen.opened !== true || !fs.existsSync(browser.logPath)) throw new Error(`dashboard --json --open did not open: ${JSON.stringify(jsonOpen)}`);

  const conflict = runPublicFailure(env.env, 'dashboard', '--open', '--no-open');
  if (conflict.status === 0 || !conflict.stderr.includes('cannot be used together')) {
    throw new Error(`dashboard accepted conflicting open flags: ${JSON.stringify(conflict)}`);
  }

  const missingBrowserEnv = {
    ...env.env,
    AGENT_KERNEL_BROWSER_BIN: path.join(env.homeDir, 'missing-browser')
  };
  const browserFailure = JSON.parse(runPublic(missingBrowserEnv, 'dashboard', '--project', fixture.projectPath, '--json', '--open'));
  if (!browserFailure.ok || browserFailure.opened !== false || !browserFailure.browserError || !fs.existsSync(browserFailure.path)) {
    throw new Error(`browser failure did not preserve the generated snapshot: ${JSON.stringify(browserFailure)}`);
  }

  const directoryTarget = path.join(env.homeDir, 'dashboard-directory');
  fs.mkdirSync(directoryTarget);
  const directoryFailure = runPublicFailure(env.env, 'dashboard', '--out', directoryTarget, '--no-open');
  if (directoryFailure.status === 0 || !directoryFailure.stderr.includes('regular file')) {
    throw new Error(`dashboard accepted a directory output target: ${JSON.stringify(directoryFailure)}`);
  }

  if (process.platform !== 'win32') {
    const protectedTarget = path.join(env.homeDir, 'protected-dashboard.html');
    fs.writeFileSync(protectedTarget, 'preserve target');
    const symlinkPath = path.join(env.homeDir, 'dashboard-link.html');
    fs.symlinkSync(protectedTarget, symlinkPath);
    const symlinkFailure = runPublicFailure(env.env, 'dashboard', '--out', symlinkPath, '--no-open');
    if (symlinkFailure.status === 0 || !symlinkFailure.stderr.includes('symbolic')) {
      throw new Error(`dashboard accepted a symbolic output target: ${JSON.stringify(symlinkFailure)}`);
    }
    if (fs.readFileSync(protectedTarget, 'utf8') !== 'preserve target') throw new Error('dashboard modified a symlink target');
  }

  const minimal = makeEnv();
  runCli(minimal.env, 'init', '--sync');
  const minimalResult = JSON.parse(runPublic(minimal.env, 'dashboard', '--no-open', '--json'));
  const minimalHtml = fs.readFileSync(minimalResult.path, 'utf8');
  if (minimalHtml.includes('Rejected proposals') || minimalHtml.includes('Architecture Guardian')) {
    throw new Error('dashboard rendered empty adaptive sections');
  }

  assertUnchanged(readOnlyBefore);
  const auditText = fs.readFileSync(path.join(env.kernelHome, 'logs', 'audit.jsonl'), 'utf8');
  const generatedEvents = auditText.split(/\r?\n/).filter((line) => line.includes('dashboard.generate'));
  if (generatedEvents.length !== 5) {
    throw new Error(`dashboard audit count was incorrect: ${generatedEvents.length}`);
  }
  if (auditText.includes(fixture.fakeSecret)) throw new Error('dashboard audit leaked a secret');
}

export const name = 'public-cli-dashboard';
