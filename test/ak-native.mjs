import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const name = 'ak-native';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const binPath = path.join(root, 'crates', 'ak-native', 'target', 'release', 'ak-native');

export async function run() {
  if (!fs.existsSync(binPath)) {
    throw new Error(`ak-native binary not found at ${binPath} — build it first with cargo build --release`);
  }

  // ==========================================
  // 1. Diagnostics and Version Contracts
  // ==========================================
  const doctorResult = childProcess.spawnSync(binPath, ['doctor'], { encoding: 'utf8' });
  assert.equal(doctorResult.status, 0, 'ak-native doctor exited with non-zero status');
  assert.match(doctorResult.stdout, /Category C Systems Kernel/);
  assert.match(doctorResult.stdout, /Status: healthy/);

  const versionResult = childProcess.spawnSync(binPath, ['--version'], { encoding: 'utf8' });
  assert.equal(versionResult.status, 0);
  assert.match(versionResult.stdout.trim(), /^ak-native \d+\.\d+\.\d+/);

  // ==========================================
  // 2. Table-driven Tool Hook Filtering
  // ==========================================
  const nonRiskyTools = ['Read', 'Glob', 'Grep', 'CustomTool', 'ListFiles'];
  for (const tool of nonRiskyTools) {
    const start = performance.now();
    const result = childProcess.spawnSync(binPath, ['hook', 'context'], {
      input: JSON.stringify({ tool_name: tool, tool_input: { file_path: 'README.md' } }),
      encoding: 'utf8'
    });
    const elapsed = performance.now() - start;
    assert.equal(result.status, 0, `Tool ${tool} failed with status ${result.status}`);
    assert.equal(result.stdout.trim(), '{}', `Tool ${tool} should return empty object`);
    assert.ok(elapsed < 40, `Tool ${tool} check took too long: ${elapsed.toFixed(1)}ms`);
  }

  const riskyTools = ['Edit', 'MultiEdit', 'Write', 'Bash'];
  for (const tool of riskyTools) {
    const result = childProcess.spawnSync(binPath, ['hook', 'context'], {
      input: JSON.stringify({
        tool_name: tool,
        tool_input: tool === 'Bash' ? { command: 'git status' } : { file_path: 'src/cli.mjs' }
      }),
      encoding: 'utf8'
    });
    assert.equal(result.status, 0, `Tool ${tool} failed with status ${result.status}`);
    const parsed = JSON.parse(result.stdout);
    assert.ok(parsed.hookSpecificOutput, `Tool ${tool} missing hookSpecificOutput`);
    assert.equal(parsed.hookSpecificOutput.hookEventName, 'PreToolUse');
  }

  // ==========================================
  // 3. Secret Redaction at Trust Boundaries
  // ==========================================
  const secretPayload = {
    tool_name: 'Bash',
    tool_input: {
      command: 'export OPENAI_API_KEY="sk-proj-abc12345678901234567890" ANTHROPIC_API_KEY="sk-ant-test987654321" GITHUB_TOKEN="ghp_12345678901234567890"'
    }
  };
  const secretResult = childProcess.spawnSync(binPath, ['hook', 'context'], {
    input: JSON.stringify(secretPayload),
    encoding: 'utf8'
  });
  assert.equal(secretResult.status, 0);
  assert.ok(!secretResult.stdout.includes('sk-proj-'), 'Failed to redact OpenAI key');
  assert.ok(!secretResult.stdout.includes('sk-ant-'), 'Failed to redact Anthropic key');
  assert.ok(!secretResult.stdout.includes('ghp_'), 'Failed to redact GitHub token');

  // ==========================================
  // 4. Error Handling and Resilient Input
  // ==========================================
  // Malformed JSON on stdin must not crash
  const malformedResult = childProcess.spawnSync(binPath, ['hook', 'context'], {
    input: 'this is not valid json! {[[[[',
    encoding: 'utf8'
  });
  assert.equal(malformedResult.status, 0);
  assert.equal(malformedResult.stdout.trim(), '{}');

  // Unknown command must exit non-zero
  const unknownResult = childProcess.spawnSync(binPath, ['non-existent-subcommand'], { encoding: 'utf8' });
  assert.notEqual(unknownResult.status, 0);

  // Missing query on search must exit non-zero
  const missingSearchResult = childProcess.spawnSync(binPath, ['search'], { encoding: 'utf8' });
  assert.notEqual(missingSearchResult.status, 0);

  // ==========================================
  // 5. Architecture Graph Discovery
  // ==========================================
  const startArch = performance.now();
  const archResult = childProcess.spawnSync(binPath, ['arch', 'scan', root], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024
  });
  const elapsedArch = performance.now() - startArch;
  assert.equal(archResult.status, 0, 'ak-native arch scan failed');

  const archMap = JSON.parse(archResult.stdout);
  assert.equal(archMap.version, 1);
  assert.equal(archMap.root, 'agent-kernel');
  assert.ok(archMap.fileCount >= 160, `Unexpected fileCount: ${archMap.fileCount}`);
  assert.ok(archMap.languages.javascript > 100, 'Missing javascript language count');
  assert.ok(archMap.languages.rust >= 4, 'Missing rust language count');
  assert.ok(Array.isArray(archMap.nodes));
  assert.ok(Array.isArray(archMap.edges));
  assert.ok(Array.isArray(archMap.cycles));
  assert.ok(typeof archMap.fingerprint === 'string' && archMap.fingerprint.length > 0);
  assert.ok(elapsedArch < 400, `Arch scan exceeded budget: ${elapsedArch.toFixed(1)}ms`);

  // ==========================================
  // 6. Ranked Token Search
  // ==========================================
  const searchResult = childProcess.spawnSync(binPath, ['search', 'pnpm', '--limit', '3'], {
    encoding: 'utf8'
  });
  assert.equal(searchResult.status, 0);
  const searchMatches = JSON.parse(searchResult.stdout);
  assert.ok(Array.isArray(searchMatches));
  assert.ok(searchMatches.length <= 3, 'Search limit exceeded');
  if (searchMatches.length > 0) {
    assert.ok(typeof searchMatches[0].score === 'number' && searchMatches[0].score > 0);
  }
}
