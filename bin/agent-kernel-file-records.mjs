#!/usr/bin/env node
import childProcess from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const corePath = path.resolve(here, 'agent-kernel-file-records-core.mjs');
const schemaPath = path.resolve(here, 'agent-kernel-file-schema.mjs');

function run(scriptPath, args) {
  return childProcess.spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'pipe']
  });
}

const result = run(corePath, process.argv.slice(2));
const schemaResult = run(schemaPath, []);

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (schemaResult.stderr) process.stderr.write(schemaResult.stderr);

if (result.error) {
  process.stderr.write(`${result.error.message}\n`);
  process.exit(1);
}
if (schemaResult.error) {
  process.stderr.write(`${schemaResult.error.message}\n`);
  process.exit(1);
}
if (schemaResult.status !== 0) process.exit(schemaResult.status ?? 1);
process.exit(result.status ?? 0);
