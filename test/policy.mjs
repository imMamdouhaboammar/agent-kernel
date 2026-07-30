// test/policy.mjs — Verify mandatory-bun-package-manager policy and validations.
//

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { assertContains, assertNotContains, makeEnv, runCli, repo } from './_lib/helpers.mjs';

function driveHook(env, command, cwd = env.HOME) {
  const hookInput = JSON.stringify({
    cwd, // Top-level cwd read by commandHook
    tool_name: 'Bash',
    tool_input: { command, cwd }
  });
  return execFileSync(
    process.execPath,
    [join(repo.root, 'dist', 'cli.mjs'), 'hook', 'pre-tool-use'],
    {
      cwd: repo.root,
      env,
      input: hookInput,
      encoding: 'utf8'
    }
  );
}

export async function run() {
  const { env, homeDir } = makeEnv();
  runCli(env, 'init', '--sync');

  // 1. Verify npm install is BLOCKED and suggests bun install.
  const npmOut = driveHook(env, 'npm install');
  assertContains(npmOut, 'permissionDecision', 'hook did not return permissionDecision for npm');
  assertContains(npmOut, 'deny', 'hook did not deny npm install');
  assertContains(npmOut, 'mandatory-bun-package-manager', 'hook did not cite mandatory-bun-package-manager');
  assertContains(npmOut, 'bun install', 'hook did not translate to bun install');

  // 2. Verify npx eslint is BLOCKED and suggests bunx eslint.
  const npxOut = driveHook(env, 'npx eslint --fix');
  assertContains(npxOut, 'deny', 'hook did not deny npx eslint');
  assertContains(npxOut, 'bunx eslint --fix', 'hook did not translate to bunx eslint');

  // 3. Verify env npm install is BLOCKED.
  const envNpmOut = driveHook(env, 'env npm install');
  assertContains(envNpmOut, 'deny', 'hook did not deny env npm install');

  // 4. Verify absolute path and spacer/IFS tricks are BLOCKED.
  const absoluteNpmOut = driveHook(env, '/usr/bin/npm install');
  assertContains(absoluteNpmOut, 'deny', 'hook did not deny absolute path npm install');

  const ifsNpmOut = driveHook(env, 'npm$IFSinstall');
  assertContains(ifsNpmOut, 'deny', 'hook did not deny npm with IFS spacer trick');

  // 5. Verify subshells are BLOCKED.
  const subshellNpmOut = driveHook(env, 'sh -c "npm install"');
  assertContains(subshellNpmOut, 'deny', 'hook did not deny npm inside sh -c');

  // 6. Verify Node runtime commands are ALLOWED.
  const nodeOut = driveHook(env, 'node server.js');
  assertNotContains(nodeOut, '"permissionDecision":"deny"', 'hook wrongly denied safe node execution');

  // 7. Verify registry URLs are ALLOWED.
  const registryOut = driveHook(env, 'bun install --registry=https://registry.npmjs.org/');
  assertNotContains(registryOut, '"permissionDecision":"deny"', 'hook wrongly denied bun install with registry argument');

  // 8. Verify pnpm is BLOCKED without exception.
  const pnpmOut = driveHook(env, 'pnpm install', homeDir);
  assertContains(pnpmOut, 'deny', 'hook did not deny pnpm install without exception');
  assertContains(pnpmOut, 'No valid repository-scoped exception was found', 'hook did not state exception requirement');

  // 9. Verify pnpm is ALLOWED with a VALID exception.
  const akDir = join(homeDir, '.agent-kernel');
  mkdirSync(akDir, { recursive: true });
  
  const validException = {
    policy: 'mandatory-bun-package-manager',
    packageManager: 'pnpm',
    repository: homeDir,
    reasonCode: 'verified_bun_failure',
    reason: 'Bun fails to compile Rolldown on this macOS environment with segfaults',
    bunVersion: '1.3.14',
    bunCommand: 'bun install',
    bunErrorSummary: 'Segmentation fault: 11',
    evidence: ['https://github.com/bun/bun/issues/1234'],
    scope: homeDir,
    createdAt: new Date().toISOString(),
    reviewAfter: new Date(Date.now() + 86400000).toISOString(), // 1 day in future
    approvedBy: 'user'
  };
  writeFileSync(join(akDir, 'package-manager-exception.json'), JSON.stringify(validException, null, 2));

  // Initialize git repo inside homeDir to support gitRoot resolver in tests
  try {
    execFileSync('git', ['init'], { cwd: homeDir });
  } catch {
    // Ignore if git fails (e.g. sandbox environment restriction)
  }

  const allowedPnpm = driveHook(env, 'pnpm install', homeDir);
  assertNotContains(allowedPnpm, '"permissionDecision":"deny"', 'hook wrongly denied pnpm with a valid exception');

  // 10. Verify expired exception is BLOCKED.
  const expiredException = { ...validException, reviewAfter: new Date(Date.now() - 1000).toISOString() }; // 1s in past
  writeFileSync(join(akDir, 'package-manager-exception.json'), JSON.stringify(expiredException, null, 2));

  const blockedExpired = driveHook(env, 'pnpm install', homeDir);
  assertContains(blockedExpired, 'deny', 'hook did not deny pnpm install with expired exception');
  assertContains(blockedExpired, 'exception has expired', 'hook did not attribute block to expired exception');

  // 11. Verify invalid reason code exception is BLOCKED.
  const badReasonException = { ...validException, reasonCode: 'i_like_pnpm' };
  writeFileSync(join(akDir, 'package-manager-exception.json'), JSON.stringify(badReasonException, null, 2));

  const blockedBadReason = driveHook(env, 'pnpm install', homeDir);
  assertContains(blockedBadReason, 'deny', 'hook did not deny pnpm with invalid reasonCode');
}

export const name = 'policy';
