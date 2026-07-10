// test/public-cli-session-timeline.mjs
//
// Invariants:
//   1. Session timeline output is chronological even when JSONL order is not.
//   2. Timeline filters by event type and one or more files.
//   3. Compact output is bounded for terminal use.
//   4. JSON output includes the session, filters, count, and observations.
//   5. Empty sessions return a valid empty timeline.

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
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

function observation(session, input) {
  return {
    id: input.id,
    sessionId: session.id,
    timestamp: input.timestamp,
    agentId: session.agentId,
    type: input.type,
    projectId: session.projectId,
    cwd: session.cwd,
    files: input.files || [],
    command: input.command || '',
    exitCode: input.exitCode ?? null,
    text: input.text,
    metadata: {}
  };
}

export async function run() {
  const { env, kernelHome } = makeEnv();
  runCli(env, 'init', '--sync');

  const session = JSON.parse(runPublic(
    env,
    'session', 'start',
    '--agent', 'timeline-agent',
    '--project', repo.root,
    '--json'
  ));

  const events = [
    observation(session, {
      id: 'obs_late',
      timestamp: '2026-01-01T00:00:03.000Z',
      type: 'command_failure',
      files: ['src/cli.mjs'],
      command: 'npm test',
      exitCode: 1,
      text: 'Tests failed after the edit.'
    }),
    observation(session, {
      id: 'obs_first',
      timestamp: '2026-01-01T00:00:01.000Z',
      type: 'file_read',
      files: ['docs/README.md'],
      text: 'Read the documentation index.'
    }),
    observation(session, {
      id: 'obs_middle',
      timestamp: '2026-01-01T00:00:02.000Z',
      type: 'file_edit',
      files: ['src/cli.mjs', 'test/smoke.mjs'],
      text: 'Added a small CLI change.'
    })
  ];

  const jsonlPath = join(kernelHome, 'runtime', 'sessions', `${session.id}.jsonl`);
  writeFileSync(jsonlPath, events.map((event) => JSON.stringify(event)).join('\n') + '\n');

  const timeline = JSON.parse(runPublic(env, 'session', 'timeline', session.id, '--json'));
  if (timeline.count !== 3 || timeline.observations.length !== 3) {
    throw new Error(`timeline JSON returned the wrong count: ${JSON.stringify(timeline)}`);
  }
  const order = timeline.observations.map((event) => event.id).join(',');
  if (order !== 'obs_first,obs_middle,obs_late') {
    throw new Error(`timeline was not chronological: ${order}`);
  }
  if (timeline.session.id !== session.id || !timeline.filters) {
    throw new Error(`timeline JSON metadata is incomplete: ${JSON.stringify(timeline)}`);
  }

  const byType = JSON.parse(runPublic(
    env,
    'session', 'timeline', session.id,
    '--type', 'command_failure',
    '--json'
  ));
  if (byType.count !== 1 || byType.observations[0]?.id !== 'obs_late') {
    throw new Error(`timeline type filter failed: ${JSON.stringify(byType)}`);
  }

  const byFiles = JSON.parse(runPublic(
    env,
    'session', 'timeline', session.id,
    '--files', 'src/cli.mjs,test/smoke.mjs',
    '--json'
  ));
  if (byFiles.count !== 2) {
    throw new Error(`timeline files filter failed: ${JSON.stringify(byFiles)}`);
  }
  const fileIds = byFiles.observations.map((event) => event.id).sort().join(',');
  if (fileIds !== 'obs_late,obs_middle') {
    throw new Error(`timeline files filter returned wrong events: ${fileIds}`);
  }

  const compact = runPublic(env, 'session', 'timeline', session.id, '--compact');
  assertContains(compact, 'command_failure', 'compact timeline omitted command failure');
  for (const line of compact.trim().split(/\r?\n/)) {
    if (line.length > 120) throw new Error(`compact timeline exceeded 120 columns: ${line.length} ${line}`);
  }

  const empty = JSON.parse(runPublic(
    env,
    'session', 'start',
    '--agent', 'empty-timeline-agent',
    '--project', repo.root,
    '--json'
  ));
  const emptyJson = JSON.parse(runPublic(env, 'session', 'timeline', empty.id, '--json'));
  if (emptyJson.count !== 0 || emptyJson.observations.length !== 0) {
    throw new Error(`empty session timeline was not empty: ${JSON.stringify(emptyJson)}`);
  }
  const emptyText = runPublic(env, 'session', 'timeline', empty.id);
  assertContains(emptyText, `No timeline events found for session ${empty.id}`, 'empty timeline message missing');
}

export const name = 'public-cli-session-timeline';
