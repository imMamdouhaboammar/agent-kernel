// test/public-cli-observation.mjs — Session observation capture smoke test.
//
// Invariants:
//   1. Observations can be captured without the daemon running.
//   2. Observation records are append-only JSONL evidence.
//   3. Observations can be filtered by type, file, command, and query.
//   4. Capturing an observation updates the parent session count.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertContains, makeEnv, repo, runCli } from './_lib/helpers.mjs';

const publicCli = join(repo.root, 'bin', 'agent-kernel.mjs');

function runPublic(env, ...args) {
  return execFileSync(process.execPath, [publicCli, ...args], {
    cwd: repo.root,
    env,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
}

export async function run() {
  const { env, kernelHome } = makeEnv();
  runCli(env, 'init', '--sync');

  const session = JSON.parse(runPublic(env, 'session', 'start', '--agent', 'capture-agent', '--project', repo.root, '--json'));
  const captured = JSON.parse(runPublic(
    env,
    'session', 'observe', session.id,
    '--type', 'command_failure',
    '--text', 'safe-link duplicated marked block',
    '--file', 'src/cli.mjs',
    '--command', 'npm test',
    '--exit-code', '1',
    '--json'
  ));

  if (!captured.observation.id || captured.observation.type !== 'command_failure') {
    throw new Error(`observation capture returned invalid payload: ${JSON.stringify(captured)}`);
  }
  if (captured.session.observationCount !== 1) {
    throw new Error(`session count was not updated: ${JSON.stringify(captured.session)}`);
  }

  const jsonlPath = join(kernelHome, 'runtime', 'sessions', `${session.id}.jsonl`);
  const jsonl = readFileSync(jsonlPath, 'utf8');
  assertContains(jsonl, 'safe-link duplicated marked block', 'observation text missing from JSONL');

  const byType = JSON.parse(runPublic(env, 'session', 'observations', session.id, '--type', 'command_failure', '--json'));
  if (byType.observations.length !== 1) throw new Error(`type filter failed: ${JSON.stringify(byType)}`);

  const byFile = JSON.parse(runPublic(env, 'session', 'observations', session.id, '--file', 'src/cli.mjs', '--json'));
  if (byFile.observations.length !== 1) throw new Error(`file filter failed: ${JSON.stringify(byFile)}`);

  const byCommand = JSON.parse(runPublic(env, 'session', 'observations', session.id, '--command', 'npm', '--json'));
  if (byCommand.observations.length !== 1) throw new Error(`command filter failed: ${JSON.stringify(byCommand)}`);

  const byQuery = JSON.parse(runPublic(env, 'session', 'observations', session.id, '--query', 'duplicated', '--json'));
  if (byQuery.observations.length !== 1) throw new Error(`query filter failed: ${JSON.stringify(byQuery)}`);
}

export const name = 'public-cli-observation';
