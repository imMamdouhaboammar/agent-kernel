#!/usr/bin/env node
import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const baseMcpPath = path.join(here, 'agent-kernel-mcp.mjs');
const failurePath = path.join(here, 'agent-kernel-failure.mjs');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const VERSION = packageJson.version || '1.0.0';

const CORE_TOOL_NAMES = [
  'agent_kernel_get_status',
  'agent_kernel_search_memory',
  'agent_kernel_get_context',
  'agent_kernel_get_file_context',
  'agent_kernel_propose_memory',
  'agent_kernel_list_pending',
  'agent_kernel_guard_command',
  'agent_kernel_capture_failure',
  'agent_kernel_search_failures',
  'agent_kernel_search_episodes'
];

const FAILURE_TOOL_DEFINITIONS = [
  {
    name: 'agent_kernel_capture_failure',
    description: 'Capture redacted local failure evidence for later review. This creates or updates a Failure Lesson only; it never approves or publishes durable memory.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['signature', 'text'],
      properties: {
        signature: { type: 'string', minLength: 3, maxLength: 180, description: 'Stable error signature such as ERR_MODULE_NOT_FOUND or a concise failure label.' },
        text: { type: 'string', minLength: 1, maxLength: 120000, description: 'Redacted error output or concise failure evidence.' },
        type: { type: 'string', default: 'coding-failure', description: 'Failure category such as test-failure, build-failure, or command-failure.' },
        command: { type: 'string', maxLength: 600, description: 'Command that produced the failure, when applicable.' },
        exitCode: { type: 'number', description: 'Command exit code, when available.' },
        files: { type: 'array', items: { type: 'string' }, description: 'Repository-relative files related to the failure.' },
        rootCause: { type: 'string', maxLength: 1000, description: 'Known root cause. Leave empty when still unknown.' },
        fix: { type: 'array', items: { type: 'string' }, description: 'Known fix steps supported by the evidence.' },
        preventionRule: { type: 'string', maxLength: 1000, description: 'Optional prevention rule. This remains evidence until separately proposed and approved.' },
        agentId: { type: 'string', description: 'Agent identity responsible for the capture.' },
        projectId: { type: 'string', description: 'Stable local project identifier.' },
        allowDuplicate: { type: 'boolean', default: false, description: 'Store a separate occurrence instead of deduplicating the same project, command, and signature.' }
      }
    }
  },
  {
    name: 'agent_kernel_search_failures',
    description: 'Search captured local Failure Lessons before retrying a known error. Results are evidence, not automatically approved memory.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['query'],
      properties: {
        query: { type: 'string', minLength: 1, description: 'Error text, signature, command, file, root cause, or fix to search for.' },
        command: { type: 'string', description: 'Optional exact or partial command filter.' },
        files: { type: 'array', items: { type: 'string' }, description: 'Optional file filter.' },
        projectId: { type: 'string', description: 'Optional stable project filter.' },
        agentId: { type: 'string', description: 'Optional agent filter.' },
        limit: { type: 'number', minimum: 1, maximum: 50, default: 10 },
        response_format: { type: 'string', enum: ['json', 'markdown'], default: 'json' }
      }
    }
  }
];

function mode() {
  return process.env.AGENT_KERNEL_MCP_TOOLS === 'extended' ? 'extended' : 'core';
}

function approvalEnabled() {
  return mode() === 'extended' && process.env.AGENT_KERNEL_MCP_ALLOW_APPROVE === '1';
}

function mcpText(value) {
  return { content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] };
}

