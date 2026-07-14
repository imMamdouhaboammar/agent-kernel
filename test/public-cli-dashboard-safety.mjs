// test/public-cli-dashboard-safety.mjs
//
// Security and failure-containment regression coverage for the static dashboard.

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

function failure(env, ...args) {
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

export async function run() {
  const isolated = makeEnv();
  runCli(isolated.env, 'init', '--sync');
  writeJson(path.join(isolated.kernelHome, 'inbox', 'pending', 'proposal_dashboard_html.json'), {
    id: 'proposal_dashboard_html',
    type: 'rule',
    status: 'pending',
    text: '<script>globalThis.dashboardInjected = true</script>',
    reason: 'HTML must render as text, not markup.'
  });

  const safe = JSON.parse(runPublic(isolated.env, 'dashboard', '--no-open=true', '--json=true'));
  const html = fs.readFileSync(safe.path, 'utf8');
  if (!html.includes('&lt;script&gt;globalThis.dashboardInjected = true&lt;/script&gt;')) {
    throw new Error('dashboard did not escape stored HTML content');
  }
  if (html.includes('<script>globalThis.dashboardInjected')) throw new Error('dashboard rendered stored HTML as executable markup');
  if (!html.includes('Content-Security-Policy') || !html.includes("default-src 'none'")) {
    throw new Error('dashboard omitted the restrictive content security policy');
  }

  const unknownJson = failure(isolated.env, 'dashboard', '--json', '--unknown-dashboard-flag');
  if (unknownJson.status === 0) throw new Error('dashboard accepted an unknown flag');
  let jsonError;
  try {
    jsonError = JSON.parse(unknownJson.stdout);
  } catch {
    throw new Error(`dashboard JSON error was not emitted on stdout: ${JSON.stringify(unknownJson)}`);
  }
  if (jsonError.ok !== false || jsonError.error !== 'invalid-arguments') {
    throw new Error(`dashboard JSON error envelope was incorrect: ${JSON.stringify(jsonError)}`);
  }

  const missingProject = failure(isolated.env, 'dashboard', '--project', path.join(isolated.homeDir, 'missing-project'), '--no-open');
  if (missingProject.status === 0 || !missingProject.stderr.includes('does not exist')) {
    throw new Error(`dashboard accepted a missing project: ${JSON.stringify(missingProject)}`);
  }

  const invalidBrowserPath = path.join(isolated.homeDir, 'invalid-browser-dashboard.html');
  const invalidBrowser = failure({
    ...isolated.env,
    AGENT_KERNEL_BROWSER_BIN: process.execPath,
    AGENT_KERNEL_BROWSER_ARGS_JSON: '{ invalid json'
  }, 'dashboard', '--out', invalidBrowserPath, '--json', '--open');
  if (invalidBrowser.status === 0 || fs.existsSync(invalidBrowserPath)) {
    throw new Error(`invalid browser configuration caused output side effects: ${JSON.stringify(invalidBrowser)}`);
  }

  const configPath = path.join(isolated.kernelHome, 'config.json');
  fs.writeFileSync(configPath, '{ malformed config\n');
  const malformedConfig = JSON.parse(runPublic(isolated.env, 'dashboard', '--no-open', '--json'));
  const malformedHtml = fs.readFileSync(malformedConfig.path, 'utf8');
  if (!malformedHtml.includes('Skipped malformed local records: 1') || !malformedHtml.includes('Pending review')) {
    throw new Error('malformed config blocked unrelated dashboard stores');
  }
  if (fs.readFileSync(configPath, 'utf8') !== '{ malformed config\n') throw new Error('dashboard replaced malformed configuration');

  if (process.platform !== 'win32') {
    const realParent = path.join(isolated.homeDir, 'real-dashboard-parent');
    const linkedParent = path.join(isolated.homeDir, 'linked-dashboard-parent');
    fs.mkdirSync(realParent);
    fs.symlinkSync(realParent, linkedParent, 'dir');
    const linkedOutput = path.join(linkedParent, 'dashboard.html');
    const linkedFailure = failure(isolated.env, 'dashboard', '--out', linkedOutput, '--no-open');
    if (linkedFailure.status === 0 || !linkedFailure.stderr.includes('parent cannot be symbolic') || fs.existsSync(path.join(realParent, 'dashboard.html'))) {
      throw new Error(`dashboard accepted a symbolic parent: ${JSON.stringify(linkedFailure)}`);
    }
  }
}

export const name = 'public-cli-dashboard-safety';
