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

  const started = JSON.parse(runRouter(env, 'session', 'start', '--agent', 'contextfs-global-consistency', '--project', repo.root, '--json'));
  runRouter(env, 'session', 'observe', started.id, '--type', 'session_summary', '--text', 'A stable summary long enough for ContextFS commit regression coverage.', '--json');
  runRouter(env, 'context', 'commit', started.id, '--json');

  const sessions = JSON.parse(runRouter(env, 'context', 'tree', 'ak://global/sessions/', '--json'));
  if (sessions.entries.length !== 1 || sessions.entries[0].name !== started.id) {
    throw new Error(`Global ContextFS projected context-commit metadata as a session record: ${JSON.stringify(sessions.entries)}`);
  }
}

export const name = 'contextfs-global-consistency';
