// test/public-cli-portability.mjs
//
// Invariants:
//   1. Retention dry-run writes no deletion and actual prune removes raw observations only.
//   2. Session compaction is deterministic and does not create approved memory.
//   3. Export includes schema and redaction metadata and never leaks secrets.
//   4. Import validates the schema and defaults to pending inbox proposals.
//   5. Repeated import reports conflicts instead of overwriting local memory.
//   6. Terminal view and static HTML reporting work offline with no external assets.
//   7. Prune and import operations create audit records.

import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { makeEnv, repo, runCli } from './_lib/helpers.mjs';

const publicCli = path.join(repo.root, 'bin', 'agent-kernel-router.mjs');

function runPublic(env, ...args) {
  return childProcess.execFileSync(process.execPath, [publicCli, ...args], {
    cwd: repo.root,
    env,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
}

function runPublicFailure(env, ...args) {
  try {
    runPublic(env, ...args);
    return { status: 0, stdout: '', stderr: '' };
  } catch (error) {
    return {
      status: error.status || 1,
      stdout: String(error.stdout || ''),
      stderr: String(error.stderr || '')
    };
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

function approvedText(kernelHome) {
  const dir = path.join(kernelHome, 'source', 'memories');
  return fs.readdirSync(dir).filter((name) => name.endsWith('.json')).map((name) => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
}

function sessionFixture(id, timestamp, agentId = 'codex') {
  return {
    id,
    projectId: 'agent-kernel',
    cwd: repo.root,
    agentId,
    createdBy: agentId,
    trustLevel: 'propose-only',
    startedAt: timestamp,
    updatedAt: timestamp,
    endedAt: timestamp,
    status: 'completed',
    observationCount: 3,
    linkedCommits: [],
    linkedFailures: [],
    linkedEpisodes: [],
    summary: ''
  };
}

function observations(id, timestamp) {
  return [
    { id: `${id}_1`, sessionId: id, timestamp, agentId: 'codex', projectId: 'agent-kernel', type: 'user_prompt', files: [], command: '', exitCode: null, text: 'Add local retention and portability commands.' },
    { id: `${id}_2`, sessionId: id, timestamp, agentId: 'codex', projectId: 'agent-kernel', type: 'file_edit', files: ['bin/agent-kernel-portability.mjs'], command: '', exitCode: null, text: 'Implemented the local command surface.' },
    { id: `${id}_3`, sessionId: id, timestamp, agentId: 'codex', projectId: 'agent-kernel', type: 'test_failure', files: ['test/public-cli-portability.mjs'], command: 'npm test', exitCode: 1, text: 'Focused fixture failure before the final correction.' }
  ];
}

export async function run() {
  const source = makeEnv();
  runCli(source.env, 'init', '--sync');
  const sessionsDir = path.join(source.kernelHome, 'runtime', 'sessions');
  fs.mkdirSync(sessionsDir, { recursive: true });

  const fakeSecret = 'ghp_' + 'abcdefghijklmnopqrstuvwxyz123456';
  const notesPath = path.join(source.kernelHome, 'source', 'memories', 'project-notes.json');
  const notes = JSON.parse(fs.readFileSync(notesPath, 'utf8'));
  notes.push({
    id: 'portable-custom-memory',
    type: 'project-note',
    scope: 'project',
    projectId: 'agent-kernel',
    level: 'note',
    status: 'approved',
    text: `Portable custom memory with ${fakeSecret}`,
    targets: ['all'],
    tags: ['portability-test'],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    version: 1
  });
  fs.writeFileSync(notesPath, JSON.stringify(notes, null, 2) + '\n');

  const oldId = 'session_portability_old';
  const recentId = 'session_portability_recent';
  const oldTime = '2025-01-01T00:00:00.000Z';
  const recentTime = new Date().toISOString();
  writeJson(path.join(sessionsDir, `${oldId}.json`), sessionFixture(oldId, oldTime));
  writeJson(path.join(sessionsDir, `${recentId}.json`), sessionFixture(recentId, recentTime));
  fs.writeFileSync(path.join(sessionsDir, `${oldId}.jsonl`), observations(oldId, oldTime).map(JSON.stringify).join('\n') + '\n');
  fs.writeFileSync(path.join(sessionsDir, `${recentId}.jsonl`), observations(recentId, recentTime).map(JSON.stringify).join('\n') + '\n');

  const approvedBefore = approvedText(source.kernelHome);
  const compactPreview = JSON.parse(runPublic(source.env, 'session', 'compact', oldId, '--dry-run', '--json'));
  if (!compactPreview.dryRun || compactPreview.summary.observationCount !== 3) {
    throw new Error(`session compaction preview failed: ${JSON.stringify(compactPreview)}`);
  }
  const beforeCompactSession = JSON.parse(fs.readFileSync(path.join(sessionsDir, `${oldId}.json`), 'utf8'));
  if (beforeCompactSession.compactSummary) throw new Error('session compact dry-run wrote session state');

  const compacted = JSON.parse(runPublic(source.env, 'session', 'compact', oldId, '--json'));
  if (compacted.dryRun || !compacted.rawLogRetained || compacted.summary.files[0] !== 'bin/agent-kernel-portability.mjs') {
    throw new Error(`session compaction result was incorrect: ${JSON.stringify(compacted)}`);
  }
  const compactedSession = JSON.parse(fs.readFileSync(path.join(sessionsDir, `${oldId}.json`), 'utf8'));
  if (!compactedSession.compactSummary || compactedSession.compactedObservationCount !== 3) {
    throw new Error(`compacted session metadata was not stored: ${JSON.stringify(compactedSession)}`);
  }
  if (approvedText(source.kernelHome) !== approvedBefore) {
    throw new Error('session compaction changed approved memory');
  }

  const status = JSON.parse(runPublic(source.env, 'retention', 'status', '--older-than', '30d', '--json'));
  if (status.rawLogCount !== 2 || status.eligibleCount !== 1) {
    throw new Error(`retention status returned incorrect eligibility: ${JSON.stringify(status)}`);
  }

  const dryRun = JSON.parse(runPublic(source.env, 'retention', 'prune', '--older-than', '30d', '--dry-run', '--json'));
  if (!dryRun.dryRun || dryRun.matched !== 1 || dryRun.deleted !== 0) {
    throw new Error(`retention dry-run returned incorrect result: ${JSON.stringify(dryRun)}`);
  }
  if (!fs.existsSync(path.join(sessionsDir, `${oldId}.jsonl`))) throw new Error('retention dry-run deleted the old log');

  const needsForce = runPublicFailure(source.env, 'retention', 'prune', '--older-than', '30d');
  if (needsForce.status === 0 || !needsForce.stderr.includes('--force')) {
    throw new Error(`retention prune did not require explicit force: ${JSON.stringify(needsForce)}`);
  }

  const pruned = JSON.parse(runPublic(source.env, 'retention', 'prune', '--older-than', '30d', '--force', '--json'));
  if (pruned.deleted !== 1 || fs.existsSync(path.join(sessionsDir, `${oldId}.jsonl`))) {
    throw new Error(`retention prune did not delete the eligible raw log: ${JSON.stringify(pruned)}`);
  }
  if (!fs.existsSync(path.join(sessionsDir, `${oldId}.json`)) || !fs.existsSync(path.join(sessionsDir, `${recentId}.jsonl`))) {
    throw new Error('retention prune removed summary metadata or a recent log');
  }
  if (approvedText(source.kernelHome) !== approvedBefore) throw new Error('retention prune changed approved memory');
  if (!fs.existsSync(path.join(source.kernelHome, 'source', 'failures', 'failure-lessons.json'))) throw new Error('retention prune removed Failure Lessons');

  const backupPath = path.join(source.homeDir, 'agent-kernel-backup.json');
  const exported = JSON.parse(runPublic(source.env, 'export', backupPath, '--redact', '--include-observations', '--json'));
  if (!exported.ok || exported.schemaVersion !== 1 || exported.redactionMode !== 'explicit') {
    throw new Error(`export metadata was incorrect: ${JSON.stringify(exported)}`);
  }
  const backupText = fs.readFileSync(backupPath, 'utf8');
  if (backupText.includes(fakeSecret) || !backupText.includes('[REDACTED_SECRET]')) {
    throw new Error('export did not redact the secret by default');
  }
  const backup = JSON.parse(backupText);
  if (backup.format !== 'agent-kernel-export' || backup.schemaVersion !== 1 || !backup.exportedAt || !backup.data?.memories) {
    throw new Error(`export schema was incomplete: ${backupText.slice(0, 500)}`);
  }

  const target = makeEnv();
  runCli(target.env, 'init', '--sync');
  const inspect = JSON.parse(runPublic(target.env, 'import', backupPath, '--inspect', '--json'));
  if (inspect.schemaVersion !== 1 || inspect.memoryRecords < 1) {
    throw new Error(`import inspection failed: ${JSON.stringify(inspect)}`);
  }
  const targetApprovedBefore = approvedText(target.kernelHome);
  const imported = JSON.parse(runPublic(target.env, 'import', backupPath, '--json'));
  if (!imported.ok || imported.mode !== 'inbox' || imported.created < 1) {
    throw new Error(`review-first import failed: ${JSON.stringify(imported)}`);
  }
  if (approvedText(target.kernelHome) !== targetApprovedBefore) {
    throw new Error('default import wrote approved memory instead of inbox proposals');
  }
  const pendingFiles = fs.readdirSync(path.join(target.kernelHome, 'inbox', 'pending')).filter((name) => name.endsWith('.json'));
  if (!pendingFiles.length) throw new Error('default import did not create pending proposals');
  const importedProposalText = pendingFiles.map((name) => fs.readFileSync(path.join(target.kernelHome, 'inbox', 'pending', name), 'utf8')).join('\n');
  if (!importedProposalText.includes('portable-custom-memory') || importedProposalText.includes(fakeSecret)) {
    throw new Error('imported proposal omitted source evidence or reintroduced a secret');
  }

  const repeatedImport = JSON.parse(runPublic(target.env, 'import', backupPath, '--json'));
  if (repeatedImport.conflicts.length < 1 || repeatedImport.created >= imported.created) {
    throw new Error(`repeated import did not report conflicts: ${JSON.stringify(repeatedImport)}`);
  }

  const invalidPath = path.join(source.homeDir, 'invalid-backup.json');
  writeJson(invalidPath, { format: 'agent-kernel-export', schemaVersion: 999, data: { memories: {} } });
  const invalidImport = runPublicFailure(target.env, 'import', invalidPath, '--json');
  if (invalidImport.status === 0 || !invalidImport.stderr.includes('Unsupported export schema version')) {
    throw new Error(`invalid import schema was accepted: ${JSON.stringify(invalidImport)}`);
  }

  const view = runPublic(source.env, 'view');
  if (!view.includes('Agent Kernel local view') || !view.includes('Approved memory:')) {
    throw new Error(`terminal viewer output was incomplete: ${view}`);
  }
  const viewJson = JSON.parse(runPublic(source.env, 'view', '--json'));
  if (!Array.isArray(viewJson.sessions) || !Array.isArray(viewJson.hotspots)) {
    throw new Error(`terminal viewer JSON was incomplete: ${JSON.stringify(viewJson)}`);
  }

  const reportPath = path.join(source.homeDir, 'agent-kernel-report.html');
  const report = JSON.parse(runPublic(source.env, 'report', reportPath, '--json'));
  if (!report.ok || report.externalAssets !== false || !report.generatedAt) {
    throw new Error(`report metadata was incorrect: ${JSON.stringify(report)}`);
  }
  const html = fs.readFileSync(reportPath, 'utf8');
  if (!html.includes('<!doctype html>') || !html.includes('Agent Kernel Local Report')) {
    throw new Error('static report was not valid HTML');
  }
  if (/https?:\/\//i.test(html) || /<script/i.test(html) || html.includes(fakeSecret)) {
    throw new Error('static report contains an external asset, script, or secret');
  }

  const sourceAudit = fs.readFileSync(path.join(source.kernelHome, 'logs', 'audit.jsonl'), 'utf8');
  for (const operation of ['session.compact', 'retention.prune.dry-run', 'retention.prune', 'export.create', 'report.generate']) {
    if (!sourceAudit.includes(operation)) throw new Error(`source audit log omitted ${operation}`);
  }
  const targetAudit = fs.readFileSync(path.join(target.kernelHome, 'logs', 'audit.jsonl'), 'utf8');
  if (!targetAudit.includes('import.inbox')) throw new Error('import operation was not audited');
  if (sourceAudit.includes(fakeSecret) || targetAudit.includes(fakeSecret)) throw new Error('audit logs leaked a secret');
}

export const name = 'public-cli-portability';
