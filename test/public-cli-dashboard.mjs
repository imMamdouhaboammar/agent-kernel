// test/public-cli-dashboard.mjs
//
// Invariants:
//   1. The dashboard is a self-contained read-only local HTML snapshot.
//   2. Human mode opens the generated file; JSON mode opens only with --open.
//   3. Known local stores render adaptively and empty sections stay hidden.
//   4. Pending records expose copy-only inbox, approval, rejection, and ID controls.
//   5. Secrets, unsafe IDs, absolute paths, symlinks, and browser errors fail safely.

import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { makeEnv, repo, runCli } from './_lib/helpers.mjs';

const publicCli = path.join(repo.root, 'bin', 'agent-kernel-router.mjs');
const NOW = '2026-07-14T10:00:00.000Z';

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
    return { status: error.status || 1, stdout: String(error.stdout || ''), stderr: String(error.stderr || '') };
  }
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

function snapshotFiles(filePaths) {
  return Object.fromEntries(filePaths.map((filePath) => [filePath, fs.readFileSync(filePath, 'utf8')]));
}

function assertUnchanged(before) {
  for (const [filePath, content] of Object.entries(before)) {
    if (fs.readFileSync(filePath, 'utf8') !== content) throw new Error(`dashboard changed source state: ${filePath}`);
  }
}

