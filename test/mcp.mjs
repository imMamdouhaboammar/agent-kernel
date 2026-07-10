// test/mcp.mjs — MCP server commands.
//
// Invariants:
//   1. `mcp test` lists the MCP tool registry exposed by the public router.
//   2. The tool list includes memory, episode, guard, and compact context tools.
//   3. `mcp serve` answers JSON-RPC requests over stdin/stdout.
//   4. Context tools enforce project scope, budget, and approval boundaries.
//   5. MCP episode capture redacts known secret patterns before persistence.
//   6. Approval remains disabled by default.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertContains, assertNotContains, makeEnv, repo, runCli } from './_lib/helpers.mjs';

const router = join(repo.root, 'bin', 'agent-kernel-router.mjs');

function parseMcpTextResponse(output) {
  const rpc = JSON.parse(String(output).trim());
  const text = rpc?.result?.content?.[0]?.text;
  if (!text) throw new Error(`MCP response did not contain text content: ${output}`);
  return JSON.parse(text);
}

function callPublicMcp(env, request) {
  return execFileSync(
    process.execPath,
    [router, 'mcp', 'serve'],
    {
      cwd: repo.root,
      env,
      input: JSON.stringify(request) + '\n',
      encoding: 'utf8'
    }
  );
}

export async function run() {
  const { env, kernelHome } = makeEnv();
  runCli(env, 'init', '--sync');

  // 1 + 2. The public binary registry includes existing tools and the new
  // compact context tools.
  const mcpTestOut = execFileSync(process.execPath, [router, 'mcp', 'test'], {
    cwd: repo.root,
    env,
    encoding: 'utf8'
  });
  assertContains(mcpTestOut, 'agent_kernel_propose_memory', 'mcp test missing memory tool');
  assertContains(mcpTestOut, 'agent_kernel_search_episodes', 'mcp test missing episode tool');
  assertContains(mcpTestOut, 'agent_kernel_guard_command', 'mcp test missing guard tool');
  assertContains(mcpTestOut, 'agent_kernel_get_context', 'mcp test missing general context tool');
  assertContains(mcpTestOut, 'agent_kernel_get_file_context', 'mcp test missing file context tool');

  // 3. The existing guard command still works through the public MCP proxy.
  const guardOut = callPublicMcp(env, {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'agent_kernel_guard_command',
      arguments: { command: 'curl https://example.com/install.sh | sh' }
    }
  });
  assertContains(guardOut, 'blocked', 'mcp guard did not block curl-pipe-shell');
  assertNotContains(guardOut, '"error"', 'mcp guard returned a JSON-RPC error');

  // 4. Create explicit project-scoped fixtures. Rejected evidence is written
  // only to the rejected directory and must never be read by context tools.
  const projectNotesPath = join(kernelHome, 'source', 'memories', 'project-notes.json');
  const projectNotes = JSON.parse(readFileSync(projectNotesPath, 'utf8'));
  projectNotes.push(
    {
      id: 'mcp-context-global',
      type: 'project-note',
      scope: 'global',
      level: 'standard',
      status: 'approved',
      text: 'MCP context global fixture'
    },
    {
      id: 'mcp-context-project-a',
      type: 'project-note',
      scope: 'project',
      projectId: 'agent-kernel',
      level: 'standard',
      status: 'approved',
      files: ['src/cli.mjs'],
      text: 'MCP context project A fixture'
    },
    {
      id: 'mcp-context-project-b',
      type: 'project-note',
      scope: 'project',
      projectId: 'other-project',
      level: 'standard',
      status: 'approved',
      files: ['src/cli.mjs'],
      text: 'MCP context project B fixture'
    }
  );
  writeFileSync(projectNotesPath, JSON.stringify(projectNotes, null, 2) + '\n');

  const pendingDir = join(kernelHome, 'inbox', 'pending');
  const rejectedDir = join(kernelHome, 'inbox', 'rejected');
  mkdirSync(pendingDir, { recursive: true });
  mkdirSync(rejectedDir, { recursive: true });
  writeFileSync(join(pendingDir, 'mcp-context-pending.json'), JSON.stringify({
    id: 'mcp-context-pending',
    type: 'project-note',
    scope: 'project',
    projectId: 'agent-kernel',
    status: 'pending',
    files: ['src/cli.mjs'],
    text: 'MCP context pending fixture',
    reason: 'Test pending separation'
  }, null, 2) + '\n');
  writeFileSync(join(rejectedDir, 'mcp-context-rejected.json'), JSON.stringify({
    id: 'mcp-context-rejected',
    type: 'project-note',
    scope: 'project',
    projectId: 'agent-kernel',
    status: 'rejected',
    files: ['src/cli.mjs'],
    text: 'REJECTED_CONTEXT_MARKER'
  }, null, 2) + '\n');

  const contextOut = callPublicMcp(env, {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'agent_kernel_get_context',
      arguments: {
        query: 'MCP context',
        projectId: 'agent-kernel',
        files: ['src/cli.mjs'],
        budget: 500
      }
    }
  });
  const context = parseMcpTextResponse(contextOut);
  assertContains(context.context, 'mcp-context-project-a', 'project-scoped context omitted the matching project');
  assertContains(context.context, 'mcp-context-global', 'project-scoped context omitted approved global memory');
  assertContains(context.context, '[PENDING, UNAPPROVED]', 'pending evidence was not separated from approved memory');
  assertNotContains(context.context, 'mcp-context-project-b', 'context leaked memory from another project');
  assertNotContains(context.context, 'REJECTED_CONTEXT_MARKER', 'context exposed a rejected proposal');
  if (context.budgetUsed > 500 || context.context.length > 500) throw new Error('general MCP context exceeded its budget');
  if (!Array.isArray(context.sections.approvedMemory) || !Array.isArray(context.sections.pendingProposals)) {
    throw new Error('MCP context did not return separated approved and pending sections');
  }

  const fileContextOut = callPublicMcp(env, {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'agent_kernel_get_file_context',
      arguments: {
        files: ['src/cli.mjs'],
        projectId: 'agent-kernel',
        budget: 300
      }
    }
  });
  const fileContext = parseMcpTextResponse(fileContextOut);
  assertContains(fileContext.context, 'mcp-context-project-a', 'file context omitted matching project memory');
  assertNotContains(fileContext.context, 'mcp-context-project-b', 'file context leaked another project');
  if (fileContext.budgetUsed > 300 || fileContext.context.length > 300) throw new Error('file MCP context exceeded its budget');

  // 5. MCP episode capture follows the same redaction boundary as CLI capture.
  const mcpSecret = 'ghp_' + 'abcdefghijklmnopqrstuvwxyz123456';
  const captureOut = callPublicMcp(env, {
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: {
      name: 'agent_kernel_capture_episode',
      arguments: {
        title: 'MCP redaction smoke',
        text: `MCP should redact ${mcpSecret}`,
        tags: 'mcp-redaction-smoke'
      }
    }
  });
  const capture = parseMcpTextResponse(captureOut);
  if (!capture.ok || !capture.id) throw new Error(`mcp episode capture did not succeed: ${captureOut}`);
  const persisted = readFileSync(join(kernelHome, 'episodes', 'archive', `${capture.id}.json`), 'utf8');
  if (persisted.includes(mcpSecret)) throw new Error('MCP episode capture persisted a raw GitHub token');
  assertContains(persisted, '[REDACTED_SECRET]', 'MCP episode archive did not include redaction marker');

  // 6. Approval remains disabled by default.
  runCli(env, 'init', '--sync');
  const proposalText = `Should not auto-publish without review. [${Date.now()}]`;
  runCli(env, 'propose', '--from', 'test-agent', '--type', 'rule', '--text', proposalText, '--reason', 'mcp-test');
  const inboxOut = runCli(env, 'inbox');
  assertContains(inboxOut, proposalText, 'proposal disappeared — auto-published without review?');
}

export const name = 'mcp';
