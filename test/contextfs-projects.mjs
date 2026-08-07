// test/contextfs-projects.mjs — Project-scoped ContextFS projection and relation retrieval.

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

function assertDirectory(tree, name) {
  if (!tree.entries?.some((entry) => entry.kind === 'directory' && entry.name === name)) {
    throw new Error(`ContextFS project tree missing ${name}: ${JSON.stringify(tree)}`);
  }
}

export async function run() {
  const { env, kernelHome, homeDir } = makeEnv();
  runCli(env, 'init', '--sync');

  const failuresDir = join(kernelHome, 'source', 'failures');
  mkdirSync(failuresDir, { recursive: true });
  writeFileSync(join(failuresDir, 'failure-lessons.json'), JSON.stringify([
    {
      id: 'project-a-primary',
      type: 'failure',
      status: 'approved',
      projectId: 'project-a',
      title: 'Project alpha restore conflict',
      rootCause: 'The restore operation ignored a project-local file conflict.',
      fix: 'Inspect the local file before restoring.',
      files: ['src/project-a.mjs'],
      occurrences: 4
    },
    {
      id: 'project-a-related',
      type: 'failure',
      status: 'approved',
      projectId: 'project-a',
      title: 'Unrelated wording but same file evidence',
      rootCause: 'A separate failure touched the same file.',
      fix: 'Reuse the prior file-local evidence.',
      files: ['src/project-a.mjs']
    },
    {
      id: 'project-b-copy',
      type: 'failure',
      status: 'approved',
      projectId: 'project-b',
      title: 'Project alpha restore conflict',
      rootCause: 'Same wording in a different project.',
      files: ['src/project-a.mjs']
    }
  ], null, 2) + '\n');

  const registeredPath = join(homeDir, 'registered-project-a');
  mkdirSync(registeredPath, { recursive: true });
  const projectRegistryDir = join(kernelHome, 'source', 'projects');
  mkdirSync(projectRegistryDir, { recursive: true });
  writeFileSync(join(projectRegistryDir, 'projects.json'), JSON.stringify({
    version: 1,
    projects: [{ projectId: 'project-a', root: registeredPath, name: 'Project A' }]
  }, null, 2) + '\n');

  const projects = JSON.parse(runRouter(env, 'context', 'tree', 'ak://projects/', '--json'));
  if (!projects.entries?.some((entry) => entry.uri === 'ak://projects/project-a/')) {
    throw new Error(`ContextFS did not materialize project-a: ${JSON.stringify(projects)}`);
  }

  const projectTree = JSON.parse(runRouter(env, 'context', 'tree', 'ak://projects/project-a/', '--json'));
  if (projectTree.projectId !== 'project-a') throw new Error(`Project tree lost project identity: ${JSON.stringify(projectTree)}`);
  for (const collection of ['memory', 'failures', 'episodes', 'sessions', 'files', 'architecture', 'commits']) {
    assertDirectory(projectTree, collection);
  }

  const failures = JSON.parse(runRouter(env, 'context', 'tree', 'ak://projects/project-a/failures/', '--json'));
  if (failures.entries?.length !== 2 || failures.entries.some((entry) => entry.uri.includes('project-b-copy'))) {
    throw new Error(`Project-scoped failures leaked cross-project records: ${JSON.stringify(failures)}`);
  }
  const primary = failures.entries.find((entry) => entry.name === 'project-a-primary');
  if (primary?.uri !== 'ak://projects/project-a/failures/project-a-primary') {
    throw new Error(`Project record URI was not canonical: ${JSON.stringify(primary)}`);
  }

  const record = JSON.parse(runRouter(env, 'context', 'read', primary.uri, '--level', '1', '--json'));
  if (record.projectId !== 'project-a' || record.level !== 1) {
    throw new Error(`Project record projection lost scope: ${JSON.stringify(record)}`);
  }
  if (!record.relations?.some((relation) => relation.type === 'owned-by-project' && relation.target === 'ak://projects/project-a/')) {
    throw new Error(`Project record missed owned-by-project relation: ${JSON.stringify(record.relations)}`);
  }
  if (!record.relations?.some((relation) => relation.type === 'references-file')) {
    throw new Error(`Project record missed references-file relation: ${JSON.stringify(record.relations)}`);
  }

  const fileTree = JSON.parse(runRouter(env, 'context', 'tree', 'ak://projects/project-a/files/', '--json'));
  const fileRecord = fileTree.entries?.find((entry) => entry.path === 'src/project-a.mjs');
  if (!fileRecord?.uri?.startsWith('ak://projects/project-a/files/')) {
    throw new Error(`Project files projection did not materialize referenced file: ${JSON.stringify(fileTree)}`);
  }
  const fileRead = JSON.parse(runRouter(env, 'context', 'read', fileRecord.uri, '--level', '1', '--json'));
  if (fileRead.overview?.path !== 'src/project-a.mjs' || fileRead.projectId !== 'project-a') {
    throw new Error(`Project file projection lost path metadata: ${JSON.stringify(fileRead)}`);
  }

  const found = JSON.parse(runRouter(
    env,
    'context', 'find', 'Project alpha restore conflict',
    '--under', 'ak://projects/project-a/',
    '--budget', '1600',
    '--limit', '5',
    '--trace',
    '--json'
  ));
  if (found.projectId !== 'project-a' || found.results.some((result) => !result.uri.startsWith('ak://projects/project-a/'))) {
    throw new Error(`Project-scoped find escaped project hierarchy: ${JSON.stringify(found)}`);
  }
  if (found.results[0]?.uri !== primary.uri) {
    throw new Error(`Project-scoped find did not rank primary evidence first: ${JSON.stringify(found.results)}`);
  }
  if (!found.results.some((result) => result.uri === 'ak://projects/project-a/failures/project-a-related')) {
    throw new Error(`Bounded relation expansion did not include same-file evidence: ${JSON.stringify(found.results)}`);
  }
  if (!found.trace?.some((step) => step.stage === 'relation' && step.uri === 'ak://projects/project-a/failures/project-a-related')) {
    throw new Error(`Retrieval trace did not explain relation expansion: ${JSON.stringify(found.trace)}`);
  }

  const byPath = JSON.parse(runRouter(
    env,
    'context', 'find', 'Project alpha restore conflict',
    '--project', registeredPath,
    '--budget', '1200',
    '--json'
  ));
  if (byPath.projectId !== 'project-a') throw new Error(`--project did not resolve existing project identity: ${JSON.stringify(byPath)}`);

  const mismatch = runRouterFailure(
    env,
    'context', 'find', 'Project alpha restore conflict',
    '--under', 'ak://projects/project-a/',
    '--project-id', 'project-b',
    '--json'
  );
  if (mismatch.status === 0 || !`${mismatch.stdout}\n${mismatch.stderr}`.includes('Project scope mismatch')) {
    throw new Error(`ContextFS accepted contradictory project scope: ${JSON.stringify(mismatch)}`);
  }
}

export const name = 'contextfs-projects';
