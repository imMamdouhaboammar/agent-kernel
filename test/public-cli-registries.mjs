// test/public-cli-registries.mjs
//
// Invariants:
//   1. Agent registry commands are local and conservative by default.
//   2. Removing a custom agent preserves historical sessions.
//   3. Project identity survives moving the repository directory.
//   4. Project metadata strips credentials from git remotes.
//   5. Sessions inherit the stable project ID.
//   6. Search and compact context filter by project.

import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { makeEnv, repo, runCli } from './_lib/helpers.mjs';

const publicCli = path.join(repo.root, 'bin', 'agent-kernel-router.mjs');

function runPublic(env, cwd, ...args) {
  return childProcess.execFileSync(process.execPath, [publicCli, ...args], {
    cwd,
    env,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
}

function git(env, cwd, ...args) {
  return childProcess.execFileSync('git', args, { cwd, env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

export async function run() {
  const { env, homeDir, kernelHome } = makeEnv();
  runCli(env, 'init', '--sync');

  const initialAgents = JSON.parse(runPublic(env, repo.root, 'agent', 'list', '--json'));
  if (!initialAgents.agents.some((agent) => agent.agentId === 'codex' && agent.trustLevel === 'propose-only')) {
    throw new Error(`built-in agent registry was not initialized: ${JSON.stringify(initialAgents)}`);
  }

  const added = JSON.parse(runPublic(
    env,
    repo.root,
    'agent', 'add', 'registry-test-agent',
    '--name', 'Registry Test Agent',
    '--surface', 'cli',
    '--json'
  ));
  if (added.trustLevel !== 'read-only') {
    throw new Error(`new agent did not default to read-only: ${JSON.stringify(added)}`);
  }

  const updated = JSON.parse(runPublic(
    env,
    repo.root,
    'agent', 'set', 'registry-test-agent',
    '--trust', 'propose-only',
    '--aliases', 'registry-alias',
    '--json'
  ));
  if (updated.trustLevel !== 'propose-only' || !updated.aliases.includes('registry-alias')) {
    throw new Error(`agent set did not update trust and aliases: ${JSON.stringify(updated)}`);
  }
  const shown = JSON.parse(runPublic(env, repo.root, 'agent', 'show', 'registry-alias', '--json'));
  if (shown.agentId !== 'registry-test-agent') throw new Error(`agent alias lookup failed: ${JSON.stringify(shown)}`);

  const projectA = path.join(homeDir, 'project-before-move');
  fs.mkdirSync(projectA, { recursive: true });
  writeJson(path.join(projectA, 'package.json'), { name: '@acme/stable-project', version: '0.0.1' });
  git(env, projectA, 'init');
  git(env, projectA, 'config', 'user.name', 'Agent Kernel Test');
  git(env, projectA, 'config', 'user.email', 'agent-kernel@example.test');
  fs.writeFileSync(path.join(projectA, 'README.md'), '# fixture\n');
  git(env, projectA, 'add', 'README.md', 'package.json');
  git(env, projectA, 'commit', '-m', 'initial fixture');
  git(env, projectA, 'remote', 'add', 'origin', 'https://fixture-user:fixture-secret@github.com/acme/stable-project.git');

  const identified = JSON.parse(runPublic(env, projectA, 'project', 'identify', '.', '--json'));
  if (identified.projectId !== 'stable-project') {
    throw new Error(`project ID was not derived stably: ${JSON.stringify(identified)}`);
  }
  if (identified.repoRemote !== 'github.com/acme/stable-project') {
    throw new Error(`project remote was not sanitized: ${JSON.stringify(identified)}`);
  }
  const markerPath = path.join(projectA, '.agent-kernel', 'project.json');
  const markerText = fs.readFileSync(markerPath, 'utf8');
  const registryText = fs.readFileSync(path.join(kernelHome, 'source', 'projects', 'projects.json'), 'utf8');
  if (markerText.includes('fixture-secret') || registryText.includes('fixture-secret')) {
    throw new Error('project identity persisted remote credentials');
  }

  const projectB = path.join(homeDir, 'project-after-move');
  fs.renameSync(projectA, projectB);
  const moved = JSON.parse(runPublic(env, projectB, 'project', 'identify', '.', '--json'));
  if (moved.projectId !== identified.projectId || moved.root !== projectB) {
    throw new Error(`project identity changed after moving the directory: ${JSON.stringify({ identified, moved })}`);
  }

  const setId = JSON.parse(runPublic(env, projectB, 'project', 'set-id', '.', 'stable-project-id', '--json'));
  if (setId.projectId !== 'stable-project-id') throw new Error(`project set-id failed: ${JSON.stringify(setId)}`);
  const reidentified = JSON.parse(runPublic(env, projectB, 'project', 'identify', '.', '--json'));
  if (reidentified.projectId !== 'stable-project-id') {
    throw new Error(`explicit project ID was not stable: ${JSON.stringify(reidentified)}`);
  }
  const listedProjects = JSON.parse(runPublic(env, projectB, 'project', 'list', '--json'));
  if (!listedProjects.projects.some((project) => project.projectId === 'stable-project-id' && project.root === projectB)) {
    throw new Error(`project list omitted the updated project: ${JSON.stringify(listedProjects)}`);
  }
  const shownProject = JSON.parse(runPublic(env, projectB, 'project', 'show', 'stable-project-id', '--json'));
  if (shownProject.root !== projectB) throw new Error(`project show returned stale root: ${JSON.stringify(shownProject)}`);

  const session = JSON.parse(runPublic(
    env,
    projectB,
    'session', 'start',
    '--agent', 'registry-test-agent',
    '--project', projectB,
    '--json'
  ));
  const persistedSession = JSON.parse(fs.readFileSync(path.join(kernelHome, 'runtime', 'sessions', `${session.id}.json`), 'utf8'));
  if (persistedSession.projectId !== 'stable-project-id') {
    throw new Error(`session did not inherit stable project ID: ${JSON.stringify(persistedSession)}`);
  }

  runPublic(env, projectB, 'agent', 'remove', 'registry-test-agent');
  const historical = JSON.parse(fs.readFileSync(path.join(kernelHome, 'runtime', 'sessions', `${session.id}.json`), 'utf8'));
  if (historical.agentId !== 'registry-test-agent') {
    throw new Error('removing the agent deleted or rewrote historical session identity');
  }

  const failures = [
    {
      id: 'registry_project_match', status: 'captured', project: 'stable-project-id', agent: 'codex',
      errorSignature: 'REGISTRY_PROJECT_SIGNAL', rootCause: 'Registry project match signal.',
      evidence: { outputExcerpt: 'shared registry project signal' }, occurrences: 1,
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'registry_project_other', status: 'captured', project: 'other-project', agent: 'codex',
      errorSignature: 'REGISTRY_PROJECT_SIGNAL', rootCause: 'Other project signal.',
      evidence: { outputExcerpt: 'shared registry project signal' }, occurrences: 1,
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'
    }
  ];
  writeJson(path.join(kernelHome, 'source', 'failures', 'failure-lessons.json'), failures);
  runPublic(env, projectB, 'reindex');
  const search = JSON.parse(runPublic(
    env,
    projectB,
    'search', 'shared registry project signal',
    '--project-id', 'stable-project-id',
    '--json'
  ));
  if (search.count !== 1 || search.results[0]?.id !== 'registry_project_match') {
    throw new Error(`project search filter leaked another project: ${JSON.stringify(search)}`);
  }

  const notesPath = path.join(kernelHome, 'source', 'memories', 'project-notes.json');
  const notes = JSON.parse(fs.readFileSync(notesPath, 'utf8'));
  notes.push(
    { id: 'registry_context_global', type: 'project-note', scope: 'global', level: 'note', status: 'approved', text: 'RegistryContextSignal global' },
    { id: 'registry_context_match', type: 'project-note', scope: 'project', projectId: 'stable-project-id', level: 'note', status: 'approved', text: 'RegistryContextSignal matching' },
    { id: 'registry_context_other', type: 'project-note', scope: 'project', projectId: 'other-project', level: 'note', status: 'approved', text: 'RegistryContextSignal other' }
  );
  writeJson(notesPath, notes);
  const context = JSON.parse(runPublic(
    env,
    projectB,
    'context',
    '--query', 'RegistryContextSignal',
    '--project-id', 'stable-project-id',
    '--json'
  ));
  if (!context.context.includes('RegistryContextSignal global') || !context.context.includes('RegistryContextSignal matching')) {
    throw new Error(`project context omitted global or matching memory: ${JSON.stringify(context)}`);
  }
  if (context.context.includes('RegistryContextSignal other')) {
    throw new Error(`project context leaked another project: ${JSON.stringify(context)}`);
  }
}

export const name = 'public-cli-registries';
