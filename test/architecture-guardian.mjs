import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runArchitectureGuardianEvals } from './architecture-guardian-evals.mjs';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '..');
const cli = path.join(repoRoot, 'bin', 'agent-kernel-architecture.mjs');
const hook = path.join(repoRoot, 'bin', 'agent-kernel-architecture-hook.mjs');
function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'ag-test-')); }
function write(file, text) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); }
function json(file, value) { write(file, JSON.stringify(value, null, 2)); }
function runCommandRaw(project, ...args) {
  return childProcess.spawnSync(process.execPath, [cli, ...args], { cwd: project, encoding: 'utf8', stdio: ['ignore','pipe','pipe'] });
}
function runCommand(project, ...args) { return runCommandRaw(project, ...args, '--json'); }
function initGit(project) {
  childProcess.execFileSync('git', ['init'], { cwd: project, stdio: 'ignore' });
  childProcess.execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: project });
  childProcess.execFileSync('git', ['config', 'user.name', 'Test'], { cwd: project });
}
function commitAll(project, message = 'fixture') {
  childProcess.execFileSync('git', ['add', '.'], { cwd: project, stdio: 'ignore' });
  childProcess.execFileSync('git', ['commit', '-m', message], { cwd: project, stdio: 'ignore' });
}

export async function run() {
  {
    const project = tmp(); initGit(project);
    const result = runCommand(project, 'init', project);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(path.join(project, '.agent-kernel/architecture/policy.json')), true);
  }
  {
    const project = tmp(); initGit(project);
    const result = runCommandRaw(project, 'init', project);
    assert.equal(result.status, 0, result.stderr);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.created, true, 'structured commands should remain readable without --json');
  }
  {
    const project = tmp(); initGit(project);
    json(path.join(project, '.agent-kernel/architecture/policy.json'), { version: 1, mode: 42, confidenceThreshold: 0.8, blockOn: ['high'], layers: [], forbiddenDependencies: [] });
    const result = runCommand(project, 'policy', 'validate', project);
    assert.equal(result.status, 2, 'raw policy validation should reject invalid mode types');
    assert.equal(JSON.parse(result.stdout).ok, false);
  }
  {
    const project = tmp(); initGit(project);
    write(path.join(project, '.agent-kernel/architecture/policy.json'), '{ invalid');
    const check = runCommand(project, 'check', project);
    assert.equal(check.status, 1, 'checks must fail closed when policy JSON is malformed');
    assert.match(check.stderr, /Invalid JSON/);
    const doctor = runCommand(project, 'doctor', project);
    assert.equal(doctor.status, 2, 'doctor should report malformed policy JSON');
    const report = JSON.parse(doctor.stdout);
    assert.equal(report.checks.find((item) => item.id === 'policy-valid').ok, false);
  }
  {
    const project = tmp(); initGit(project);
    json(path.join(project, '.agent-kernel/architecture/policy.json'), { version: 1 });
    const show = runCommand(project, 'contract', 'show', project);
    assert.equal(show.status, 0, show.stderr);
    assert.equal(JSON.parse(show.stdout).status, 'draft', 'missing contracts should not appear active');
    const validate = runCommand(project, 'contract', 'validate', project);
    assert.equal(validate.status, 2, 'contract validation should fail when the file is missing');
  }
  {
    const project = tmp(); initGit(project);
    write(path.join(project, 'src/customer/validate-email.ts'), 'export function validateCustomerEmail() { return true }\n');
    json(path.join(project, '.agent-kernel/architecture/policy.json'), { version: 1 });
    const result = runCommand(project, 'reuse', 'validate email', project);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout)[0].symbol, 'validateCustomerEmail');
  }
  {
    const project = tmp(); initGit(project);
    write(path.join(project, 'src/value.ts'), 'export const value = 1;\n');
    commitAll(project);
    const init = runCommand(project, 'init', project);
    assert.equal(init.status, 0, init.stderr);
    json(path.join(project, '.agent-kernel/architecture/policy.json'), { version: 1, requireContractForWrites: true });
    json(path.join(project, '.agent-kernel/architecture/change-contract.json'), { version: 1, status: 'active', task: 'no source change', owner: 'team', allowedFiles: ['src/**'], forbiddenFiles: [], expectedFiles: [], allowedNewDependencies: [], requiredTests: [], notes: [] });
    const check = runCommand(project, 'check', project, '--strict');
    assert.equal(check.status, 0, check.stderr);
    assert.equal(JSON.parse(check.stdout).summary.changedFiles, 0, 'local architecture state must not count as application scope drift');
  }
  {
    const project = tmp(); initGit(project);
    write(path.join(project, 'src/allowed.ts'), 'export const ok = true;\n');
    json(path.join(project, '.agent-kernel/architecture/policy.json'), { version: 1, blockOn: ['high'], requireContractForWrites: true });
    json(path.join(project, '.agent-kernel/architecture/change-contract.json'), { version: 1, status: 'active', task: 'test', owner: 'team', allowedFiles: ['src/allowed.ts'], forbiddenFiles: [], expectedFiles: [], allowedNewDependencies: [], requiredTests: [], notes: [] });
    const payload = { hook_event_name: 'PreToolUse', tool_name: 'Write', cwd: project, tool_input: { file_path: path.join(project, 'src/outside.ts') } };
    const result = childProcess.spawnSync(process.execPath, [hook], {
      cwd: project,
      env: { ...process.env, AGENT_KERNEL_ARCHITECTURE_MODE: 'strict' },
      input: JSON.stringify(payload),
      encoding: 'utf8',
      stdio: ['pipe','pipe','pipe']
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision, 'deny');
  }
  await runArchitectureGuardianEvals();
}

export const name = 'architecture-guardian';
