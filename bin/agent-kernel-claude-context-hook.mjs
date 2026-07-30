#!/usr/bin/env node
import childProcess from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '1.15.1';
const DEFAULT_TIMEOUT_MS = 1200;
const MAX_CONTEXT_CHARS = 1800;
const MAX_FAILURE_CHARS = 3000;
const here = path.dirname(fileURLToPath(import.meta.url));
const fileContextPath = path.join(here, 'agent-kernel-file-context.mjs');
const failurePath = path.join(here, 'agent-kernel-failure.mjs');

const SECRET_PATTERNS = [
  /OPENAI_API_KEY\s*=\s*["'][^"']+["']/gi,
  /ANTHROPIC_API_KEY\s*=\s*["'][^"']+["']/gi,
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*["'][^"']+["']/gi,
  /AIza[0-9A-Za-z\-_]{35}/g,
  /sk-[A-Za-z0-9]{20,}/g,
  /ghp_[A-Za-z0-9]{20,}/g,
  /xox[abposr]-[A-Za-z0-9-]{10,}/g
];

function kernelHome() {
  return process.env.AGENT_KERNEL_HOME || path.join(os.homedir(), '.agent-kernel');
}

function readJson(filePath, fallback) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return fallback; }
}

function readStdin() {
  try { return fs.readFileSync(0, 'utf8') || '{}'; } catch { return '{}'; }
}

function redact(value) {
  let text = String(value || '');
  for (const pattern of SECRET_PATTERNS) text = text.replace(pattern, '[REDACTED_SECRET]');
  return text;
}

function parsePayload() {
  try { return JSON.parse(readStdin()); } catch { return {}; }
}

function timeoutMs() {
  const configured = Number(process.env.AGENT_KERNEL_HOOK_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  return Math.max(100, Math.min(Number.isFinite(configured) ? configured : DEFAULT_TIMEOUT_MS, 5000));
}

function strictMode() {
  if (process.env.AGENT_KERNEL_HOOK_STRICT === '1') return true;
  const config = readJson(path.join(kernelHome(), 'config.json'), {});
  return config.strictMode === true;
}

function slash(value) {
  return String(value || '').replace(/\\/g, '/').trim();
}

function collectFiles(payload) {
  const input = payload.tool_input || payload.toolInput || {};
  const files = [];
  const add = (value) => {
    if (Array.isArray(value)) value.forEach(add);
    else if (typeof value === 'string') value.split(',').forEach((item) => {
      const normalized = slash(item);
      if (normalized) files.push(normalized);
    });
  };
  add(input.file_path);
  add(input.filePath);
  add(input.path);
  add(input.filename);
  add(input.files);
  add(input.paths);
  add(payload.files);
  return [...new Set(files)];
}

function toolCommand(payload) {
  const input = payload.tool_input || payload.toolInput || {};
  return redact(input.command || payload.command || '').slice(0, 1200);
}

function runNode(script, args) {
  return childProcess.spawnSync(process.execPath, [script, ...args], {
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf8',
    timeout: timeoutMs(),
    maxBuffer: 256 * 1024,
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function hookOutput(eventName, additionalContext) {
  return {
    hookSpecificOutput: {
      hookEventName: eventName,
      additionalContext: redact(additionalContext).slice(0, MAX_CONTEXT_CHARS)
    }
  };
}

function denyOutput(reason) {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: redact(reason).slice(0, 500)
    }
  };
}

function writeOutput(value) {
  process.stdout.write(JSON.stringify(value));
}

function contextFailure(result) {
  if (result.error?.code === 'ETIMEDOUT') return 'Agent Kernel context hook timed out.';
  if (result.error) return `Agent Kernel context hook failed: ${result.error.message}`;
  if (result.status !== 0) return `Agent Kernel context hook failed with status ${result.status}.`;
  return null;
}

function handlePreToolUse(payload) {
  const tool = String(payload.tool_name || payload.toolName || '');
  const risky = new Set(['Edit', 'MultiEdit', 'Write', 'Bash']);
  if (!risky.has(tool)) return writeOutput({});

  const files = collectFiles(payload);
  const command = toolCommand(payload);
  if (!files.length && tool === 'Bash' && !command) return writeOutput({});

  const args = [...files, '--budget', String(MAX_CONTEXT_CHARS), '--json'];
  if (command) args.push('--query', command.slice(0, 300));
  const result = runNode(fileContextPath, args);
  const failure = contextFailure(result);
  if (failure) {
    return writeOutput(strictMode() ? denyOutput(failure) : {});
  }

  let parsed;
  try { parsed = JSON.parse(result.stdout || '{}'); } catch { parsed = null; }
  const context = parsed?.context || '';
  if (!context) return writeOutput({});
  return writeOutput(hookOutput('PreToolUse', `Agent Kernel local context before ${tool}:\n${context}`));
}

function failureText(payload) {
  const response = payload.tool_response || payload.toolResponse || {};
  const input = payload.tool_input || payload.toolInput || {};
  const parts = [
    payload.error,
    payload.message,
    response.error,
    response.stderr,
    response.stdout,
    response.content,
    input.error
  ];
  return redact(parts.filter(Boolean).map((value) => typeof value === 'string' ? value : JSON.stringify(value)).join('\n')).slice(0, MAX_FAILURE_CHARS);
}

function handlePostToolUseFailure(payload) {
  const tool = String(payload.tool_name || payload.toolName || 'unknown-tool');
  const files = collectFiles(payload);
  const command = toolCommand(payload);
  const evidence = failureText(payload);
  if (!evidence && !command) return writeOutput({});

  const args = [
    'capture',
    '--from', 'claude-hook',
    '--type', tool === 'Bash' ? 'command-failure' : 'tool-failure',
    '--signature', `${tool} failure`,
    '--text', evidence || `${tool} failed`,
    '--tags', `claude-hook,${tool.toLowerCase()}`
  ];
  if (command) args.push('--command', command);
  if (files.length) args.push('--files', files.join(','));

  const result = runNode(failurePath, args);
  if (result.error || result.status !== 0) {
    const reason = result.error?.code === 'ETIMEDOUT'
      ? 'Agent Kernel failure capture timed out.'
      : 'Agent Kernel failure capture failed.';
    return writeOutput(strictMode() ? { decision: 'block', reason } : {});
  }
  return writeOutput({
    hookSpecificOutput: {
      hookEventName: 'PostToolUseFailure',
      additionalContext: 'Failure evidence captured locally as an unapproved Failure Lesson. No memory was approved or published.'
    }
  });
}

function usage() {
  process.stdout.write(`agent-kernel-claude-context-hook ${VERSION}\n\nReads a Claude Code hook payload from stdin.\nSupported events: PreToolUse, PostToolUseFailure.\n`);
}

function main() {
  const argEvent = process.argv.slice(2).find((arg) => !arg.startsWith('-'));
  if (process.argv.includes('--help') || process.argv.includes('-h')) return usage();
  const payload = parsePayload();
  const event = argEvent || payload.hook_event_name || payload.hookEventName || payload.event;
  if (event === 'PreToolUse') return handlePreToolUse(payload);
  if (event === 'PostToolUseFailure') return handlePostToolUseFailure(payload);
  writeOutput({});
}

main();
