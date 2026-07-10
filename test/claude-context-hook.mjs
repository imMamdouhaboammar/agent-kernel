// test/claude-context-hook.mjs — Claude PreToolUse context and PostToolUseFailure capture.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeEnv, repo, runCli } from './_lib/helpers.mjs';

const hookPath = join(repo.root, 'bin', 'agent-kernel-claude-context-hook.mjs');

function runHook(env, event, payload) {
  return execFileSync(process.execPath, [hookPath, event], {
    cwd: repo.root,
    env,
    input: JSON.stringify(payload),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
}

export async function run() {
  const { env, kernelHome } = makeEnv();
  runCli(env, 'init', '--sync');

  const notesPath = join(kernelHome, 'source', 'memories', 'project-notes.json');
  writeFileSync(notesPath, JSON.stringify([
    {
      id: 'hook_file_context_rule',
      type: 'project-note',
      scope: 'project',
      level: 'standard',
      text: 'Run the focused CLI smoke test before editing src/cli.mjs.',
      files: ['src/cli.mjs'],
      targets: ['all'],
      tags: ['cli', 'testing'],
      status: 'approved',
      source: { createdBy: 'test', channel: 'fixture' },
      createdAt: '2026-07-10T10:00:00.000Z',
      updatedAt: '2026-07-10T10:00:00.000Z',
      version: 1
    }
  ], null, 2) + '\n');

  const pre = JSON.parse(runHook(env, 'PreToolUse', {
    hook_event_name: 'PreToolUse',
    tool_name: 'Edit',
    cwd: repo.root,
    tool_input: { file_path: 'src/cli.mjs' }
  }));
  const context = pre.hookSpecificOutput?.additionalContext || '';
  if (!context.includes('Run the focused CLI smoke test')) {
    throw new Error(`PreToolUse did not inject file context: ${JSON.stringify(pre)}`);
  }
  if (context.length > 1800) {
    throw new Error(`PreToolUse context exceeded compact limit: ${context.length}`);
  }

  const fakeSecret = 'sk-' + 'abcdefghijklmnopqrstuvwxyz1234567890';
  const post = JSON.parse(runHook(env, 'PostToolUseFailure', {
    hook_event_name: 'PostToolUseFailure',
    tool_name: 'Bash',
    cwd: repo.root,
    tool_input: { command: 'npm test', files: ['src/cli.mjs'] },
    tool_response: { stderr: `Test failed with OPENAI_API_KEY='${fakeSecret}'` }
  }));
  if (!String(post.hookSpecificOutput?.additionalContext || '').includes('unapproved Failure Lesson')) {
    throw new Error(`PostToolUseFailure did not confirm local capture: ${JSON.stringify(post)}`);
  }

  const failuresPath = join(kernelHome, 'source', 'failures', 'failure-lessons.json');
  if (!existsSync(failuresPath)) throw new Error('failure hook did not create failure-lessons.json');
  const persisted = readFileSync(failuresPath, 'utf8');
  if (persisted.includes(fakeSecret) || persisted.includes('OPENAI_API_KEY=')) {
    throw new Error('failure hook persisted a raw secret');
  }
  if (!persisted.includes('[REDACTED_SECRET]')) {
    throw new Error('failure hook did not persist the redaction marker');
  }
  const failures = JSON.parse(persisted);
  if (!failures.some((item) => item.agent === 'claude-hook' && item.evidence?.command === 'npm test')) {
    throw new Error(`failure evidence was incomplete: ${persisted}`);
  }

  const pendingDir = join(kernelHome, 'inbox', 'pending');
  mkdirSync(pendingDir, { recursive: true });
  const pending = readdirSync(pendingDir).filter((name) => name.endsWith('.json'));
  if (pending.length !== 0) {
    throw new Error(`hook created pending memory unexpectedly: ${pending.join(', ')}`);
  }
}

export const name = 'claude-context-hook';
