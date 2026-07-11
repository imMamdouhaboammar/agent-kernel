import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '..');
const cli = path.join(repoRoot, 'bin', 'agent-kernel-architecture.mjs');
const hook = path.join(repoRoot, 'bin', 'agent-kernel-architecture-hook.mjs');
const fixtures = path.join(testDir, 'fixtures', 'architecture-guardian');
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); }
function writeFiles(project, files = {}) {
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(project, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
}
function run(project, args, input = null, env = {}) {
  return childProcess.spawnSync(process.execPath, args, {
    cwd: project,
    env: { ...process.env, ...env },
    input,
    encoding: 'utf8',
    stdio: ['pipe','pipe','pipe']
  });
}
function typeSet(items) { return [...new Set((items || []).map((item) => item.type))].sort(); }

export async function runArchitectureGuardianEvals() {
  const scenarioIds = fs.readdirSync(fixtures).sort();
  for (const id of scenarioIds) {
    const source = path.join(fixtures, id);
    const scenario = JSON.parse(fs.readFileSync(path.join(source, 'scenario.json'), 'utf8'));
    const expected = JSON.parse(fs.readFileSync(path.join(source, 'expected.json'), 'utf8'));
    const project = fs.mkdtempSync(path.join(os.tmpdir(), `ag-eval-${id}-`));
    writeFiles(project, scenario.files);
    childProcess.execFileSync('git', ['init'], { cwd: project, stdio: 'ignore' });
    writeJson(path.join(project, '.agent-kernel/architecture/policy.json'), scenario.policy);
    if (scenario.contract) writeJson(path.join(project, '.agent-kernel/architecture/change-contract.json'), scenario.contract);
    if (scenario.exceptions) writeJson(path.join(project, '.agent-kernel/architecture/exceptions.json'), scenario.exceptions);
    if (scenario.baselineBeforeCheck) {
      const baseline = run(project, [cli, 'baseline', project, '--json']);
      assert.equal(baseline.status, 0, `${id}: baseline failed\n${baseline.stderr}`);
      writeFiles(project, scenario.mutationsAfterBaseline);
    }
    let result;
    if (scenario.mode === 'reuse') result = run(project, [cli, 'reuse', scenario.query, project, '--json']);
    else if (scenario.mode === 'hook') {
      const payload = { hook_event_name: 'PreToolUse', tool_name: 'Write', cwd: project, tool_input: { file_path: path.join(project, scenario.hookFile) } };
      const hookMode = expected.decision === 'deny' ? 'strict' : 'review';
      result = run(project, [hook], JSON.stringify(payload), { AGENT_KERNEL_ARCHITECTURE_MODE: hookMode });
    } else {
      const args = [cli, 'check', project, '--files', (scenario.changedFiles || []).join(','), '--json'];
      if (expected.exit === 2) args.push('--strict');
      result = run(project, args);
    }
    assert.equal(result.status, expected.exit, `${id}: unexpected exit\nstdout=${result.stdout}\nstderr=${result.stderr}`);
    const parsed = JSON.parse(result.stdout || '{}');
    if (scenario.mode === 'reuse') {
      if (expected.empty) assert.equal(parsed.length, 0, `${id}: expected no reuse candidates`);
      if (expected.firstSymbol) assert.equal(parsed[0]?.symbol, expected.firstSymbol, `${id}: wrong reuse candidate`);
    } else if (scenario.mode === 'hook') {
      assert.equal(parsed.hookSpecificOutput?.permissionDecision || null, expected.decision, `${id}: wrong hook decision`);
    } else {
      assert.equal(parsed.status, expected.status, `${id}: wrong report status`);
      assert.deepEqual(typeSet(parsed.newFindings), [...(expected.newTypes || [])].sort(), `${id}: wrong new finding types`);
      if (expected.preExistingTypes) assert.deepEqual(typeSet(parsed.preExistingFindings), [...expected.preExistingTypes].sort(), `${id}: wrong pre-existing types`);
      if (expected.suppressedTypes) assert.deepEqual(typeSet(parsed.suppressed), [...expected.suppressedTypes].sort(), `${id}: wrong suppressed types`);
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await runArchitectureGuardianEvals();
  console.log('architecture-guardian evals: OK');
}
