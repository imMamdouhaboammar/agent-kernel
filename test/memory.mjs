// test/memory.mjs — Memory commands: remember, list, search, show,
// propose, inbox, approve, reject.
//
// Invariants:
//   1. `remember <text> --publish` adds a rule to source/memories/rules.json.
//   2. `memory list` lists the saved rule.
//   3. `memory search <keyword>` finds the saved rule.
//   4. `memory show <id>` returns the rule text.
//   5. `propose --from <agent>` writes to inbox/pending/.
//   6. `inbox` shows the pending proposal.
//   7. `approve <id> --publish` moves it to source/memories/.
//   8. `reject <id>` removes it from inbox/pending/.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { assertContains, assertNotContains, makeEnv, runCli } from './_lib/helpers.mjs';

export async function run() {
  const { env, kernelHome } = makeEnv();
  runCli(env, 'init', '--sync');

  // 1. remember --publish saves to rules.json.
  const ruleText = `Always run pnpm typecheck before finalizing TypeScript edits. [${Date.now()}]`;
  const tag = `test-${Date.now()}`;
  runCli(env, 'remember', ruleText, '--type', 'rule', '--level', 'standard', '--tags', tag, '--publish');

  const rulesPath = join(kernelHome, 'source', 'memories', 'rules.json');
  const rules = JSON.parse(readFileSync(rulesPath, 'utf8'));
  const saved = rules.find((r) => r.text === ruleText);
  if (!saved) {
    throw new Error(`rule was not saved to ${rulesPath}`);
  }
  const ruleId = saved.id;

  // 2. memory list shows it.
  const listOut = runCli(env, 'memory', 'list');
  assertContains(listOut, ruleId, 'memory list did not show the saved rule id');
  assertContains(listOut, ruleText, 'memory list did not show the saved rule text');

  // 3. memory search finds it.
  const searchOut = runCli(env, 'memory', 'search', tag);
  assertContains(searchOut, ruleId, `memory search "${tag}" did not find the rule id`);

  // 4. memory show returns the rule text.
  const showOut = runCli(env, 'memory', 'show', ruleId);
  assertContains(showOut, ruleText, 'memory show did not return the rule text');

  // 5 + 6. propose writes to inbox/pending/ and inbox lists it.
  const proposalText = `Proposals should require human approval. [${Date.now()}]`;
  runCli(env, 'propose', '--from', 'test-agent', '--type', 'rule', '--text', proposalText, '--reason', 'test');
  const inboxOut = runCli(env, 'inbox');
  assertContains(inboxOut, 'Pending memory proposals', 'inbox did not show the pending section');
  assertContains(inboxOut, proposalText, 'inbox did not show the proposal text');

  // 7. approve --publish moves it to source/memories/rules.json.
  // The inbox/pending/ folder is a directory of JSON files (one per
  // proposal), not a single file. Verify that at least one pending file
  // contains our proposal text before approving.
  const inboxPendingDir = join(kernelHome, 'inbox', 'pending');
  if (!existsSync(inboxPendingDir)) {
    throw new Error('inbox/pending/ directory missing after propose');
  }
  const pendingFiles = readdirSync(inboxPendingDir).filter((f) => f.endsWith('.json'));
  if (pendingFiles.length === 0) {
    throw new Error('no pending proposal JSON files were written');
  }
  const pendingTexts = pendingFiles.map((f) =>
    readFileSync(join(inboxPendingDir, f), 'utf8')
  );
  if (!pendingTexts.some((t) => t.includes(proposalText))) {
    throw new Error('pending proposal file missing the text');
  }

  // Extract the proposal id from inbox output (best-effort: first id-looking token).
  const idMatch = inboxOut.match(/rule_[0-9a-f_]+/);
  if (!idMatch) throw new Error('could not extract proposal id from inbox output');
  const proposalId = idMatch[0];

  runCli(env, 'approve', proposalId, '--publish');
  const rulesAfter = JSON.parse(readFileSync(rulesPath, 'utf8'));
  if (!rulesAfter.find((r) => r.text === proposalText)) {
    throw new Error('approve --publish did not move the proposal into rules.json');
  }

  // 8. reject also works — propose a 2nd one and reject it.
  const rejectText = `Should never be approved. [${Date.now()}]`;
  runCli(env, 'propose', '--from', 'test-agent', '--type', 'rule', '--text', rejectText, '--reason', 'test');
  const inboxOut2 = runCli(env, 'inbox');
  const idMatch2 = inboxOut2.match(/rule_[0-9a-f_]+/);
  if (!idMatch2) throw new Error('could not extract 2nd proposal id');
  runCli(env, 'reject', idMatch2[0]);

  // After reject, the rule should NOT appear in rules.json.
  const rulesFinal = JSON.parse(readFileSync(rulesPath, 'utf8'));
  if (rulesFinal.find((r) => r.text === rejectText)) {
    throw new Error('rejected proposal should not appear in rules.json');
  }
}

export const name = 'memory';