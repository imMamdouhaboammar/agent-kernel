// test/contextfs-global-consistency.mjs — Regressions for global ContextFS scope separation.

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeEnv, repo, runCli } from './_lib/helpers.mjs';

const routerCli = join(repo.root, 'bin', 'agent-kernel-router.mjs');

function runRouter(env, ...args) {
  return execFileSync(process.execPath, [routerCli, ...args], {
    cwd: repo.root,
    env,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
}

function runRouterFailure(env, ...args) {
  try {
    return { status: 0, stdout: runRouter(env, ...args), stderr: '' };
  } catch (error) {
    return {
      status: error.status ?? 1,
      stdout: error.stdout?.toString() ?? '',
      stderr: error.stderr?.toString() ?? ''
    };
  }
}

function assertRejectedOption(result, label) {
  const output = `${result.stdout}\n${result.stderr}`;
  if (result.status === 0 || !output.includes(`Invalid ${label}`)) {
    throw new Error(`ContextFS accepted invalid ${label}: ${JSON.stringify(result)}`);
  }
}

export async function run() {
  const { env, kernelHome } = makeEnv();
  runCli(env, 'init', '--sync');

  const failureDir = join(kernelHome, 'source', 'failures');
  mkdirSync(failureDir, { recursive: true });
  writeFileSync(join(failureDir, 'failure-lessons.json'), JSON.stringify([
    {
      id: 'metadata-only-record',
      type: 'failure',
      status: 'approved',
      projectId: 'metadata-only-project',
      title: 'No matching lexical content here',
      rootCause: 'This record exists only to verify project identity is a scoring signal rather than query text.',
      files: ['src/metadata-only.mjs']
    }
  ], null, 2) + '\n');

  const metadataOnly = JSON.parse(runRouter(
    env,
    'context', 'find', 'metadata-only-project',
    '--under', 'ak://global/failures/',
    '--project-id', 'metadata-only-project',
    '--budget', '800',
    '--json'
  ));
  if (metadataOnly.results.length !== 0) {
    throw new Error(`Global ContextFS treated project metadata as lexical query text: ${JSON.stringify(metadataOnly.results)}`);
  }

  assertRejectedOption(
    runRouterFailure(
      env,
      'context', 'find', 'No matching lexical content here',
      '--under', 'ak://global/failures/',
      '--budget', 'not-a-number',
      '--json'
    ),
    'budget'
  );
  assertRejectedOption(
    runRouterFailure(
      env,
      'context', 'find', 'No matching lexical content here',
      '--under', 'ak://global/failures/',
      '--limit', '1.5',
      '--json'
    ),
    'limit'
  );
  assertRejectedOption(
    runRouterFailure(env, 'context', 'tree', 'ak://global/', '--depth', 'NaN', '--json'),
    'depth'
  );

  const depthTwo = JSON.parse(runRouter(env, 'context', 'tree', 'ak://global/', '--depth', '2', '--json'));
  const nestedFailures = depthTwo.entries?.find((entry) => entry.name === 'failures');
  if (!Array.isArray(nestedFailures?.entries) || !nestedFailures.entries.some((entry) => entry.name === 'metadata-only-record')) {
    throw new Error(`Global ContextFS depth=2 did not expand nested entries: ${JSON.stringify(depthTwo)}`);
  }

  const secretKey = ['OPENAI', 'API', 'KEY'].join('_');
  const opaqueSecret = ['opaque', 'provider', 'credential', 'value', '123456'].join('-');
  const memoryDir = join(kernelHome, 'source', 'memories');
  mkdirSync(memoryDir, { recursive: true });
  writeFileSync(join(memoryDir, 'contextfs-l2-secret.json'), JSON.stringify([
    {
      id: 'contextfs-l2-secret',
      type: 'project-note',
      scope: 'global',
      level: 'standard',
      status: 'approved',
      text: 'ContextFS L2 secret-key regression record.',
      [secretKey]: opaqueSecret,
      createdAt: '2026-08-07T07:00:00.000Z'
    }
  ], null, 2) + '\n');
  const l2 = JSON.parse(runRouter(env, 'context', 'read', 'ak://global/memory/contextfs-l2-secret', '--level', '2', '--json'));
  if (l2.details?.[secretKey] !== '[REDACTED_SECRET]' || JSON.stringify(l2).includes(opaqueSecret)) {
    throw new Error(`Global ContextFS L2 exposed a provider-key secret: ${JSON.stringify(l2)}`);
  }

  const started = JSON.parse(runRouter(env, 'session', 'start', '--agent', 'contextfs-global-consistency', '--project', repo.root, '--json'));
  runRouter(env, 'session', 'observe', started.id, '--type', 'session_summary', '--text', 'A stable summary long enough for ContextFS commit regression coverage.', '--json');
  runRouter(env, 'context', 'commit', started.id, '--json');

  const sessions = JSON.parse(runRouter(env, 'context', 'tree', 'ak://global/sessions/', '--json'));
  if (sessions.entries.length !== 1 || sessions.entries[0].name !== started.id) {
    throw new Error(`Global ContextFS projected context-commit metadata as a session record: ${JSON.stringify(sessions.entries)}`);
  }
}

export const name = 'contextfs-global-consistency';
