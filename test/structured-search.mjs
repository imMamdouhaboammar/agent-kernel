// test/structured-search.mjs — Structured local index, scoring, budgets, and source fallback.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeEnv, repo, runCli } from './_lib/helpers.mjs';

const publicCli = join(repo.root, 'bin', 'agent-kernel-router.mjs');

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

  const projectNotesPath = join(kernelHome, 'source', 'memories', 'project-notes.json');
  writeFileSync(projectNotesPath, JSON.stringify([
    {
      id: 'approved_file_memory',
      type: 'project-note',
      scope: 'project',
      level: 'standard',
      status: 'approved',
      text: 'Inspect src/cli.mjs before edits.',
      files: ['src/cli.mjs'],
      tags: ['cli'],
      createdAt: '2026-07-10T09:50:00.000Z',
      updatedAt: '2026-07-10T09:50:00.000Z'
    }
  ], null, 2) + '\n');

  const failuresPath = join(kernelHome, 'source', 'failures', 'failure-lessons.json');
  mkdirSync(join(kernelHome, 'source', 'failures'), { recursive: true });
  writeFileSync(failuresPath, JSON.stringify([
    {
      id: 'failure_search_smoke',
      status: 'captured',
      errorSignature: 'ERR_MODULE_NOT_FOUND',
      rootCause: 'Missing local import in src/cli.mjs',
      fixRecipe: ['Restore the import and run npm test'],
      files: ['src/cli.mjs'],
      occurrences: 4,
      evidence: { command: 'npm test', filesTouched: ['src/cli.mjs'] },
      updatedAt: '2026-07-10T10:00:00.000Z'
    }
  ], null, 2) + '\n');

  const episodeDir = join(kernelHome, 'episodes', 'archive');
  mkdirSync(episodeDir, { recursive: true });
  writeFileSync(join(episodeDir, 'episode_search_smoke.json'), JSON.stringify({
    id: 'episode_search_smoke',
    title: 'Safe-link duplicate block decision',
    text: 'The safe-link command must remain idempotent.',
    files: ['bin/agent-kernel-safe-link.mjs'],
    tags: ['safe-link'],
    updatedAt: '2026-07-10T10:01:00.000Z'
  }, null, 2) + '\n');

  const sessionDir = join(kernelHome, 'runtime', 'sessions');
  mkdirSync(sessionDir, { recursive: true });
  writeFileSync(join(sessionDir, 'session_search_smoke.jsonl'), JSON.stringify({
    id: 'obs_search_smoke',
    type: 'command_failure',
    text: 'npm test failed before the import was restored',
    command: 'npm test',
    files: ['src/cli.mjs'],
    linkedCommits: ['abc123'],
    timestamp: new Date().toISOString()
  }) + '\n');

  const rebuild = JSON.parse(runPublic(env, 'reindex'));
  if (rebuild.counts.failure !== 1 || rebuild.counts.episode !== 1 || rebuild.counts.session < 1) {
    throw new Error(`reindex returned unexpected counts: ${JSON.stringify(rebuild)}`);
  }

  const failure = JSON.parse(runPublic(env, 'search', 'ERR_MODULE_NOT_FOUND', '--type', 'failure', '--debug', '--json'));
  if (failure.results.length !== 1 || failure.results[0].id !== 'failure_search_smoke') {
    throw new Error(`failure search missed indexed record: ${JSON.stringify(failure)}`);
  }
  const failureSignals = failure.results[0].signals.map((signal) => signal.name);
  if (!failureSignals.includes('exact-error') || !failureSignals.includes('failure-recurrence')) {
    throw new Error(`failure scoring was not explainable: ${JSON.stringify(failure.results[0])}`);
  }

  const fileSearch = JSON.parse(runPublic(env, 'search', 'src/cli.mjs', '--files', '--explain', '--json'));
  if (fileSearch.results[0]?.id !== 'approved_file_memory') {
    throw new Error(`approved exact-file memory was not ranked first: ${JSON.stringify(fileSearch)}`);
  }
  if (!fileSearch.results[0].signals.some((signal) => signal.name === 'approved-memory')) {
    throw new Error(`approved memory priority was not explained: ${JSON.stringify(fileSearch.results[0])}`);
  }
  if (fileSearch.sections.approvedMemory.length !== 1 || !fileSearch.sections.rawObservations.some((item) => item.id === 'obs_search_smoke')) {
    throw new Error(`search sections did not separate approved memory and observations: ${JSON.stringify(fileSearch.sections)}`);
  }

  const repeat = JSON.parse(runPublic(env, 'search', 'src/cli.mjs', '--files', '--explain', '--json'));
  if (repeat.results.map((item) => item.id).join(',') !== fileSearch.results.map((item) => item.id).join(',')) {
    throw new Error('ranking changed across identical searches');
  }

  const commandSearch = JSON.parse(runPublic(env, 'search', 'npm test', '--commands', '--json'));
  if (!commandSearch.results.some((item) => item.id === 'failure_search_smoke')) {
    throw new Error(`command search missed failure record: ${JSON.stringify(commandSearch)}`);
  }

  const budgeted = JSON.parse(runPublic(env, 'search', 'src/cli.mjs', '--files', '--explain', '--budget', '300', '--json'));
  if (budgeted.budgetUsed > 300 || budgeted.rendered.length > 300) {
    throw new Error(`search exceeded budget: ${JSON.stringify(budgeted)}`);
  }

  const sourceBefore = readFileSync(failuresPath, 'utf8');
  rmSync(join(kernelHome, 'index', 'failure-index.json'));
  const missing = JSON.parse(runPublic(env, 'search', 'ERR_MODULE_NOT_FOUND', '--type', 'failure', '--json'));
  if (missing.indexSources.failure !== 'source-fallback-missing-index' || missing.results.length !== 1) {
    throw new Error(`missing index did not fall back to source: ${JSON.stringify(missing)}`);
  }

  writeFileSync(join(kernelHome, 'index', 'failure-index.json'), '{not valid json');
  const corrupt = JSON.parse(runPublic(env, 'search', 'ERR_MODULE_NOT_FOUND', '--type', 'failure', '--json'));
  if (corrupt.indexSources.failure !== 'source-fallback-corrupt-index' || corrupt.results.length !== 1) {
    throw new Error(`corrupt index did not fall back to source: ${JSON.stringify(corrupt)}`);
  }
  if (readFileSync(failuresPath, 'utf8') !== sourceBefore) {
    throw new Error('corrupt index handling modified source data');
  }
}

export const name = 'structured-search';
