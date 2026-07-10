// test/file-references.mjs — First-class file references across local records.
//
// Invariants:
//   1. remember, propose, failure capture, episode add, and session observe persist normalized files.
//   2. Absolute and relative paths inside the project normalize to one project-relative value.
//   3. Memory, failure, and episode search support file-only filters.
//   4. Failure promotion carries file references into the pending proposal.
//   5. Compile can emit a separate file-specific context artifact.
//   6. Existing records without `files` remain valid.
//   7. File-reference schemas keep `files` optional.
//   8. Episode redaction still applies when file references are supplied.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertContains, assertNotContains, makeEnv, repo, runCli } from './_lib/helpers.mjs';

const publicCli = join(repo.root, 'bin', 'agent-kernel.mjs');

function runPublic(env, cwd, ...args) {
  return execFileSync(process.execPath, [publicCli, ...args], {
    cwd,
    env,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
}

function json(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function findByIdPrefix(records, prefix) {
  return records.find((record) => record.id?.startsWith(prefix));
}

export async function run() {
  const { env, homeDir, kernelHome } = makeEnv();
  runCli(env, 'init', '--sync');

  const project = join(homeDir, 'file-reference-project');
  mkdirSync(join(project, 'src'), { recursive: true });
  mkdirSync(join(project, 'test'), { recursive: true });
  writeFileSync(join(project, 'src', 'cli.mjs'), '// fixture\n');
  writeFileSync(join(project, 'test', 'smoke.mjs'), '// fixture\n');
  execFileSync('git', ['init'], { cwd: project, env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });

  const absoluteCli = join(project, 'src', 'cli.mjs');
  const rememberOut = runPublic(
    env,
    project,
    'remember',
    'Use the focused CLI patch path.',
    '--type',
    'project-note',
    '--files',
    `${absoluteCli},./src/cli.mjs`
  );
  const memoryId = rememberOut.match(/Saved approved [^:]+:\s*(\S+)/)?.[1];
  if (!memoryId) throw new Error(`could not extract memory id: ${rememberOut}`);

  const projectNotesPath = join(kernelHome, 'source', 'memories', 'project-notes.json');
  const memory = json(projectNotesPath).find((record) => record.id === memoryId);
  if (JSON.stringify(memory.files) !== JSON.stringify(['src/cli.mjs'])) {
    throw new Error(`memory files were not normalized and deduplicated: ${JSON.stringify(memory)}`);
  }

  const proposalOut = runPublic(
    env,
    project,
    'propose',
    '--from',
    'test-agent',
    '--type',
    'rule',
    '--text',
    'Keep smoke coverage beside file-aware changes.',
    '--reason',
    'File-reference compatibility test.',
    '--files',
    join(project, 'test', 'smoke.mjs')
  );
  const proposalId = proposalOut.match(/Created pending memory proposal:\s*(\S+)/)?.[1];
  if (!proposalId) throw new Error(`could not extract proposal id: ${proposalOut}`);
  const proposal = json(join(kernelHome, 'inbox', 'pending', `${proposalId}.json`));
  if (JSON.stringify(proposal.files) !== JSON.stringify(['test/smoke.mjs'])) {
    throw new Error(`proposal files were not normalized: ${JSON.stringify(proposal)}`);
  }

  const failureOut = runPublic(
    env,
    project,
    'failure',
    'capture',
    '--from',
    'test-agent',
    '--type',
    'test-failure',
    '--signature',
    'ERR_FILE_REFERENCE_TEST',
    '--command',
    'npm test',
    '--text',
    'The CLI fixture failed.',
    '--files',
    `${absoluteCli},src/cli.mjs`
  );
  const failureId = failureOut.match(/(?:Captured|Updated existing) failure lesson:\s*(\S+)/)?.[1];
  if (!failureId) throw new Error(`could not extract failure id: ${failureOut}`);
  const failure = json(join(kernelHome, 'source', 'failures', 'failure-lessons.json')).find((record) => record.id === failureId);
  if (JSON.stringify(failure.files) !== JSON.stringify(['src/cli.mjs'])) {
    throw new Error(`failure files were not normalized: ${JSON.stringify(failure)}`);
  }
  if (JSON.stringify(failure.evidence?.filesTouched) !== JSON.stringify(['src/cli.mjs'])) {
    throw new Error(`failure evidence files were not normalized: ${JSON.stringify(failure)}`);
  }

  const promotedOut = runPublic(env, project, 'failure', 'propose', failureId, '--as', 'rule');
  const promotedId = promotedOut.match(/Created pending memory proposal:\s*(\S+)/)?.[1];
  if (!promotedId) throw new Error(`could not extract promoted proposal id: ${promotedOut}`);
  const promoted = json(join(kernelHome, 'inbox', 'pending', `${promotedId}.json`));
  if (JSON.stringify(promoted.files) !== JSON.stringify(['src/cli.mjs'])) {
    throw new Error(`failure promotion did not carry files: ${JSON.stringify(promoted)}`);
  }

  const fakeSecret = 'sk-' + 'abcdefghijklmnopqrstuvwxyz1234567890';
  const episodeOut = runPublic(
    env,
    project,
    'episode',
    'add',
    '--title',
    'File reference episode',
    '--text',
    `Worked on src/cli.mjs with ${fakeSecret}`,
    '--files',
    absoluteCli
  );
  const episodeId = episodeOut.match(/Saved episode:\s*(\S+)/)?.[1];
  if (!episodeId) throw new Error(`could not extract episode id: ${episodeOut}`);
  const episodePath = join(kernelHome, 'episodes', 'archive', `${episodeId}.json`);
  const episodeText = readFileSync(episodePath, 'utf8');
  const episode = JSON.parse(episodeText);
  if (JSON.stringify(episode.files) !== JSON.stringify(['src/cli.mjs'])) {
    throw new Error(`episode files were not normalized: ${episodeText}`);
  }
  assertNotContains(episodeText, fakeSecret, 'episode with file references persisted a raw secret');
  assertContains(episodeText, '[REDACTED_SECRET]', 'episode with file references lost redaction behavior');
  const compactEpisode = json(join(kernelHome, 'episodes', 'index.json')).episodes.find((record) => record.id === episodeId);
  if (JSON.stringify(compactEpisode.files) !== JSON.stringify(['src/cli.mjs'])) {
    throw new Error(`episode index did not preserve files: ${JSON.stringify(compactEpisode)}`);
  }

  const sessionOut = runPublic(env, project, 'session', 'start', '--agent', 'test-agent', '--project', project, '--json');
  const session = JSON.parse(sessionOut);
  runPublic(
    env,
    project,
    'session',
    'observe',
    session.id,
    '--type',
    'file_edit',
    '--text',
    'Edited the CLI fixture.',
    '--files',
    `${absoluteCli},./src/cli.mjs`
  );
  const observationLine = readFileSync(join(kernelHome, 'runtime', 'sessions', `${session.id}.jsonl`), 'utf8').trim();
  const observation = JSON.parse(observationLine);
  if (JSON.stringify(observation.files) !== JSON.stringify(['src/cli.mjs'])) {
    throw new Error(`session observation files were not normalized: ${observationLine}`);
  }

  const oldRecord = {
    id: 'legacy-memory-without-files',
    type: 'project-note',
    scope: 'project',
    level: 'note',
    text: 'Legacy records remain valid without a files field.',
    targets: ['all'],
    tags: ['legacy'],
    status: 'approved',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1
  };
  const notes = json(projectNotesPath);
  notes.push(oldRecord);
  writeFileSync(projectNotesPath, JSON.stringify(notes, null, 2) + '\n');
  assertContains(runPublic(env, project, 'validate'), 'validation: OK', 'legacy memory without files failed validation');

  const memorySearch = JSON.parse(runPublic(env, project, 'memory', 'search', '--files', absoluteCli, '--json'));
  if (!memorySearch.some((record) => record.id === memoryId) || memorySearch.some((record) => record.id === oldRecord.id)) {
    throw new Error(`memory file filter returned incorrect records: ${JSON.stringify(memorySearch)}`);
  }

  const failureSearch = JSON.parse(runPublic(env, project, 'failure', 'search', '--files', './src/cli.mjs', '--json'));
  if (!failureSearch.some((record) => record.id === failureId)) {
    throw new Error(`failure file filter missed record: ${JSON.stringify(failureSearch)}`);
  }

  const episodeSearch = JSON.parse(runPublic(env, project, 'episode', 'search', '--files', absoluteCli, '--json'));
  if (!episodeSearch.some((record) => record.id === episodeId)) {
    throw new Error(`episode file filter missed record: ${JSON.stringify(episodeSearch)}`);
  }

  const observations = JSON.parse(runPublic(env, project, 'session', 'observations', session.id, '--files', absoluteCli, '--json'));
  if (!observations.observations.some((record) => record.id === observation.id)) {
    throw new Error(`session file filter missed observation: ${JSON.stringify(observations)}`);
  }

  runPublic(env, project, 'compile', '--files', absoluteCli, '--budget', '1200');
  const compiledFileContext = join(kernelHome, 'dist', 'file-context.md');
  if (!existsSync(compiledFileContext)) throw new Error('compile --files did not write dist/file-context.md');
  assertContains(readFileSync(compiledFileContext, 'utf8'), 'Use the focused CLI patch path.', 'compiled file context missed matching memory');

  const schemaDir = join(kernelHome, 'source', 'schemas');
  for (const name of [
    'memory.schema.json',
    'proposal.schema.json',
    'episode.schema.json',
    'failure-lesson.schema.json',
    'session-observation.schema.json',
    'commit-record.schema.json'
  ]) {
    if (!readdirSync(schemaDir).includes(name)) throw new Error(`missing file-reference schema: ${name}`);
    const schema = json(join(schemaDir, name));
    if (!schema.properties?.files) throw new Error(`schema does not describe optional files: ${name}`);
    if (Array.isArray(schema.required) && schema.required.includes('files')) {
      throw new Error(`schema made files mandatory and broke old records: ${name}`);
    }
  }
}

export const name = 'file-references';
