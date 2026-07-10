#!/usr/bin/env node
import childProcess from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const wrapperPath = path.join(here, 'agent-kernel.mjs');
const searchPath = path.join(here, 'agent-kernel-search.mjs');
const mcpPath = path.join(here, 'agent-kernel-mcp.mjs');
const commitPath = path.join(here, 'agent-kernel-commit.mjs');
const args = process.argv.slice(2);
const command = args[0];
const commitLinkHook = command === 'git-hook' && args[1] === 'install' && args.includes('--commit-link');
const target = command === 'search' || command === 'reindex'
  ? searchPath
  : command === 'mcp'
    ? mcpPath
    : command === 'commit' || commitLinkHook
      ? commitPath
      : wrapperPath;
const targetArgs = args;
const result = childProcess.spawnSync(process.execPath, [target, ...targetArgs], {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit'
});
if (result.error) {
  process.stderr.write(`${result.error.message}\n`);
  process.exit(1);
}
process.exit(result.status ?? 1);
