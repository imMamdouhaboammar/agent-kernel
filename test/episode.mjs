// test/episode.mjs — Episode commands: add, search, show, reindex.
//
// Invariants:
//   1. `episode add --title ... --text ...` writes an episode JSON.
//   2. `episode search <keyword>` finds the episode by title.
//   3. `episode show <id>` returns the full episode text.
//   4. `episode reindex` rebuilds episodes/index.json from episodes/archive/.
//   5. `episode stats` reports at least the count.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertContains, makeEnv, runCli } from './_lib/helpers.mjs';

export async function run() {
  const { env, kernelHome } = makeEnv();
  runCli(env, 'init', '--sync');

  // 1. add an episode.
  const title = `Smoke decision ${Date.now()}`;
  const text = `We chose pnpm and avoided SQLite fallback in this test.`;
  const tag = `ep-test-${Date.now()}`;
  const addOut = runCli(env, 'episode', 'add', '--title', title, '--tags', tag, '--text', text);
  assertContains(addOut, 'Saved episode', 'episode add did not confirm save');

  // 2. search finds it.
  const searchOut = runCli(env, 'episode', 'search', tag);
  assertContains(searchOut, title, `episode search "${tag}" did not return the title`);

  // 3. extract id from search output and show.
  const idMatch = searchOut.match(/episode_[0-9a-f]+/);
  if (!idMatch) throw new Error('could not extract episode id from search output');
  const id = idMatch[0];
  const showOut = runCli(env, 'episode', 'show', id);
  assertContains(showOut, text, 'episode show did not return the full text');

  // 4. reindex rebuilds the index.
  runCli(env, 'episode', 'reindex');
  const indexPath = join(kernelHome, 'episodes', 'index.json');
  if (!existsSync(indexPath)) {
    throw new Error(`episode reindex did not write ${indexPath}`);
  }
  const indexData = JSON.parse(readFileSync(indexPath, 'utf8'));
  if (!indexData.episodes || !Array.isArray(indexData.episodes)) {
    throw new Error('episodes/index.json has unexpected shape after reindex');
  }
  if (!indexData.episodes.find((e) => e.id === id)) {
    throw new Error('rebuilt index is missing the just-added episode');
  }

  // 5. stats reports the episode count.
  const statsOut = runCli(env, 'episode', 'stats');
  assertContains(statsOut, '"episodes": 1', 'episode stats did not report count=1');
}

export const name = 'episode';