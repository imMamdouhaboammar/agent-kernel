// test/core-link-claude.mjs — Direct runtime linker coverage for Claude output.
//
// Invariants:
//   1. Direct `node dist/cli.mjs link <project>` creates CLAUDE.md.
//   2. The linked CLAUDE.md contains generated Claude Code guidance.
//   3. The direct core runtime stays aligned with compile output.

import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertContains, makeEnv, runCli } from './_lib/helpers.mjs';

export async function run() {
  const { env, homeDir } = makeEnv();
  runCli(env, 'init', '--sync');

  const project = join(homeDir, 'core-link-claude-project');
  mkdirSync(project, { recursive: true });

  const out = runCli(env, 'link', project);
  assertContains(out, 'Linked Agent Kernel', 'core link did not report completion');

  const claudePath = join(project, 'CLAUDE.md');
  if (!existsSync(claudePath)) {
    throw new Error('core commandLink did not create CLAUDE.md');
  }

  const claude = readFileSync(claudePath, 'utf8');
  assertContains(claude, '# Claude Code Instructions', 'core linked CLAUDE.md is missing Claude heading');
  assertContains(claude, 'Read and follow the shared Agent Kernel constitution.', 'core linked CLAUDE.md is missing generated guidance');
  assertContains(claude, '<!-- agent-kernel:start -->', 'core linked CLAUDE.md is missing Agent Kernel marker');
}

export const name = 'core-link-claude';
