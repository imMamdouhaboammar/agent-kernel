#!/usr/bin/env node
import childProcess from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.resolve(here, '..', 'dist', 'cli.mjs');
const safeLinkPath = path.resolve(here, 'agent-kernel-safe-link.mjs');
const safeGitHookPath = path.resolve(here, 'agent-kernel-safe-git-hook.mjs');
const failurePath = path.resolve(here, 'agent-kernel-failure.mjs');

function runNode(scriptPath, args) {
  const result = childProcess.spawnSync(process.execPath, [scriptPath, ...args], {
    stdio: 'inherit',
    env: process.env,
    cwd: process.cwd()
  });
  if (typeof result.status === 'number') process.exit(result.status);
  if (result.error) {
    process.stderr.write(`${result.error.message}\n`);
    process.exit(1);
  }
  process.exit(0);
}

function splitLinkArgs(args) {
  const linkArgs = [];
  let installHooks = false;
  for (const arg of args) {
    if (arg === '--hooks' || arg === '--enforce') {
      installHooks = true;
      continue;
    }
    linkArgs.push(arg);
  }
  return { linkArgs, installHooks };
}

function main() {
  const args = process.argv.slice(2);
  const [command, subcommand, ...rest] = args;

  if (command === 'link') {
    const { linkArgs, installHooks } = splitLinkArgs(args.slice(1));
    const linkResult = childProcess.spawnSync(process.execPath, [safeLinkPath, ...linkArgs], {
      stdio: 'inherit',
      env: process.env,
      cwd: process.cwd()
    });
    if (linkResult.status !== 0) process.exit(linkResult.status ?? 1);
    if (installHooks) runNode(safeGitHookPath, linkArgs.filter(arg => !arg.startsWith('--')));
    process.exit(0);
  }

  if (command === 'failure') {
    runNode(failurePath, args.slice(1));
  }

  if (command === 'git-hook' && subcommand === 'install') {
    runNode(safeGitHookPath, rest);
  }

  runNode(cliPath, args);
}

main();