function jsonRpcResult(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function jsonRpcError(id, code, message) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

function runNode(script, args, options = {}) {
  const result = childProcess.spawnSync(process.execPath, [script, ...args], {
    cwd: process.cwd(),
    env: process.env,
    input: options.input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 2 * 1024 * 1024
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(String(result.stderr || result.stdout || `Command failed with status ${result.status}`).trim());
  }
  return result.stdout || '';
}

function forwardRpc(request) {
  const output = runNode(baseMcpPath, ['mcp', 'serve'], { input: JSON.stringify(request) + '\n' }).trim();
  if (!output) return null;
  const lines = output.split(/\r?\n/).filter(Boolean);
  return JSON.parse(lines[lines.length - 1]);
}

function baseToolDefinitions() {
  const response = forwardRpc({ jsonrpc: '2.0', id: 'surface-list', method: 'tools/list', params: {} });
  return response?.result?.tools || [];
}

function allDefinitions() {
  const byName = new Map(baseToolDefinitions().map((tool) => [tool.name, tool]));
  for (const tool of FAILURE_TOOL_DEFINITIONS) byName.set(tool.name, tool);
  return byName;
}

function exposedTools() {
  const definitions = allDefinitions();
  if (mode() === 'core') {
    return CORE_TOOL_NAMES.map((name) => definitions.get(name)).filter(Boolean);
  }
  const tools = [...definitions.values()].filter((tool) => {
    if (tool.name === 'agent_kernel_approve_memory') return approvalEnabled();
    if (tool.name === 'agent_kernel_publish_memory' || tool.name === 'agent_kernel_delete_memory') return false;
    return true;
  });
  return tools.sort((a, b) => a.name.localeCompare(b.name));
}

function exposedNames() {
  return new Set(exposedTools().map((tool) => tool.name));
}

function csv(values) {
  return Array.isArray(values) ? values.map(String).map((value) => value.trim()).filter(Boolean).join(',') : String(values || '');
}

function captureFailure(args) {
  const cliArgs = [
    'capture',
    '--json',
    '--from', String(args.agentId || 'mcp'),
    '--type', String(args.type || 'coding-failure'),
    '--signature', String(args.signature || ''),
    '--text', String(args.text || '')
  ];
  if (args.command) cliArgs.push('--command', String(args.command));
  if (args.exitCode !== undefined && args.exitCode !== null) cliArgs.push('--exit-code', String(args.exitCode));
  if (args.files?.length) cliArgs.push('--files', csv(args.files));
  if (args.rootCause) cliArgs.push('--root-cause', String(args.rootCause));
  if (args.fix?.length) cliArgs.push('--fix', csv(args.fix));
  if (args.preventionRule) cliArgs.push('--prevention-rule', String(args.preventionRule));
  if (args.projectId) cliArgs.push('--project', String(args.projectId));
  if (args.allowDuplicate) cliArgs.push('--allow-duplicate');
  const lesson = JSON.parse(runNode(failurePath, cliArgs));
  return {
    ok: true,
    id: lesson.id,
    status: lesson.status,
    approved: false,
    occurrences: lesson.occurrences || 1,
    errorSignature: lesson.errorSignature,
    projectId: lesson.project || null,
    files: lesson.files || lesson.evidence?.filesTouched || [],
    next: `agent-kernel failure propose ${lesson.id} --as rule`
  };
}

function normalizeFiles(item) {
  return [...new Set([
    ...(Array.isArray(item.files) ? item.files : []),
    ...(Array.isArray(item.evidence?.filesTouched) ? item.evidence.filesTouched : [])
  ].map((value) => String(value).replace(/\\/g, '/')).filter(Boolean))];
}

function searchFailures(args) {
  const query = String(args.query || '');
  const lessons = JSON.parse(runNode(failurePath, ['search', query, '--json']));
  const wantedCommand = String(args.command || '').toLowerCase();
  const wantedFiles = (args.files || []).map((value) => String(value).replace(/\\/g, '/').toLowerCase());
  const wantedProject = String(args.projectId || '').toLowerCase();
  const wantedAgent = String(args.agentId || '').toLowerCase();
  const limit = Math.max(1, Math.min(Number(args.limit || 10), 50));
  const results = lessons
    .filter((item) => item && item.status !== 'rejected')
    .filter((item) => !wantedCommand || String(item.evidence?.command || '').toLowerCase().includes(wantedCommand))
    .filter((item) => !wantedProject || String(item.project || item.projectId || '').toLowerCase() === wantedProject)
    .filter((item) => !wantedAgent || String(item.agent || item.agentId || '').toLowerCase() === wantedAgent)
    .filter((item) => !wantedFiles.length || wantedFiles.some((wanted) => normalizeFiles(item).some((file) => {
      const normalized = file.toLowerCase();
      return normalized === wanted || normalized.endsWith('/' + wanted) || wanted.endsWith('/' + normalized);
    })))
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      status: item.status,
      errorSignature: item.errorSignature,
      failureType: item.failureType,
      occurrences: item.occurrences || 1,
      projectId: item.project || null,
      agentId: item.agent || null,
      command: item.evidence?.command || '',
      files: normalizeFiles(item),
      rootCause: item.rootCause || '',
      fixRecipe: item.fixRecipe || [],
      preventionRule: item.preventionRule || '',
      updatedAt: item.updatedAt || item.lastSeenAt || null
    }));
  if (args.response_format === 'markdown') {
    if (!results.length) return 'No matching Failure Lessons.';
    return results.map((item) => [
      `## ${item.errorSignature}`,
      `ID: ${item.id}`,
      `Occurrences: ${item.occurrences}`,
      item.command ? `Command: ${item.command}` : '',
      item.rootCause ? `Root cause: ${item.rootCause}` : '',
      item.fixRecipe.length ? `Fix: ${item.fixRecipe.join(' | ')}` : ''
    ].filter(Boolean).join('\n')).join('\n\n');
  }
  return { count: results.length, results };
}

