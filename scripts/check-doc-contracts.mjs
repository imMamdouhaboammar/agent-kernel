import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = async (path) => readFile(resolve(root, path), 'utf8');
const packageJson = JSON.parse(await read('package.json'));
const skillsMetadata = JSON.parse(await read('skills.sh.json'));
const pluginMetadata = JSON.parse(await read('.claude-plugin/plugin.json'));
const marketplaceMetadata = JSON.parse(await read('.claude-plugin/marketplace.json'));
const commandReference = await read('docs/COMMAND_REFERENCE.md');
const environmentReference = await read('docs/ENVIRONMENT_VARIABLES.md');
const docsMap = await read('docs/README.md');
const readme = await read('README.md');
const installGuide = await read('docs/INSTALL_AND_AGENT_SETUP.md');
const integrations = await read('docs/INTEGRATIONS.md');
const projectConnection = await read('docs/PROJECT_CONNECTION.md');
const mcpServer = await read('docs/MCP_SERVER.md');

assert.deepEqual(skillsMetadata.featured, ['agent-kernel', 'architecture-guardian'],
  'skills.sh featured skills must expose both canonical skills');
for (const term of ['failure-lessons', 'project-isolation', 'runtime-evidence', 'secure-runtime', 'release-integrity']) {
  assert.ok(skillsMetadata.metadata.tags.includes(term), `skills.sh metadata must include ${term}`);
  assert.ok(pluginMetadata.keywords.includes(term), `Claude plugin metadata must include ${term}`);
  assert.ok(marketplaceMetadata.plugins[0].keywords.includes(term), `marketplace plugin metadata must include ${term}`);
}

for (const binary of Object.keys(packageJson.bin ?? {})) {
  assert.ok(commandReference.includes('`' + binary + '`'),
    `docs/COMMAND_REFERENCE.md must cover public binary ${binary}`);
}

const publicEnvironmentVariables = [
  'AGENT_KERNEL_HOME',
  'AGENT_KERNEL_AGENT',
  'AGENT_KERNEL_AGENT_ID',
  'AGENT_KERNEL_ARCHITECTURE_MODE',
  'AGENT_KERNEL_BROWSER_ARGS_JSON',
  'AGENT_KERNEL_BROWSER_BIN',
  'AGENT_KERNEL_DAEMON_ALLOW_REMOTE',
  'AGENT_KERNEL_DAEMON_HOST',
  'AGENT_KERNEL_DAEMON_PORT',
  'AGENT_KERNEL_DAEMON_TOKEN',
  'AGENT_KERNEL_DISABLE_AUTO_UPDATE_CHECK',
  'AGENT_KERNEL_HELPER_TIMEOUT_MS',
  'AGENT_KERNEL_HOOK_STRICT',
  'AGENT_KERNEL_HOOK_TIMEOUT_MS',
  'AGENT_KERNEL_MCP_ALLOW_APPROVE',
  'AGENT_KERNEL_MCP_TOOLS',
];
for (const variable of publicEnvironmentVariables) {
  assert.ok(environmentReference.includes('`' + variable + '`'),
    `docs/ENVIRONMENT_VARIABLES.md must classify ${variable}`);
}

for (const variable of [
  'AGENT_KERNEL_BYPASS_SHIMS',
  'AGENT_KERNEL_CLI',
  'AGENT_KERNEL_NPM_BIN',
  'AGENT_KERNEL_UPDATE_CLI_BIN',
]) {
  assert.match(environmentReference, new RegExp(`\\b${variable}\\b`),
    `internal override ${variable} must be classified`);
}

const agentKernelSkills = [
  'SKILL.md',
  '.claude/skills/agent-kernel/SKILL.md',
  '.agents/skills/agent-kernel/SKILL.md',
];
const agentKernelRequirements = [
  /pending proposal/iu,
  /AGENT_KERNEL_DAEMON_TOKEN/u,
  /MCP/iu,
  /Architecture Guardian/u,
  /project/iu,
  /approve|approval/iu,
];
for (const skillPath of agentKernelSkills) {
  const content = await read(skillPath);
  for (const requirement of agentKernelRequirements) {
    assert.match(content, requirement, `${skillPath} is missing ${requirement}`);
  }
}

const architectureSkills = [
  'skills/architecture-guardian/SKILL.md',
  '.claude/skills/architecture-guardian/SKILL.md',
  '.agents/skills/architecture-guardian/SKILL.md',
];
for (const skillPath of architectureSkills) {
  const content = await read(skillPath);
  for (const term of ['architecture doctor', 'architecture discover', 'architecture reuse', 'architecture check', 'baseline', 'exception']) {
    assert.match(content, new RegExp(term, 'iu'), `${skillPath} must cover ${term}`);
  }
}
assert.ok(installGuide.includes('stable package version represented by this repository is `' + packageJson.version + '`'),
  'install guide stable version must match package.json');
