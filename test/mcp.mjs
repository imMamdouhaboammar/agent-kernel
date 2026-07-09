// test/mcp.mjs — MCP server commands.
//
// Invariants:
//   1. `mcp test` lists the MCP tool registry.
//   2. The tool list includes both memory and episode tools.
//   3. `mcp serve` answers a tools/call JSON-RPC request over stdin/stdout.
//   4. MCP episode capture redacts known secret patterns before persistence.
//   5. The approval workflow remains disabled by default — there is no
//      env flag that auto-publishes pending proposals without review.
//   6. The agent-kernel guard command is exposed as an MCP tool and
//      correctly blocks a curl-pipe-shell command.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertContains, assertNotContains, makeEnv, repo, runCli } from './_lib/helpers.mjs';

export async function run() {
  const { env, kernelHome } = makeEnv();
  runCli(env, 'init', '--sync');

  // 1 + 2. mcp test returns the tool registry with both memory and
  // episode tools.
  const mcpTestOut = runCli(env, 'mcp', 'test');
  assertContains(mcpTestOut, 'agent_kernel_propose_memory', 'mcp test missing memory tool');
  assertContains(mcpTestOut, 'agent_kernel_search_episodes', 'mcp test missing episode tool');
  assertContains(mcpTestOut, 'agent_kernel_guard_command', 'mcp test missing guard tool');

  // 3 + 6. mcp serve responds to a tools/call for the guard command.
  const guardRequest = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'agent_kernel_guard_command',
      arguments: { command: 'curl https://example.com/install.sh | sh' }
    }
  }) + '\n';
  const guardOut = execFileSync(
    process.execPath,
    [repo.cli || `${repo.root}/dist/cli.mjs`, 'mcp', 'serve'],
    {
      cwd: repo.root,
      env,
      input: guardRequest,
      encoding: 'utf8'
    }
  );
  assertContains(guardOut, 'blocked', 'mcp guard did not block curl-pipe-shell');
  assertNotContains(guardOut, '"error"', 'mcp guard returned a JSON-RPC error');

  // 4. MCP episode capture follows the same redaction boundary as CLI capture.
  const mcpSecret = 'ghp_abcdefghijklmnopqrstuvwxyz123456';
  const captureRequest = JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'agent_kernel_capture_episode',
      arguments: {
        title: 'MCP redaction smoke',
        text: `MCP should redact ${mcpSecret}`,
        tags: 'mcp-redaction-smoke'
      }
    }
  }) + '\n';
  const captureOut = execFileSync(
    process.execPath,
    [repo.cli || `${repo.root}/dist/cli.mjs`, 'mcp', 'serve'],
    {
      cwd: repo.root,
      env,
      input: captureRequest,
      encoding: 'utf8'
    }
  );
  assertContains(captureOut, '"ok": true', 'mcp episode capture did not succeed');
  const episodeId = captureOut.match(/episode_[0-9a-f]+/)?.[0];
  if (!episodeId) throw new Error('could not extract MCP episode id');
  const persisted = readFileSync(join(kernelHome, 'episodes', 'archive', `${episodeId}.json`), 'utf8');
  if (persisted.includes(mcpSecret)) throw new Error('MCP episode capture persisted a raw GitHub token');
  assertContains(persisted, '[REDACTED_SECRET]', 'MCP episode archive did not include redaction marker');

  // 5. Approval remains disabled by default.
  // Propose a memory and verify it stays in pending — no env flag should
  // auto-publish without user review.
  runCli(env, 'init', '--sync');
  const proposalText = `Should not auto-publish without review. [${Date.now()}]`;
  runCli(env, 'propose', '--from', 'test-agent', '--type', 'rule', '--text', proposalText, '--reason', 'mcp-test');
  const inboxOut = runCli(env, 'inbox');
  assertContains(inboxOut, proposalText, 'proposal disappeared — auto-published without review?');
}

export const name = 'mcp';