function unavailableTool(name) {
  const reason = name === 'agent_kernel_approve_memory'
    ? 'Approval is not enabled. Use extended mode and set AGENT_KERNEL_MCP_ALLOW_APPROVE=1 intentionally, or approve from the terminal.'
    : `Tool ${name} is not enabled in ${mode()} MCP mode.`;
  return mcpText({ ok: false, error: reason, mode: mode() });
}

function handleRpc(request) {
  if (!request?.method) return null;
  if (request.method.startsWith('notifications/')) return null;
  if (request.method === 'tools/list') {
    return jsonRpcResult(request.id, { tools: exposedTools() });
  }
  if (request.method === 'tools/call') {
    const name = request.params?.name;
    const args = request.params?.arguments || {};
    if (!exposedNames().has(name)) return jsonRpcResult(request.id, unavailableTool(name));
    if (name === 'agent_kernel_capture_failure') return jsonRpcResult(request.id, mcpText(captureFailure(args)));
    if (name === 'agent_kernel_search_failures') return jsonRpcResult(request.id, mcpText(searchFailures(args)));
  }
  return forwardRpc(request);
}

function serve() {
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let request;
    try { request = JSON.parse(trimmed); }
    catch {
      process.stdout.write(JSON.stringify(jsonRpcError(null, -32700, 'Parse error')) + '\n');
      return;
    }
    try {
      const response = handleRpc(request);
      if (response) process.stdout.write(JSON.stringify(response) + '\n');
    } catch (error) {
      process.stdout.write(JSON.stringify(jsonRpcError(request.id, -32603, error?.message || String(error))) + '\n');
    }
  });
}

function testRegistry() {
  const tools = exposedTools();
  process.stdout.write(JSON.stringify({
    ok: true,
    server: 'agent-kernel-memory',
    version: VERSION,
    mode: mode(),
    approvalEnabled: approvalEnabled(),
    count: tools.length,
    tools: tools.map((tool) => tool.name)
  }, null, 2) + '\n');
}

function main() {
  const raw = process.argv.slice(2);
  const args = raw[0] === 'mcp' ? raw.slice(1) : raw;
  const action = args[0];
  if (action === 'serve') return serve();
  if (action === 'test') return testRegistry();
  const result = childProcess.spawnSync(process.execPath, [baseMcpPath, 'mcp', ...args], {
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