function seedState(isolated) {
  const secret = 'ghp_' + 'dashboardfixture1234567890123456';
  const pendingPath = path.join(isolated.kernelHome, 'inbox', 'pending', 'proposal_dashboard_pending.json');
  const unsafePath = path.join(isolated.kernelHome, 'inbox', 'pending', 'proposal_dashboard_unsafe.json');
  const approvedPath = path.join(isolated.kernelHome, 'inbox', 'approved', 'proposal_dashboard_approved.json');
  const rejectedPath = path.join(isolated.kernelHome, 'inbox', 'rejected', 'proposal_dashboard_rejected.json');
  writeJson(pendingPath, { id: 'proposal_dashboard_pending', type: 'rule', scope: 'global', level: 'standard', status: 'pending', text: `Review-first dashboard proposal ${secret}`, reason: 'A local agent proposed this memory.', targets: ['all'], tags: ['dashboard'], source: { proposedBy: 'codex' }, createdAt: NOW, updatedAt: NOW });
  writeJson(unsafePath, { id: '../../unsafe-dashboard-id', type: 'note', status: 'pending', text: 'Unsafe ID fixture.', createdAt: NOW });
  writeJson(approvedPath, { id: 'proposal_dashboard_approved', type: 'workflow', status: 'approved', text: 'Approved proposal history.', updatedAt: NOW });
  writeJson(rejectedPath, { id: 'proposal_dashboard_rejected', type: 'policy', status: 'rejected', text: 'Rejected proposal history.', updatedAt: NOW });

  const rulePath = path.join(isolated.kernelHome, 'source', 'memories', 'dashboard-rules.json');
  const skillPath = path.join(isolated.kernelHome, 'source', 'memories', 'dashboard-skills.json');
  const malformedPath = path.join(isolated.kernelHome, 'source', 'memories', 'dashboard-malformed.json');
  writeJson(rulePath, [{ id: 'memory_dashboard_rule', type: 'rule', scope: 'global', level: 'standard', status: 'approved', text: 'Keep approval user-owned.', targets: ['all'], tags: ['dashboard'], updatedAt: NOW }]);
  writeJson(skillPath, [{ id: 'memory_dashboard_skill', type: 'skill-trigger', scope: 'global', status: 'approved', text: 'Load local inspection context.', targets: ['codex'], tags: ['skill'], updatedAt: NOW }]);
  fs.writeFileSync(malformedPath, '{ malformed dashboard json\n');

  const policyPath = path.join(isolated.kernelHome, 'source', 'policies', 'policies.json');
  const episodePath = path.join(isolated.kernelHome, 'episodes', 'archive', 'episode_dashboard.json');
  const failurePath = path.join(isolated.kernelHome, 'source', 'failures', 'failure-lessons.json');
  const agentsPath = path.join(isolated.kernelHome, 'source', 'agents', 'agents.json');
  const projectsPath = path.join(isolated.kernelHome, 'source', 'projects', 'projects.json');
  const sessionPath = path.join(isolated.kernelHome, 'runtime', 'sessions', 'session_dashboard.json');
  const commitsPath = path.join(isolated.kernelHome, 'runtime', 'commits', 'index.json');
  writeJson(policyPath, [{ id: 'policy_dashboard', title: 'Review ownership', mode: 'review', status: 'active', updatedAt: NOW }]);
  writeJson(episodePath, { id: 'episode_dashboard', title: 'Dashboard session', summary: 'Static local inspection.', status: 'active', createdAt: NOW });
  writeJson(failurePath, [{ id: 'failure_dashboard', errorSignature: 'DASHBOARD_FIXTURE', rootCause: 'Fixture cause', fix: 'Render safely', status: 'active', occurrences: 2, updatedAt: NOW }]);
  writeJson(agentsPath, { version: 1, agents: [{ agentId: 'codex', trustLevel: 'propose-only', surface: 'cli', updatedAt: NOW }] });
  writeJson(projectsPath, { version: 1, projects: [{ projectId: 'dashboard-project', name: 'Dashboard Project', updatedAt: NOW }] });
  writeJson(sessionPath, { id: 'session_dashboard', agentId: 'codex', projectId: 'dashboard-project', status: 'completed', summary: 'Dashboard fixture session', startedAt: NOW, updatedAt: NOW });
  writeJson(commitsPath, { version: 1, commits: { deadbee: { sha: 'deadbeef1234567890', shortSha: 'deadbee', subject: 'dashboard fixture commit', sessions: ['session_dashboard'], timestamp: NOW } } });

  const configPath = path.join(isolated.kernelHome, 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  config.updates = { mode: 'agent-approved', channel: 'latest', trustedAgents: ['codex'], checkIntervalHours: 24 };
  writeJson(configPath, config);
  const updatePath = path.join(isolated.kernelHome, 'runtime', 'update-status.json');
  writeJson(updatePath, { schemaVersion: 1, packageName: '@mamdouh-aboammar/agent-kernel', currentVersion: '1.10.0', channel: 'latest', targetVersion: '1.11.0', updateAvailable: true, checkedAt: NOW, error: null });

  const auditPath = path.join(isolated.kernelHome, 'logs', 'audit.jsonl');
  fs.mkdirSync(path.dirname(auditPath), { recursive: true });
  fs.appendFileSync(auditPath, JSON.stringify({ timestamp: NOW, actor: 'user', operation: 'dashboard.fixture', targetType: 'memory', summary: 'Fixture audit event', metadata: { hidden: secret } }) + '\n');

  const projectPath = path.join(isolated.homeDir, 'dashboard-project');
  const architecture = path.join(projectPath, '.agent-kernel', 'architecture');
  writeJson(path.join(architecture, 'policy.json'), { version: 1, mode: 'review', sourceRoots: ['src'], layers: [{ name: 'cli', paths: ['bin/**'] }] });
  writeJson(path.join(architecture, 'map.json'), { version: 1, generatedAt: NOW, nodes: [{ id: 'bin/dashboard' }], edges: [] });
  writeJson(path.join(architecture, 'contract.json'), { version: 1, id: 'contract_dashboard', task: 'Build static dashboard', owner: 'cli', status: 'active', allowedFiles: ['bin/**'], requiredTests: ['test/public-cli-dashboard.mjs'] });
  writeJson(path.join(architecture, 'exceptions.json'), { version: 1, exceptions: [{ id: 'exception_dashboard', status: 'active', expiresAt: '2099-01-01T00:00:00.000Z' }] });
  writeJson(path.join(architecture, 'reports', 'latest.json'), { version: 1, generatedAt: NOW, ok: true, findings: [], summary: { blocking: 0, warning: 0 } });

  return { secret, projectPath, auditPath, sourceFiles: [pendingPath, unsafePath, approvedPath, rejectedPath, rulePath, skillPath, policyPath, episodePath, failurePath, agentsPath, projectsPath, sessionPath, commitsPath, configPath, updatePath] };
}

export async function run() {
  const isolated = makeEnv();
  runCli(isolated.env, 'init', '--sync');
  const fixture = seedState(isolated);
  const before = snapshotFiles(fixture.sourceFiles);
  const browser = fakeBrowser(isolated.homeDir);
  const env = { ...isolated.env, AGENT_KERNEL_BROWSER_BIN: process.execPath, AGENT_KERNEL_BROWSER_ARGS_JSON: JSON.stringify([browser.script]), AGENT_KERNEL_BROWSER_LOG: browser.log };

  const output = runPublic(env, 'dashboard', '--project', fixture.projectPath);
  const dashboardPath = path.join(isolated.kernelHome, 'reports', 'dashboard.html');
  if (!output.includes('Generated static dashboard:') || !fs.existsSync(dashboardPath)) throw new Error(`dashboard did not generate the default file: ${output}`);
  if (!fs.existsSync(browser.log)) throw new Error('human dashboard mode did not invoke the browser');
  const openedArgs = JSON.parse(fs.readFileSync(browser.log, 'utf8'));
  if (openedArgs.length !== 1 || openedArgs[0] !== dashboardPath) throw new Error(`browser received unexpected arguments: ${JSON.stringify(openedArgs)}`);

  const html = fs.readFileSync(dashboardPath, 'utf8');
  for (const required of ['Agent Kernel Memory Dashboard', 'Pending review', 'Approved proposals', 'Rejected proposals', 'Durable memories', 'Rules', 'Skill triggers', 'Policies', 'Episodes', 'Failure Lessons', 'Sessions', 'Agents', 'Projects', 'Commit links', 'Architecture Guardian', 'Update status', 'Retention', 'Audit summary', 'agent-kernel inbox', 'agent-kernel approve proposal_dashboard_pending --publish', 'agent-kernel reject proposal_dashboard_pending', 'Invalid action ID', 'navigator.clipboard', 'dashboard-search', 'Skipped malformed local records: 1']) {
    if (!html.includes(required)) throw new Error(`dashboard omitted required content: ${required}`);
  }
  if (html.includes(fixture.secret) || html.includes(isolated.kernelHome) || html.includes(fixture.projectPath)) throw new Error('dashboard leaked a secret or absolute local path');
  if (/https?:\/\//i.test(html) || /<script[^>]+src=/i.test(html) || /<link[^>]+href=/i.test(html) || /@import/i.test(html)) throw new Error('dashboard contains an external URL or asset');
  for (const forbidden of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'EventSource']) if (html.includes(forbidden)) throw new Error(`dashboard contains forbidden network primitive: ${forbidden}`);

  fs.rmSync(browser.log, { force: true });
  const jsonDefault = JSON.parse(runPublic(env, 'dashboard', '--project', fixture.projectPath, '--json'));
  if (!jsonDefault.ok || jsonDefault.path !== dashboardPath || jsonDefault.opened !== false || fs.existsSync(browser.log)) throw new Error(`dashboard JSON default was incorrect: ${JSON.stringify(jsonDefault)}`);

  const customPath = path.join(isolated.homeDir, 'custom-dashboard.html');
  const custom = JSON.parse(runPublic(env, 'dashboard', '--project', fixture.projectPath, '--out', customPath, '--no-open', '--json'));
  if (!custom.ok || custom.path !== customPath || custom.opened !== false || !fs.existsSync(customPath)) throw new Error(`dashboard custom output was incorrect: ${JSON.stringify(custom)}`);

  const explicitOpen = JSON.parse(runPublic(env, 'dashboard', '--project', fixture.projectPath, '--json', '--open'));
  if (!explicitOpen.opened || !fs.existsSync(browser.log)) throw new Error(`dashboard --json --open did not open: ${JSON.stringify(explicitOpen)}`);

  const conflict = runPublicFailure(env, 'dashboard', '--open', '--no-open');
  if (conflict.status === 0 || !conflict.stderr.includes('cannot be used together')) throw new Error(`dashboard accepted conflicting open flags: ${JSON.stringify(conflict)}`);

  const missingBrowser = JSON.parse(runPublic({ ...isolated.env, AGENT_KERNEL_BROWSER_BIN: path.join(isolated.homeDir, 'missing-browser') }, 'dashboard', '--project', fixture.projectPath, '--json', '--open'));
  if (!missingBrowser.ok || missingBrowser.opened !== false || missingBrowser.browserError !== 'browser-not-found' || !fs.existsSync(missingBrowser.path)) throw new Error(`browser failure did not preserve snapshot: ${JSON.stringify(missingBrowser)}`);

  const directoryPath = path.join(isolated.homeDir, 'dashboard-directory');
  fs.mkdirSync(directoryPath);
  const directoryFailure = runPublicFailure(isolated.env, 'dashboard', '--out', directoryPath, '--no-open');
  if (directoryFailure.status === 0 || !directoryFailure.stderr.includes('regular file')) throw new Error(`dashboard accepted a directory target: ${JSON.stringify(directoryFailure)}`);

  if (process.platform !== 'win32') {
    const protectedTarget = path.join(isolated.homeDir, 'protected-dashboard.html');
    fs.writeFileSync(protectedTarget, 'preserve target');
    const linkPath = path.join(isolated.homeDir, 'dashboard-link.html');
    fs.symlinkSync(protectedTarget, linkPath);
    const linkFailure = runPublicFailure(isolated.env, 'dashboard', '--out', linkPath, '--no-open');
    if (linkFailure.status === 0 || !linkFailure.stderr.includes('symbolic')) throw new Error(`dashboard accepted a symbolic target: ${JSON.stringify(linkFailure)}`);
    if (fs.readFileSync(protectedTarget, 'utf8') !== 'preserve target') throw new Error('dashboard modified a symlink target');
  }

  const minimal = makeEnv();
  runCli(minimal.env, 'init', '--sync');
  const minimalProject = path.join(minimal.homeDir, 'empty-dashboard-project');
  fs.mkdirSync(minimalProject, { recursive: true });
  const minimalResult = JSON.parse(runPublic(minimal.env, 'dashboard', '--project', minimalProject, '--no-open', '--json'));
  const minimalHtml = fs.readFileSync(minimalResult.path, 'utf8');
  for (const hidden of ['Rejected proposals', 'Architecture Guardian', 'Retention']) {
    if (minimalHtml.includes(hidden)) throw new Error(`dashboard rendered empty adaptive section: ${hidden}`);
  }

  assertUnchanged(before);
  const auditLines = fs.readFileSync(fixture.auditPath, 'utf8').split(/\r?\n/).filter(Boolean);
  const dashboardEvents = auditLines.filter((line) => line.includes('dashboard.generate'));
  if (dashboardEvents.length !== 5) throw new Error(`dashboard audit count was incorrect: ${dashboardEvents.length}`);
  if (dashboardEvents.some((line) => line.includes(fixture.secret))) throw new Error('dashboard-generated audit event leaked a secret');
}

export const name = 'public-cli-dashboard';
