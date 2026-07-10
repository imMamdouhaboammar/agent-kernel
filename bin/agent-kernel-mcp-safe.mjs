#!/usr/bin/env node
import childProcess from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const surfacePath = path.join(here, 'agent-kernel-mcp-surface.mjs');
const SECRET_PATTERNS = [
  /OPENAI_API_KEY\s*=\s*["'][^"']+["']/gi,
  /ANTHROPIC_API_KEY\s*=\s*["'][^"']+["']/gi,
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*["'][^"']+["']/gi,
  /AIza[0-9A-Za-z\-_]{35}/g,
  /sk-[A-Za-z0-9]{20,}/g,
  /ghp_[A-Za-z0-9]{20,}/g,
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /xox[abposr]-[A-Za-z0-9-]{10,}/g
];

function redactText(value) {
  let text = String(value || '');
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    text = text.replace(pattern, '[REDACTED_SECRET]');
  }
  return text;
}

function redactValue(value) {
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactValue(item)]));
  }
  return value;
}

function protectedRequest(request) {
  if (request?.method !== 'tools/call') return request;
  if (request.params?.name !== 'agent_kernel_capture_episode') return request;
  return {
    ...request,
    params: {
      ...request.params,
      arguments: redactValue(request.params?.arguments || {})
    }
  };
}

function forward(request) {
  const result = childProcess.spawnSync(process.execPath, [surfacePath, 'mcp', 'serve'], {
    cwd: process.cwd(),
    env: process.env,
    input: JSON.stringify(protectedRequest(request)) + '\n',
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 2 * 1024 * 1024
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(String(result.stderr || `MCP surface failed with status ${result.status}`).trim());
  return result.stdout || '';
}

function serve() {
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let request;
    try { request = JSON.parse(trimmed); }
    catch {
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }) + '\n');
      return;
    }
    try { process.stdout.write(forward(request)); }
    catch (error) {
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id ?? null, error: { code: -32603, message: error?.message || String(error) } }) + '\n');
    }
  });
}

function main() {
  const raw = process.argv.slice(2);
  const args = raw[0] === 'mcp' ? raw.slice(1) : raw;
  if (args[0] === 'serve') return serve();
  const result = childProcess.spawnSync(process.execPath, [surfacePath, 'mcp', ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit'
  });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

try { main(); }
catch (error) {
  process.stderr.write(`${error?.message || String(error)}\n`);
  process.exitCode = 1;
}
