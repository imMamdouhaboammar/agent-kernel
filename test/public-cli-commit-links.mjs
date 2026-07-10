// test/public-cli-commit-links.mjs
//
// Invariants:
//   1. Commit links use local git only and work without a daemon or GitHub API.
//   2. Repeated links are idempotent and multiple sessions may share one commit.
//   3. Commit context returns linked sessions, failures, episodes, and files.
//   4. The optional post-commit helper preserves existing hook logic.
//   5. Dry-run writes nothing and repeated installation keeps one marked block.

import childProcess from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertContains, makeEnv, repo, runCli } from './_lib/helpers.mjs';

const publicCli = path.join(repo.root, 'bin', 'agent-kernel-router.mjs');

function runPublic(env, ...args) {
  return childProcess.execFileSync(process.execPath, [publicCli, ...args], {
    cwd: repo.root,
    env,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
}

function runGit(cwd, ...args) {
  return childProcess.execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

export async function run() {
  const { env, kernelHome } = makeEnv();
  runCli(env, 'init', '--sync');

  const sha = runGit(repo.root, 'rev-parse', 'HEAD');
  const first = JSON.parse(runPublic(
    env,
    'session', 'start',
    '--agent', 'commit-agent-one',
    '--project', repo.root,
    '--json'
  ));
  const second = JSON.parse(runPublic(
    env,
    'session', 'start',
    '--agent', 'commit-agent-two',
    '--project', repo.root,
    '--json'
  ));

  runPublic(
    env,
    'session', 'observe', first.id,
    '--type', 'file_edit',
    '--text', 'Changed commit link implementation.',
    '--files', 'bin/agent-kernel-commit.mjs,test/public-cli-commit-links.mjs'
  );
  runPublic(
    env,
    'session', 'observe', second.id,
    '--type', 'test_failure',
    '--text', 'Validated repeated hook installation.',
    '--file', 'test/public-cli-commit-links.mjs'
  );

  const failureId = 'failure_commit_link_fixture';
  writeJson(path.join(kernelHome, 'source', 'failures', 'failure-lessons.json'), [{
    id: failureId,
    type: 'test-failure',
    status: 'captured',
    errorSignature: 'COMMIT_LINK_FIXTURE',
    rootCause: 'The fixture proves commit context can resolve local Failure Lessons.',
    preventionRule: 'Keep commit relationships local and idempotent.',
    occurrences: 1
  }]);

  const episodeId = 'episode_commit_link_fixture';
  writeJson(path.join(kernelHome, 'episodes', 'archive', `${episodeId}.json`), {
    id: episodeId,
    type: 'episode',
    title: 'Commit link fixture episode',
    summary: 'A local episode related to the linked commit.',
    text: 'No network lookup is required.',
    status: 'approved',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  });

  const firstLink = JSON.parse(runPublic(
    env,
    'commit', 'link',
    '--sha', sha,
    '--session', first.id,
    '--failure', failureId,
    '--episode', episodeId,
    '--json'
  ));
  if (!firstLink.ok || firstLink.commit.sessions.length !== 1) {
    throw new Error(`first commit link failed: ${JSON.stringify(firstLink)}`);
  }

  const repeated = JSON.parse(runPublic(
    env,
    'commit', 'link',
    '--sha', sha,
    '--session', first.id,
    '--failure', failureId,
    '--episode', episodeId,
    '--json'
  ));
  if (repeated.commit.sessions.length !== 1 || repeated.commit.failures.length !== 1 || repeated.commit.episodes.length !== 1) {
    throw new Error(`repeated commit link duplicated relationships: ${JSON.stringify(repeated)}`);
  }

  const secondLink = JSON.parse(runPublic(
    env,
    'commit', 'link',
    '--sha', sha,
    '--session', second.id,
    '--json'
  ));
  if (secondLink.commit.sessions.length !== 2) {
    throw new Error(`multiple sessions were not linked to one commit: ${JSON.stringify(secondLink)}`);
  }

  const listed = JSON.parse(runPublic(env, 'commit', 'list', '--json'));
  if (listed.commits.length !== 1 || listed.commits[0].sha !== sha) {
    throw new Error(`commit list returned unexpected records: ${JSON.stringify(listed)}`);
  }

  const shown = JSON.parse(runPublic(env, 'commit', 'show', sha.slice(0, 10), '--json'));
  if (shown.sessions.length !== 2 || shown.files.length < 2) {
    throw new Error(`commit show omitted relationships: ${JSON.stringify(shown)}`);
  }

  const context = JSON.parse(runPublic(env, 'commit', 'context', sha, '--budget', '1600', '--json'));
  if (context.sections.sessions.length !== 2) {
    throw new Error(`commit context omitted sessions: ${JSON.stringify(context)}`);
  }
  if (context.sections.failures[0]?.id !== failureId) {
    throw new Error(`commit context omitted failure lesson: ${JSON.stringify(context)}`);
  }
  if (context.sections.episodes[0]?.id !== episodeId) {
    throw new Error(`commit context omitted episode: ${JSON.stringify(context)}`);
  }
  if (!context.sections.files.includes('bin/agent-kernel-commit.mjs')) {
    throw new Error(`commit context omitted observed files: ${JSON.stringify(context)}`);
  }
  if (context.budgetUsed > 1600 || context.context.length > 1600) {
    throw new Error('commit context exceeded its budget');
  }

  const firstSession = JSON.parse(fs.readFileSync(path.join(kernelHome, 'runtime', 'sessions', `${first.id}.json`), 'utf8'));
  if (firstSession.linkedCommits.length !== 1 || firstSession.linkedCommits[0] !== sha) {
    throw new Error(`session was not linked back to commit: ${JSON.stringify(firstSession)}`);
  }

  const hookRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-kernel-commit-hook-'));
  runGit(hookRepo, 'init');
  const hookPath = path.join(hookRepo, '.git', 'hooks', 'post-commit');
  const originalHook = '#!/usr/bin/env sh\necho existing-hook\n';
  fs.writeFileSync(hookPath, originalHook);
  fs.chmodSync(hookPath, 0o755);

  const dryRun = runPublic(env, 'git-hook', 'install', '--commit-link', hookRepo, '--dry-run');
  assertContains(dryRun, 'dry run', 'commit-link hook dry-run was not reported');
  if (fs.readFileSync(hookPath, 'utf8') !== originalHook) {
    throw new Error('commit-link hook dry-run modified the hook');
  }

  runPublic(env, 'git-hook', 'install', '--commit-link', hookRepo);
  runPublic(env, 'git-hook', 'install', '--commit-link', hookRepo);
  const installed = fs.readFileSync(hookPath, 'utf8');
  assertContains(installed, 'echo existing-hook', 'commit-link hook removed existing logic');
  assertContains(installed, 'AGENT_KERNEL_SESSION_ID', 'commit-link hook omitted opt-in session guard');
  const markerCount = installed.split('# agent-kernel:commit-link:start').length - 1;
  if (markerCount !== 1) throw new Error(`commit-link hook duplicated its marked block: ${markerCount}`);
}

export const name = 'public-cli-commit-links';
