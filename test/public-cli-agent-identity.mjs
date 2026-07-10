// test/public-cli-agent-identity.mjs
//
// Invariants:
//   1. Agent identities and trust levels are stored locally.
//   2. Unknown session agents default to capture-only, not propose-only.
//   3. New sessions, observations, and proposals include agent identity fields.
//   4. Search and session views can filter by agent.
//   5. Historical records without the new top-level fields remain readable.
//   6. trusted-local does not approve or publish memory automatically.

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

export async function run() {
  const { env, kernelHome } = makeEnv();
  runCli(env, 'init', '--sync');

  const custom = JSON.parse(runPublic(
    env,
    'session', 'start',
    '--agent', 'my-custom-agent',
    '--project', repo.root,
    '--json'
  ));
  if (custom.agentId !== 'my-custom-agent' || custom.trustLevel !== 'capture-only') {
    throw new Error(`unknown session agent did not default conservatively: ${JSON.stringify(custom)}`);
  }
  const customSessionPath = path.join(kernelHome, 'runtime', 'sessions', `${custom.id}.json`);
  const persistedCustom = JSON.parse(fs.readFileSync(customSessionPath, 'utf8'));
  if (persistedCustom.agentIdentity?.agentId !== 'my-custom-agent' || persistedCustom.createdBy !== 'my-custom-agent') {
    throw new Error(`persisted session omitted embedded identity: ${JSON.stringify(persistedCustom)}`);
  }

  runPublic(
    env,
    'session', 'observe', custom.id,
    '--type', 'manual_note',
    '--text', 'Identity filter observation',
    '--file', 'src/cli.mjs',
    '--json'
  );
  const observations = JSON.parse(runPublic(
    env,
    'session', 'observations', custom.id,
    '--agent', 'my-custom-agent',
    '--json'
  ));
  if (observations.observations.length !== 1 || observations.observations[0].agentId !== 'my-custom-agent') {
    throw new Error(`observation identity or filter failed: ${JSON.stringify(observations)}`);
  }

  const codex = JSON.parse(runPublic(
    env,
    'session', 'start',
    '--agent', 'codex',
    '--project', repo.root,
    '--json'
  ));
  const customSessions = JSON.parse(runPublic(env, 'session', 'list', '--agent', 'my-custom-agent', '--json'));
  if (customSessions.sessions.length !== 1 || customSessions.sessions[0].id !== custom.id) {
    throw new Error(`session agent filter returned the wrong sessions: ${JSON.stringify(customSessions)}`);
  }
  const codexSessions = JSON.parse(runPublic(env, 'session', 'list', '--agent', 'codex', '--json'));
  if (codexSessions.sessions.length !== 1 || codexSessions.sessions[0].id !== codex.id) {
    throw new Error(`built-in session filter failed: ${JSON.stringify(codexSessions)}`);
  }

  const proposalText = 'Keep identity-aware proposal records local and reviewable.';
  const proposalOutput = runPublic(
    env,
    'propose',
    '--from', 'codex',
    '--type', 'rule',
    '--text', proposalText,
    '--reason', 'Identity model smoke test'
  );
  const proposalId = proposalOutput.match(/Created pending memory proposal:\s*(\S+)/)?.[1];
  if (!proposalId) throw new Error(`proposal id missing: ${proposalOutput}`);
  const proposalPath = path.join(kernelHome, 'inbox', 'pending', `${proposalId}.json`);
  const proposal = JSON.parse(fs.readFileSync(proposalPath, 'utf8'));
  if (proposal.createdBy !== 'codex' || proposal.agentId !== 'codex' || proposal.source?.createdBy !== 'codex') {
    throw new Error(`proposal identity fields were not stored: ${JSON.stringify(proposal)}`);
  }
  if (proposal.trustLevel !== 'propose-only' || proposal.status !== 'pending') {
    throw new Error(`proposal trust or approval boundary is wrong: ${JSON.stringify(proposal)}`);
  }

  const unknownProposal = runPublicFailure(
    env,
    'propose',
    '--from', 'unregistered-proposer',
    '--text', 'This unknown agent should not propose.',
    '--reason', 'Negative trust test'
  );
  if (unknownProposal.status === 0 || !unknownProposal.stderr.includes('cannot create proposals')) {
    throw new Error(`unknown agent proposal was not denied safely: ${JSON.stringify(unknownProposal)}`);
  }

  const trustedOutput = runPublic(
    env,
    'propose',
    '--from', 'agent-kernel',
    '--text', 'Trusted local still creates pending proposals only.',
    '--reason', 'Approval ownership test'
  );
  const trustedId = trustedOutput.match(/Created pending memory proposal:\s*(\S+)/)?.[1];
  const trustedPath = path.join(kernelHome, 'inbox', 'pending', `${trustedId}.json`);
  const trusted = JSON.parse(fs.readFileSync(trustedPath, 'utf8'));
  if (trusted.trustLevel !== 'trusted-local' || trusted.status !== 'pending') {
    throw new Error(`trusted-local bypassed user-owned approval: ${JSON.stringify(trusted)}`);
  }

  const registryPath = path.join(kernelHome, 'source', 'agents', 'agents.json');
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  const unknownRecord = registry.agents.find((item) => item.agentId === 'my-custom-agent');
  if (!unknownRecord || unknownRecord.trustLevel !== 'capture-only') {
    throw new Error(`unknown agent identity was not stored locally: ${JSON.stringify(registry)}`);
  }

  const historicalSession = {
    id: 'historical_agent_session',
    projectId: 'agent-kernel',
    cwd: repo.root,
    agent: 'cursor',
    startedAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    status: 'completed',
    summary: 'Historical identity signal',
    observationCount: 0
  };
  writeJson(path.join(kernelHome, 'runtime', 'sessions', `${historicalSession.id}.json`), historicalSession);

  const failures = [
    {
      id: 'identity_search_codex',
      status: 'captured',
      agent: 'codex',
      project: 'agent-kernel',
      failureType: 'test-failure',
      errorSignature: 'IDENTITY_SEARCH_SIGNAL',
      rootCause: 'Identity search signal from Codex.',
      evidence: { outputExcerpt: 'shared identity signal' },
      occurrences: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'identity_search_cursor',
      status: 'captured',
      agent: 'cursor',
      project: 'agent-kernel',
      failureType: 'test-failure',
      errorSignature: 'IDENTITY_SEARCH_SIGNAL',
      rootCause: 'Identity search signal from Cursor.',
      evidence: { outputExcerpt: 'shared identity signal' },
      occurrences: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    }
  ];
  writeJson(path.join(kernelHome, 'source', 'failures', 'failure-lessons.json'), failures);
  runPublic(env, 'reindex');

  const search = JSON.parse(runPublic(env, 'search', 'shared identity signal', '--agent', 'codex', '--json'));
  if (search.count !== 1 || search.results[0]?.id !== 'identity_search_codex' || search.filters.agent !== 'codex') {
    throw new Error(`search agent filter failed: ${JSON.stringify(search)}`);
  }

  const historical = JSON.parse(runPublic(env, 'session', 'list', '--agent', 'cursor', '--json'));
  if (!historical.sessions.some((session) => session.id === historicalSession.id)) {
    throw new Error(`historical agent field was not backward compatible: ${JSON.stringify(historical)}`);
  }
}

export const name = 'public-cli-agent-identity';
