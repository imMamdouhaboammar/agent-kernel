import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertContains, makeEnv, repo } from './_lib/helpers.mjs';

const router = join(repo.root, 'bin', 'agent-kernel-router.mjs');
function runRouter(env, cwd, ...args) {
  return execFileSync(process.execPath, [router, ...args], {
    cwd, env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe']
  });
}

export async function run() {
  const { env, homeDir } = makeEnv();
  const project = join(homeDir, 'architecture-router-project');
  mkdirSync(join(project, 'src'), { recursive: true });
  writeFileSync(join(project, 'src', 'value.ts'), 'export const value = 1;\n');
  const init = runRouter(env, project, 'architecture', 'init', project, '--json');
  assertContains(init, 'exceptionsFile', 'public architecture init should return initialized state');
  if (!existsSync(join(project, '.agent-kernel', 'architecture', 'policy.json'))) {
    throw new Error('public architecture route did not create policy.json');
  }
  const discover = runRouter(env, project, 'architecture', 'discover', project, '--json');
  assertContains(discover, 'src/value.ts', 'public architecture route should discover source files');
}

export const name = 'public-cli-architecture';
