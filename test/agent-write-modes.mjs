// test/agent-write-modes.mjs — Mode-aware agent write helper.
//
// Invariants:
//   1. approval mode writes a pending proposal
//   2. trusted mode auto-writes low-risk project notes
//   3. bypass mode auto-writes approved memory

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertContains, makeEnv, repo, runCli } from './_lib/helpers.mjs';

function runMode(env, ...args) {
  return execFileSync(process.execPath, [join(repo.root, 'bin', 'agent-kernel-mode.mjs'), ...args], {
    cwd: repo.root,
    env,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
}

function runAgentWrite(env, ...args) {
  return execFileSync(process.execPath, [join(repo.root, 'bin', 'agent-kernel-agent-write.mjs'), ...args], {
    cwd: repo.root,
    env: { ...env, AGENT_KERNEL_CLI: repo.cli },
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
}

export async function run() {
  const { env, kernelHome } = makeEnv();
  runCli(env, 'init', '--sync');

  runMode(env, 'set', 'approval');
  const approvalText = `approval mode should create proposal ${Date.now()}`;
  const approvalOut = runAgentWrite(env, '--from', 'codex', '--reason', 'approval test', '--text', approvalText);
  assertContains(approvalOut, 'Created pending memory proposal', 'approval mode should create a pending proposal');

  runMode(env, 'set', 'trusted');
  const trustedText = `trusted project note should auto-write ${Date.now()}`;
  runAgentWrite(env, '--from', 'cursor', '--type', 'project-note', '--scope', 'project', '--level', 'note', '--text', trustedText);
  const projectNotes = readFileSync(join(kernelHome, 'source', 'memories', 'project-notes.json'), 'utf8');
  assertContains(projectNotes, trustedText, 'trusted low-risk project note should be written to memory');

  runMode(env, 'set', 'bypass');
  const bypassText = `bypass mode should write approved memory ${Date.now()}`;
  runAgentWrite(env, '--from', 'opencode', '--type', 'rule', '--level', 'standard', '--text', bypassText);
  const rules = readFileSync(join(kernelHome, 'source', 'memories', 'rules.json'), 'utf8');
  assertContains(rules, bypassText, 'bypass mode should write directly to approved rules');
}

export const name = 'agent-write-modes';
