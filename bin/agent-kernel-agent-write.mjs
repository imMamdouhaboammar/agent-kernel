#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import childProcess from 'node:child_process';
import { fileURLToPath } from 'node:url';

function homeDir() {
  return process.env.AGENT_KERNEL_HOME || path.join(os.homedir(), '.agent-kernel');
}

function readJson(filePath, fallback) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return fallback; }
}

function parseArgs(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const raw = arg.slice(2);
      const eq = raw.indexOf('=');
      if (eq >= 0) flags[raw.slice(0, eq)] = raw.slice(eq + 1);
      else {
        const next = argv[i + 1];
        if (next && !next.startsWith('-')) { flags[raw] = next; i++; }
        else flags[raw] = true;
      }
    } else flags._.push(arg);
  }
  return flags;
}

function readStdin() {
  try {
    if (process.stdin.isTTY) return '';
    return fs.readFileSync(0, 'utf8');
  } catch { return ''; }
}

function localCliPath() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..', 'dist', 'cli.mjs');
}

function cliCommand() {
  if (process.env.AGENT_KERNEL_CLI) return [process.execPath, process.env.AGENT_KERNEL_CLI];
  const local = localCliPath();
  if (fs.existsSync(local)) return [process.execPath, local];
  return ['agent-kernel'];
}

function currentMode() {
  const config = readJson(path.join(homeDir(), 'config.json'), {});
  return config.agentWriteMode || config.memoryWritePolicy?.mode || 'approval';
}

function isTrustedAutoWrite(flags) {
  const type = String(flags.type || 'rule');
  const scope = String(flags.scope || 'global');
  const level = String(flags.level || 'standard');
  if (scope === 'project') return true;
  if (type === 'project-note') return true;
  if (level === 'note') return true;
  return false;
}

function runCli(args) {
  const [cmd, ...baseArgs] = cliCommand();
  return childProcess.execFileSync(cmd, [...baseArgs, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env
  });
}

function fail(message) {
  process.stderr.write(String(message) + '\n');
  process.exitCode = 1;
}

function usage() {
  process.stdout.write(`agent-kernel-agent-write\n\nUsage:\n  agent-kernel-agent-write --from codex --reason "User asked to remember this" --text "Use pnpm here."\n\nBehavior depends on agent-kernel-mode:\n  approval -> pending proposal\n  trusted  -> auto-write only low-risk/project-scoped memories\n  bypass   -> approved memory write\n`);
}

function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help || flags.h) return usage();

  const text = String(flags.text || flags._.join(' ') || readStdin()).trim();
  if (!text || text.length < 8) {
    fail('Memory text is required and must be at least 8 characters.');
    return;
  }

  const from = String(flags.from || flags.agent || 'unknown-agent');
  const reason = String(flags.reason || 'Captured by coding agent.');
  const type = String(flags.type || 'rule');
  const scope = String(flags.scope || 'global');
  const level = String(flags.level || 'standard');
  const targets = String(flags.targets || 'all');
  const tags = String(flags.tags || '');
  const mode = currentMode();

  if (mode === 'bypass' || (mode === 'trusted' && isTrustedAutoWrite({ type, scope, level }))) {
    const args = ['remember', text, '--type', type, '--scope', scope, '--level', level, '--targets', targets, '--publish'];
    if (tags) args.push('--tags', tags);
    process.stdout.write(runCli(args));
    return;
  }

  const args = ['propose', '--from', from, '--type', type, '--scope', scope, '--level', level, '--targets', targets, '--text', text, '--reason', reason];
  if (tags) args.push('--tags', tags);
  process.stdout.write(runCli(args));
}

main();
