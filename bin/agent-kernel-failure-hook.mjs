#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import childProcess from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const failureCli = path.resolve(here, 'agent-kernel-failure.mjs');

function readStdin() {
  try {
    if (process.stdin.isTTY) return '';
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function parsePayload(raw) {
  if (!raw.trim()) return {};
  try { return JSON.parse(raw); } catch { return { rawText: raw }; }
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function exitCodeOf(payload) {
  const candidates = [
    payload.exit_code,
    payload.exitCode,
    payload.tool_response?.exit_code,
    payload.tool_response?.exitCode,
    payload.result?.exit_code,
    payload.result?.exitCode,
    payload.response?.exit_code,
    payload.response?.exitCode
  ];
  for (const value of candidates) {
    if (value === 0) return 0;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function hasFailure(payload, text) {
  const code = exitCodeOf(payload);
  if (code !== null && code !== 0) return true;
  if (payload.error || payload.is_error || payload.failed) return true;
  return /\b(ERR_[A-Z0-9_]+|E[A-Z0-9_]{3,}|TS\d{4}|MODULE_NOT_FOUND|ReferenceError|TypeError|SyntaxError|failed|error:|cannot find module)\b/i.test(text);
}

function main() {
  const raw = readStdin();
  const payload = parsePayload(raw);
  const command = firstString(
    payload.command,
    payload.tool_input?.command,
    payload.input?.command,
    payload.tool_input?.cmd,
    payload.input?.cmd
  );
  const text = firstString(
    payload.stderr,
    payload.stdout,
    payload.error,
    payload.tool_response?.stderr,
    payload.tool_response?.stdout,
    payload.tool_response?.error,
    payload.result?.stderr,
    payload.result?.stdout,
    payload.result?.error,
    payload.rawText,
    raw
  );

  if (!hasFailure(payload, text)) {
    process.stdout.write('Agent Kernel failure hook: no failure captured.\n');
    return;
  }

  const args = [
    failureCli,
    'capture',
    '--from', process.env.AGENT_KERNEL_AGENT || 'claude-hook',
    '--type', command ? 'command-failure' : 'tool-failure',
    '--command', command,
    '--exit-code', String(exitCodeOf(payload) ?? ''),
    '--tags', 'hook,failure-lesson',
    '--text', text.slice(0, 120000)
  ];

  const result = childProcess.spawnSync(process.execPath, args, {
    encoding: 'utf8',
    env: process.env,
    cwd: process.cwd()
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status && result.status !== 0) process.exit(result.status);
}

main();
