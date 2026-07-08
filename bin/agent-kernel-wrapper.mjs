#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import childProcess from 'node:child_process';
import { fileURLToPath } from 'node:url';

function hereDir() {
  return path.dirname(fileURLToPath(import.meta.url));
}

function rootDir() {
  return path.resolve(hereDir(), '..');
}

function nodeScript(relativePath) {
  return path.join(rootDir(), relativePath);
}

function runNodeScript(relativePath, args) {
  const script = nodeScript(relativePath);
  if (!fs.existsSync(script)) {
    process.stderr.write(`Missing Agent Kernel script: ${script}\n`);
    process.exit(1);
  }
  const result = childProcess.spawnSync(process.execPath, [script, ...args], {
    stdio: 'inherit',
    env: process.env,
    cwd: process.cwd()
  });
  if (result.error) {
    process.stderr.write(`${result.error.message}\n`);
    process.exit(1);
  }
  process.exit(result.status ?? 0);
}

function main() {
  const args = process.argv.slice(2);
  const [command, subcommand] = args;

  if (command === 'link') {
    runNodeScript('bin/agent-kernel-safe-link.mjs', args.slice(1));
  }

  if (command === 'git-hook' && subcommand === 'install') {
    runNodeScript('bin/agent-kernel-safe-git-hook.mjs', args.slice(2));
  }

  runNodeScript('dist/cli.mjs', args);
}

main();