assert.doesNotMatch(installGuide, /agent-kernel-agent-write mode/u,
  'install guide must not document unsupported agent-write mode subcommands');
for (const [path, content] of [['README.md', readme], ['docs/AGENT_WRITE_MODES.md', await read('docs/AGENT_WRITE_MODES.md')]]) {
  assert.doesNotMatch(content, /agent-kernel-agent-write\s+(?:mode|session-start|session-end|observe)\b/u,
    `${path} must not document removed agent-write subcommands`);
}
assert.doesNotMatch(installGuide, /bunx\s+agent-kernel\b/u,
  'Bunx examples must use the scoped npm package name');

for (const doc of ['COMMAND_REFERENCE.md', 'ENVIRONMENT_VARIABLES.md', 'SKILL_CONTRACT.md', 'SECURE_RUNTIME_AND_RELEASES.md']) {
  assert.match(docsMap, new RegExp(doc.replaceAll('.', '\\.')), `docs/README.md must link ${doc}`);
  assert.match(readme, new RegExp(doc.replaceAll('.', '\\.')), `README.md must link ${doc}`);
}

assert.match(integrations, /AGENT_KERNEL_DAEMON_ALLOW_REMOTE/u);
assert.match(integrations, /AGENT_KERNEL_DAEMON_TOKEN/u);
assert.match(integrations, /SKILL_CONTRACT\.md/u);
for (const path of ['CLAUDE_CODE_LIVE_CONTEXT.md', 'CODEX_LIVE_CONTEXT.md', 'CURSOR_LIVE_CONTEXT.md', 'OPENCODE_LIVE_CONTEXT.md']) {
  const content = await read(`docs/integrations/${path}`);
  assert.doesNotMatch(content, /planned agent registry|registry will enforce trust/iu,
    `${path} must not describe the shipped agent registry as future work`);
  assert.match(content, /agent-kernel agent (?:add|show)/u, `${path} must document explicit agent identity trust`);
  assert.match(content, /AGENT_KERNEL_DAEMON_TOKEN/u, `${path} must document authenticated remote daemon mode`);
}
assert.match(projectConnection, /caller.{0,80}override/isu,
  'project connection docs must explain provider target isolation');
assert.match(projectConnection, /short-lived.{0,40}approval/isu,
  'project connection docs must explain production approval scope');

function mcpSurface(extraEnv = {}) {
  const cleanEnv = { ...process.env };
  delete cleanEnv.AGENT_KERNEL_MCP_TOOLS;
  delete cleanEnv.AGENT_KERNEL_MCP_ALLOW_APPROVE;
  const output = execFileSync(process.execPath, [resolve(root, 'bin', 'agent-kernel-mcp-safe.mjs'), 'test'], {
    encoding: 'utf8',
    env: { ...cleanEnv, ...extraEnv },
  });
  return JSON.parse(output);
}

const coreMcp = mcpSurface();
const extendedMcp = mcpSurface({ AGENT_KERNEL_MCP_TOOLS: 'extended' });
const approvalMcp = mcpSurface({ AGENT_KERNEL_MCP_TOOLS: 'extended', AGENT_KERNEL_MCP_ALLOW_APPROVE: '1' });
assert.equal(coreMcp.count, 10, 'core MCP contract changed; update docs and this explicit boundary');
assert.equal(extendedMcp.count, 14, 'extended MCP contract changed; update docs and this explicit boundary');
assert.equal(approvalMcp.count, 15, 'approval MCP contract changed; update docs and this explicit boundary');
const documentedMcpTools = new Set(mcpServer.match(/agent_kernel_[a-z_]+/gu) ?? []);
const actualMcpTools = new Set([...coreMcp.tools, ...extendedMcp.tools, ...approvalMcp.tools]);
assert.deepEqual([...documentedMcpTools].sort(), [...actualMcpTools].sort(),
  'docs/MCP_SERVER.md tool names must exactly match the shipped MCP surfaces');

const referenceDirectory = resolve(root, 'skills', 'architecture-guardian', 'references');
for (const file of await readdir(referenceDirectory)) {
  if (!file.endsWith('.md')) continue;
  const content = await read(`skills/architecture-guardian/references/${file}`);
  const lines = content.trim().split(/\r?\n/u).length;
  assert.ok(lines >= 20, `${file} is too shallow for a focused skill reference (${lines} lines)`);
}

console.log(`Documentation contracts passed for ${Object.keys(packageJson.bin ?? {}).length} public binaries, ${publicEnvironmentVariables.length} public environment variables, ${agentKernelSkills.length + architectureSkills.length} skill surfaces, and ${actualMcpTools.size} MCP tools.`);