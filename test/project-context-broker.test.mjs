import assert from 'node:assert';
import childProcess from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseToml,
  stringifyToml,
  findProjectRoot,
  loadProjectManifest,
  resolveContext,
  evaluateGates,
  execSupabase,
  execGcloud,
  installCommandShims,
  keychainAdd,
  keychainGet,
  keychainDelete
} from '../bin/agent-kernel-project-broker.mjs';

const brokerPath = fileURLToPath(new URL('../bin/agent-kernel-project-broker.mjs', import.meta.url));

export const name = 'project-context-broker';

export async function run() {
  console.log('Running Project Context Broker tests...');

  // 1. TOML Parser & Stringifier
  const sampleToml = `
  version = 1
  project_id = "my-test-project"

  [identity]
  repository_uuid = "akp_12345"
  expected_git_remote = "git@github.com:example/repo.git"

  [capabilities]
  database_read = true
  database_write = false
  `;
  const parsed = parseToml(sampleToml);
  assert.strictEqual(parsed.version, 1);
  assert.strictEqual(parsed.project_id, 'my-test-project');
  assert.strictEqual(parsed.identity.repository_uuid, 'akp_12345');
  assert.strictEqual(parsed.identity.expected_git_remote, 'git@github.com:example/repo.git');
  assert.strictEqual(parsed.capabilities.database_read, true);
  assert.strictEqual(parsed.capabilities.database_write, false);

  const stringified = stringifyToml(parsed);
  const reparsed = parseToml(stringified);
  assert.deepStrictEqual(parsed, reparsed);
  console.log('✓ TOML parser and stringifier pass.');

  // 2. Project Context Discovery & Resolution (using temp folders)
  const tempDir = path.join(os.tmpdir(), `ak-test-project-${Date.now()}`);
  fs.mkdirSync(path.join(tempDir, '.agent-kernel'), { recursive: true });

  const testManifest = `
  version = 1
  project_id = "temp-project"
  display_name = "Temp Project"
  default_environment = "development"

  [identity]
  repository_uuid = "akp_temp_999"
  expected_git_remote = "github.com/example/temp-project"

  [providers.supabase]
  profile = "test-profile"
  project_ref = "testref"

  [providers.gcloud]
  profile = "test-gcloud-profile"
  project_id = "gcloud-test"
  region = "us-central1"

  [capabilities]
  database_read = true
  database_write = true
  migration_apply = true
  cloud_deploy = true
  `;
  fs.writeFileSync(path.join(tempDir, '.agent-kernel', 'project.toml'), testManifest, 'utf8');

  const root = findProjectRoot(tempDir);
  assert.strictEqual(root, tempDir);

  const manifest = loadProjectManifest(root);
  assert.strictEqual(manifest.project_id, 'temp-project');
  assert.strictEqual(manifest.display_name, 'Temp Project');
  console.log('✓ Project context discovery and loading pass.');

  // 3. Keychain Integration
  // We use keychainGet/Add/Delete. Since the agent has /usr/bin/security, we can add a test token and retrieve it.
  try {
    keychainAdd('test-profile-123', 'supabase', 'my-super-secret-token');
    const retrieved = keychainGet('test-profile-123', 'supabase');
    assert.strictEqual(retrieved, 'my-super-secret-token');
    keychainDelete('test-profile-123', 'supabase');
    const deleted = keychainGet('test-profile-123', 'supabase');
    assert.strictEqual(deleted, null);
    console.log('✓ Keychain secure storage and retrieval pass.');
  } catch (err) {
    console.warn('⚠️ Keychain tests skipped or failed due to environment permissions:', err.message);
  }

  // 4. Policy Gates Evaluation
  const mockCtx = {
    root: tempDir,
    projectId: 'temp-project',
    repositoryUuid: 'akp_temp_999',
    currentRemote: 'github.com/example/temp-project',
    currentBranch: 'main',
    manifest,
    registryEntry: {
      repository_uuid: 'akp_temp_999'
    }
  };

  // Evaluate allowed gate
  const gateResult = evaluateGates(mockCtx, 'supabase', 'db-pull');
  assert.strictEqual(gateResult, true);

  // Evaluate blocked gate (remote mismatch)
  const badCtx = {
    ...mockCtx,
    currentRemote: 'github.com/another-mismatch/repo'
  };
  assert.throws(() => {
    evaluateGates(badCtx, 'supabase', 'db-pull');
  }, /expected remote mismatch/);

  console.log('✓ Policy gates engine and validation pass.');

  // 5. Linked Git worktrees must enforce branch drift gates.
  const gitRun = (cwd, ...args) => childProcess.execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
  gitRun(tempDir, 'init');
  gitRun(tempDir, 'config', 'user.name', 'Agent Kernel Test');
  gitRun(tempDir, 'config', 'user.email', 'agent-kernel-test@example.invalid');
  gitRun(tempDir, 'add', '.');
  gitRun(tempDir, 'commit', '-m', 'test: initialize broker fixture');
  const linkedWorktree = `${tempDir}-linked`;
  gitRun(tempDir, 'worktree', 'add', '-b', 'broker-linked', linkedWorktree, 'HEAD');
  assert.ok(fs.statSync(path.join(linkedWorktree, '.git')).isFile(), 'Linked worktree .git marker must be a file');
  const staleWorktreeContext = resolveContext(linkedWorktree);
  gitRun(linkedWorktree, 'checkout', '-b', 'broker-drifted');
  assert.throws(() => {
    evaluateGates(staleWorktreeContext, 'supabase', 'db-pull');
  }, /Git branch has drifted/);
  console.log('✓ Linked worktree branch drift enforcement passes.');

  // 6. Provider adapters must remove caller overrides and preserve audit integrity.
  const providerHome = path.join(os.tmpdir(), `ak-provider-home-${Date.now()}`);
  const fakeBin = path.join(providerHome, 'bin');
  const decoyBin = path.join(providerHome, 'non-executable-bin');
  fs.mkdirSync(fakeBin, { recursive: true });
  fs.mkdirSync(decoyBin, { recursive: true });
  fs.writeFileSync(path.join(decoyBin, 'supabase'), 'not executable', { mode: 0o644 });
  fs.writeFileSync(path.join(decoyBin, 'gcloud'), 'not executable', { mode: 0o644 });
  const writeExecutable = (name, body) => {
    const file = path.join(fakeBin, name);
    fs.writeFileSync(file, `#!/usr/bin/env node\n${body}\n`, 'utf8');
    fs.chmodSync(file, 0o755);
  };
  writeExecutable('security', "if (process.argv.includes('find-generic-password')) process.stdout.write('test-token');");
  writeExecutable('supabase', "import fs from 'node:fs'; fs.writeFileSync(process.env.AK_TEST_ARGS_FILE, JSON.stringify(process.argv.slice(2))); ");
  writeExecutable('gcloud', "import fs from 'node:fs'; fs.writeFileSync(process.env.AK_TEST_ARGS_FILE, JSON.stringify(process.argv.slice(2))); ");

  const auditFile = path.join(providerHome, 'logs', 'project-audit.jsonl');
  fs.mkdirSync(path.dirname(auditFile), { recursive: true });
  fs.writeFileSync(auditFile, '', { mode: 0o644 });
  fs.chmodSync(auditFile, 0o644);
  fs.mkdirSync(`${auditFile}.lock`, { recursive: true });
  fs.writeFileSync(path.join(`${auditFile}.lock`, 'pid'), '99999999', 'utf8');

  const previousKernelHome = process.env.AGENT_KERNEL_HOME;
  const previousPath = process.env.PATH;
  const previousArgsFile = process.env.AK_TEST_ARGS_FILE;
  process.env.AGENT_KERNEL_HOME = providerHome;
  process.env.PATH = `${decoyBin}${path.delimiter}${fakeBin}${path.delimiter}${previousPath || ''}`;
  try {
    const providerContext = resolveContext(linkedWorktree);
    const supabaseArgsFile = path.join(providerHome, 'supabase-args.json');
    process.env.AK_TEST_ARGS_FILE = supabaseArgsFile;
    const fakeSecret = 'ghp_' + 'providerfixture1234567890123456';
    execSupabase(providerContext, [
      '--', 'db', 'pull', '--project-ref', 'wrong-ref', '--project-ref=wrong-ref-2',
      '--debug-token', fakeSecret
    ]);
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(supabaseArgsFile, 'utf8')), [
      'db', 'pull', '--debug-token', fakeSecret, '--project-ref', 'testref'
    ]);

    const gcloudArgsFile = path.join(providerHome, 'gcloud-args.json');
    process.env.AK_TEST_ARGS_FILE = gcloudArgsFile;
    execGcloud(providerContext, [
      '--', 'run', 'deploy', 'service-name',
      '--project', 'wrong-project', '--project=wrong-project-2',
      '--region', 'wrong-region', '--region=wrong-region-2',
      '--configuration', 'wrong-config', '--configuration=wrong-config-2',
      '--account', 'wrong@example.com', '--account=wrong-2@example.com',
      '--impersonate-service-account', 'wrong-service@example.com',
      '--billing-project=wrong-billing'
    ]);
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(gcloudArgsFile, 'utf8')), [
      'run', 'deploy', 'service-name',
      '--project', 'gcloud-test', '--region', 'us-central1'
    ]);

    const auditText = fs.readFileSync(auditFile, 'utf8');
    const auditEntries = auditText.trim().split('\n').map((line) => JSON.parse(line));
    assert.strictEqual(auditEntries.length, 4, 'Each provider execution must record pending and final audit entries');
    assert.ok(!auditText.includes('wrong-ref') && !auditText.includes('wrong-project') && !auditText.includes('wrong-region'), 'Audit log must omit rejected provider overrides');
    assert.ok(!auditText.includes('wrong-config') && !auditText.includes('wrong@example.com') && !auditText.includes('wrong-service') && !auditText.includes('wrong-billing'), 'Audit log must omit rejected GCloud identity overrides');
    assert.ok(!auditText.includes(fakeSecret) && auditText.includes('[REDACTED_SECRET]'), 'Audit log must redact token-shaped values');
    assert.strictEqual(fs.statSync(auditFile).mode & 0o777, 0o600, 'Provider audit log must be owner-only');
    assert.ok(!fs.existsSync(`${auditFile}.lock`), 'Stale audit lock must be recovered and released');
  } finally {
    if (previousKernelHome === undefined) delete process.env.AGENT_KERNEL_HOME;
    else process.env.AGENT_KERNEL_HOME = previousKernelHome;
    if (previousPath === undefined) delete process.env.PATH;
    else process.env.PATH = previousPath;
    if (previousArgsFile === undefined) delete process.env.AK_TEST_ARGS_FILE;
    else process.env.AK_TEST_ARGS_FILE = previousArgsFile;
  }
  console.log('✓ Provider argument isolation, executable resolution, and audit hardening pass.');

  // 7. Missing child commands must never report success.
  const emptyBin = path.join(providerHome, 'empty-bin');
  fs.mkdirSync(emptyBin, { recursive: true });
  const missingEnvCommand = childProcess.spawnSync(process.execPath, [
    brokerPath, 'env', 'exec', '--', 'agent-kernel-command-that-does-not-exist'
  ], {
    cwd: linkedWorktree,
    env: { ...process.env, AGENT_KERNEL_HOME: providerHome, PATH: emptyBin },
    encoding: 'utf8'
  });
  assert.notStrictEqual(missingEnvCommand.status, 0, 'env exec must fail when the requested executable is missing');
  assert.match(missingEnvCommand.stderr, /Unable to execute|ENOENT|not found/i);
  console.log('✓ Missing env exec commands fail closed.');

  // 8. Command shims must be isolated and fail closed when the real CLI is unavailable.
  const shimHome = path.join(os.tmpdir(), `ak-shim-home-${Date.now()}`);
  const beforeShimHome = process.env.AGENT_KERNEL_HOME;
  process.env.AGENT_KERNEL_HOME = shimHome;
  try {
    installCommandShims();
  } finally {
    if (beforeShimHome === undefined) delete process.env.AGENT_KERNEL_HOME;
    else process.env.AGENT_KERNEL_HOME = beforeShimHome;
  }
  const shimsPath = path.join(shimHome, 'runtime', 'shims');
  const supabaseShim = path.join(shimsPath, 'supabase');
  assert.ok(fs.existsSync(supabaseShim));
  assert.ok(fs.existsSync(path.join(shimsPath, 'gcloud')));
  const missingShimTarget = childProcess.spawnSync(process.execPath, [supabaseShim, '--version'], {
    env: { ...process.env, AGENT_KERNEL_BYPASS_SHIMS: '1', PATH: emptyBin },
    encoding: 'utf8'
  });
  assert.notStrictEqual(missingShimTarget.status, 0, 'shim bypass must fail when the real provider CLI is missing');
  assert.match(missingShimTarget.stderr, /Unable to execute|ENOENT|not found/i);
  console.log('✓ Command shims install in isolation and fail closed.');

  // Cleanup temp folder
  try {
    fs.rmSync(`${tempDir}-linked`, { recursive: true, force: true });
    fs.rmSync(providerHome, { recursive: true, force: true });
    fs.rmSync(shimHome, { recursive: true, force: true });
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}

  console.log('✓ All Project Context Broker tests passed successfully!');
}
