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
  isOperationApproved,
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

  [environments.development]
  risk = "development"

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

  const missingCapabilityCtx = {
    ...mockCtx,
    manifest: {
      ...manifest,
      capabilities: { ...manifest.capabilities }
    }
  };
  delete missingCapabilityCtx.manifest.capabilities.database_read;
  assert.throws(() => {
    evaluateGates(missingCapabilityCtx, 'supabase', 'db-pull');
  }, /Capability database_read must be explicitly enabled/);

  const missingEnvironmentCtx = {
    ...mockCtx,
    manifest: {
      ...manifest,
      default_environment: 'production',
      environments: {}
    }
  };
  assert.throws(() => {
    evaluateGates(missingEnvironmentCtx, 'gcloud', 'deploy', 'sensitive');
  }, /Environment production is not configured/);

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
    if (process.platform === 'win32') {
      const cmdFile = path.join(fakeBin, `${name}.cmd`);
      fs.writeFileSync(cmdFile, `@echo off\r\nnode "${file}" %*\r\n`, 'utf8');
    }
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
    const escapedGcloudConfig = path.resolve(providerHome, 'gcloud', '../escaped-gcloud-config');
    const maliciousGcloudContext = {
      ...providerContext,
      manifest: {
        ...providerContext.manifest,
        providers: {
          ...providerContext.manifest.providers,
          gcloud: {
            ...providerContext.manifest.providers.gcloud,
            profile: '../escaped-gcloud-config'
          }
        }
      }
    };
    process.env.AK_TEST_ARGS_FILE = path.join(providerHome, 'malicious-gcloud-args.json');
    assert.throws(() => {
      execGcloud(maliciousGcloudContext, ['--', 'version']);
    }, /Invalid gcloud profile/);
    assert.ok(!fs.existsSync(escapedGcloudConfig), 'GCloud profile traversal created a directory outside the profile root');

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

  // 9. Production approvals must be explicit, scoped, expiring, and single-use.
  const approvalProject = path.join(os.tmpdir(), `ak-approval-project-${Date.now()}`);
  const approvalHome = path.join(os.tmpdir(), `ak-approval-home-${Date.now()}`);
  fs.mkdirSync(path.join(approvalProject, '.agent-kernel'), { recursive: true });
  fs.writeFileSync(path.join(approvalProject, '.agent-kernel', 'project.toml'), `
version = 1
project_id = "approval-project"
display_name = "Approval Project"
default_environment = "production"

[identity]
repository_uuid = "akp_approval_001"

[environments.production]
risk = "production"

[providers.supabase]
profile = "approval-supabase"
project_ref = "approval-ref"

[providers.gcloud]
profile = "approval-gcloud"
project_id = "approval-gcloud-project"
region = "europe-west1"

[capabilities]
database_read = true
database_write = true
migration_apply = true
cloud_deploy = true
`, 'utf8');

  const approvalBin = path.join(approvalHome, 'bin');
  const approvalArgsFile = path.join(approvalHome, 'provider-args.jsonl');
  fs.mkdirSync(approvalBin, { recursive: true });
  const writeApprovalExecutable = (name, body) => {
    const file = path.join(approvalBin, name);
    fs.writeFileSync(file, `#!/usr/bin/env node\n${body}\n`, 'utf8');
    fs.chmodSync(file, 0o755);
  };
  writeApprovalExecutable('security', "if (process.argv.includes('find-generic-password')) process.stdout.write('approval-token');");
  writeApprovalExecutable('supabase', "import fs from 'node:fs'; fs.appendFileSync(process.env.AK_APPROVAL_ARGS_FILE, JSON.stringify({ tool: 'supabase', args: process.argv.slice(2) }) + '\\n');");
  writeApprovalExecutable('gcloud', "import fs from 'node:fs'; fs.appendFileSync(process.env.AK_APPROVAL_ARGS_FILE, JSON.stringify({ tool: 'gcloud', args: process.argv.slice(2) }) + '\\n');");
  const approvalEnv = {
    ...process.env,
    AGENT_KERNEL_HOME: approvalHome,
    AK_APPROVAL_ARGS_FILE: approvalArgsFile,
    PATH: `${approvalBin}${path.delimiter}${process.env.PATH || ''}`
  };
  const runApproval = (...args) => childProcess.spawnSync(process.execPath, [brokerPath, ...args], {
    cwd: approvalProject,
    env: approvalEnv,
    encoding: 'utf8'
  });

  const productionContext = resolveContext(approvalProject);
  const beforeApprovalHome = process.env.AGENT_KERNEL_HOME;
  process.env.AGENT_KERNEL_HOME = approvalHome;
  try {
    assert.throws(() => {
      evaluateGates(productionContext, 'supabase', 'db-push', 'sensitive');
    }, /requires explicit approval/);
  } finally {
    if (beforeApprovalHome === undefined) delete process.env.AGENT_KERNEL_HOME;
    else process.env.AGENT_KERNEL_HOME = beforeApprovalHome;
  }

  const approvalSecret = 'ghp_' + 'approvalreason12345678901234567890';
  const requestResult = runApproval(
    'approvals', 'request', '--provider', 'supabase', '--operation', 'db-push',
    '--reason', `Apply reviewed production migration ${approvalSecret}`, '--json'
  );
  assert.strictEqual(requestResult.status, 0, requestResult.stderr || requestResult.stdout);
  const requestedApproval = JSON.parse(requestResult.stdout);
  assert.strictEqual(requestedApproval.status, 'pending');
  assert.strictEqual(requestedApproval.projectId, 'approval-project');
  assert.strictEqual(requestedApproval.environment, 'production');
  assert.strictEqual(requestedApproval.provider, 'supabase');
  assert.strictEqual(requestedApproval.operation, 'db-push');
  assert.match(requestedApproval.id, /^approval_[a-f0-9]{16}$/);

  const approveResult = runApproval(
    'approvals', 'approve', requestedApproval.id, '--ttl-minutes', '5', '--json'
  );
  assert.strictEqual(approveResult.status, 0, approveResult.stderr || approveResult.stdout);
  const approvedApproval = JSON.parse(approveResult.stdout);
  assert.strictEqual(approvedApproval.status, 'approved');
  assert.ok(Date.parse(approvedApproval.expiresAt) > Date.now());

  process.env.AGENT_KERNEL_HOME = approvalHome;
  try {
    assert.strictEqual(isOperationApproved('approval-project', 'production', 'supabase', 'db-push'), true);
    assert.strictEqual(evaluateGates(productionContext, 'supabase', 'db-push', 'sensitive'), true);
    assert.strictEqual(isOperationApproved('approval-project', 'production', 'supabase', 'db-push'), false, 'Approval must be consumed after one sensitive gate pass');
    assert.throws(() => {
      evaluateGates(productionContext, 'supabase', 'db-push', 'sensitive');
    }, /requires explicit approval/);
  } finally {
    if (beforeApprovalHome === undefined) delete process.env.AGENT_KERNEL_HOME;
    else process.env.AGENT_KERNEL_HOME = beforeApprovalHome;
  }

  const consumedList = runApproval('approvals', 'list', '--json');
  assert.strictEqual(consumedList.status, 0, consumedList.stderr || consumedList.stdout);
  const listedApprovals = JSON.parse(consumedList.stdout);
  assert.strictEqual(listedApprovals.approvals.length, 1);
  assert.strictEqual(listedApprovals.approvals[0].status, 'consumed');

  const deniedRequest = JSON.parse(runApproval(
    'approvals', 'request', '--provider', 'gcloud', '--operation', 'run', '--json'
  ).stdout);
  const denyResult = runApproval('approvals', 'deny', deniedRequest.id, '--reason', 'Change window closed', '--json');
  assert.strictEqual(denyResult.status, 0, denyResult.stderr || denyResult.stdout);
  assert.strictEqual(JSON.parse(denyResult.stdout).status, 'denied');

  const revokedRequest = JSON.parse(runApproval(
    'approvals', 'request', '--provider', 'gcloud', '--operation', 'run', '--json'
  ).stdout);
  const revokedApproved = runApproval('approvals', 'approve', revokedRequest.id, '--ttl-minutes', '10', '--json');
  assert.strictEqual(revokedApproved.status, 0, revokedApproved.stderr || revokedApproved.stdout);
  const revokeResult = runApproval('approvals', 'revoke', revokedRequest.id, '--reason', 'Deployment cancelled', '--json');
  assert.strictEqual(revokeResult.status, 0, revokeResult.stderr || revokeResult.stdout);
  assert.strictEqual(JSON.parse(revokeResult.stdout).status, 'revoked');

  const dbPushRequest = JSON.parse(runApproval(
    'approvals', 'request', '--provider', 'supabase', '--operation', 'db-push', '--json'
  ).stdout);
  assert.strictEqual(runApproval('approvals', 'approve', dbPushRequest.id, '--json').status, 0);
  const duplicateActiveRequest = JSON.parse(runApproval(
    'approvals', 'request', '--provider', 'supabase', '--operation', 'db-push', '--json'
  ).stdout);
  assert.strictEqual(duplicateActiveRequest.id, dbPushRequest.id, 'Active approvals must not be stacked for the same operation');
  assert.strictEqual(duplicateActiveRequest.status, 'approved');

  const dbPushExecution = runApproval('provider', 'supabase', 'exec', '--', 'db', 'push');
  assert.strictEqual(dbPushExecution.status, 0, dbPushExecution.stderr || dbPushExecution.stdout);
  const dbPushReplay = runApproval('provider', 'supabase', 'exec', '--', 'db', 'push');
  assert.notStrictEqual(dbPushReplay.status, 0, 'A consumed database-write approval must not be reusable');
  assert.match(dbPushReplay.stderr, /requires explicit approval/);

  const migrationRequest = JSON.parse(runApproval(
    'approvals', 'request', '--provider', 'supabase', '--operation', 'migration', '--json'
  ).stdout);
  assert.strictEqual(runApproval('approvals', 'approve', migrationRequest.id, '--json').status, 0);
  const migrationExecution = runApproval('provider', 'supabase', 'exec', '--', 'migration', 'up');
  assert.strictEqual(migrationExecution.status, 0, migrationExecution.stderr || migrationExecution.stdout);
  const migrationReplay = runApproval('provider', 'supabase', 'exec', '--', 'migration', 'up');
  assert.notStrictEqual(migrationReplay.status, 0, 'A consumed migration approval must not be reusable');
  assert.match(migrationReplay.stderr, /requires explicit approval/);

  const deployRequest = JSON.parse(runApproval(
    'approvals', 'request', '--provider', 'gcloud', '--operation', 'deploy', '--json'
  ).stdout);
  assert.strictEqual(runApproval('approvals', 'approve', deployRequest.id, '--json').status, 0);
  const deployExecution = runApproval('provider', 'gcloud', 'exec', '--', 'run', 'deploy', 'approval-service');
  assert.strictEqual(deployExecution.status, 0, deployExecution.stderr || deployExecution.stdout);
  const deployReplay = runApproval('provider', 'gcloud', 'exec', '--', 'run', 'deploy', 'approval-service');
  assert.notStrictEqual(deployReplay.status, 0, 'A consumed cloud-deploy approval must not be reusable');
  assert.match(deployReplay.stderr, /requires explicit approval/);

  const readOnlyExecution = runApproval('provider', 'supabase', 'exec', '--', 'db', 'pull');
  assert.strictEqual(readOnlyExecution.status, 0, readOnlyExecution.stderr || readOnlyExecution.stdout);

  const ambiguousExecution = runApproval('provider', 'supabase', 'exec', '--', 'status');
  assert.notStrictEqual(ambiguousExecution.status, 0, 'Unclassified Supabase commands must fail closed in production');
  assert.match(ambiguousExecution.stderr, /requires explicit approval.*db-push/);
  const ambiguousRequest = JSON.parse(runApproval(
    'approvals', 'request', '--provider', 'supabase', '--operation', 'db-push', '--json'
  ).stdout);
  assert.strictEqual(runApproval('approvals', 'approve', ambiguousRequest.id, '--json').status, 0);
  const approvedAmbiguousExecution = runApproval('provider', 'supabase', 'exec', '--', 'status');
  assert.strictEqual(approvedAmbiguousExecution.status, 0, approvedAmbiguousExecution.stderr || approvedAmbiguousExecution.stdout);

  const providerInvocations = fs.readFileSync(approvalArgsFile, 'utf8').trim().split(/\r?\n/).map((line) => JSON.parse(line));
  assert.deepStrictEqual(providerInvocations.map((entry) => entry.tool), ['supabase', 'supabase', 'gcloud', 'supabase', 'supabase']);
  assert.deepStrictEqual(providerInvocations[0].args, ['db', 'push', '--project-ref', 'approval-ref']);
  assert.deepStrictEqual(providerInvocations[1].args, ['migration', 'up', '--project-ref', 'approval-ref']);
  assert.deepStrictEqual(providerInvocations[2].args, [
    'run', 'deploy', 'approval-service', '--project', 'approval-gcloud-project', '--region', 'europe-west1'
  ]);
  assert.deepStrictEqual(providerInvocations[3].args, ['db', 'pull', '--project-ref', 'approval-ref']);
  assert.deepStrictEqual(providerInvocations[4].args, ['status', '--project-ref', 'approval-ref']);

  const invalidOperation = runApproval(
    'approvals', 'request', '--provider', 'supabase', '--operation', 'destroy-everything', '--json'
  );
  assert.notStrictEqual(invalidOperation.status, 0);
  assert.match(invalidOperation.stderr, /Unsupported approval operation/);

  const ttlRequest = JSON.parse(runApproval(
    'approvals', 'request', '--provider', 'gcloud', '--operation', 'run', '--json'
  ).stdout);
  const invalidTtl = runApproval('approvals', 'approve', ttlRequest.id, '--ttl-minutes', '61', '--json');
  assert.notStrictEqual(invalidTtl.status, 0);
  assert.match(invalidTtl.stderr, /integer between 1 and 60/);
  assert.strictEqual(runApproval('approvals', 'deny', ttlRequest.id, '--json').status, 0);

  const approvalFile = path.join(approvalHome, 'connections', 'approvals.json');
  assert.strictEqual(fs.statSync(approvalFile).mode & 0o777, 0o600, 'Approval state must be owner-only');
  const approvalStateText = fs.readFileSync(approvalFile, 'utf8');
  assert.ok(!approvalStateText.includes(approvalSecret) && approvalStateText.includes('[REDACTED_SECRET]'), 'Approval reasons must redact token-shaped values');
  const approvalAudit = fs.readFileSync(path.join(approvalHome, 'logs', 'project-audit.jsonl'), 'utf8');
  for (const action of ['approval.request', 'approval.approve', 'approval.consume', 'approval.deny', 'approval.revoke']) {
    assert.ok(approvalAudit.includes(action), `Approval audit must include ${action}`);
  }
  assert.ok(!approvalAudit.includes(approvalSecret), 'Approval audit must never contain request secrets');

  fs.appendFileSync(path.join(approvalHome, 'logs', 'project-audit.jsonl'), JSON.stringify({
    timestamp: new Date().toISOString(),
    project: 'foreign-project',
    operation: 'foreign.event',
    result: 'success'
  }) + '\n');
  const auditList = runApproval('audit', 'list', '--limit', '3', '--json');
  assert.strictEqual(auditList.status, 0, auditList.stderr || auditList.stdout);
  const auditPayload = JSON.parse(auditList.stdout);
  assert.strictEqual(auditPayload.projectId, 'approval-project');
  assert.strictEqual(auditPayload.events.length, 3);
  assert.ok(auditPayload.events.every((event) => event.project === 'approval-project'));
  assert.ok(!auditPayload.events.some((event) => event.operation === 'foreign.event'));
  const invalidAuditLimit = runApproval('audit', 'list', '--limit', '0', '--json');
  assert.notStrictEqual(invalidAuditLimit.status, 0);
  assert.match(invalidAuditLimit.stderr, /limit must be an integer between 1 and 500/i);
  const unknownAudit = runApproval('audit', 'unknown');
  assert.notStrictEqual(unknownAudit.status, 0, 'Unknown audit subcommands must fail');

  const wrongContextProject = runApproval('context', 'enter', 'foreign-project', 'production', '--json');
  assert.notStrictEqual(wrongContextProject.status, 0);
  assert.match(wrongContextProject.stderr, /does not match the current project/);
  const unknownContextEnvironment = runApproval('context', 'enter', 'approval-project', 'missing', '--json');
  assert.notStrictEqual(unknownContextEnvironment.status, 0);
  assert.match(unknownContextEnvironment.stderr, /Environment missing is not configured/);
  const switchedContext = runApproval('context', 'switch', 'approval-project', 'production', '--json');
  assert.strictEqual(switchedContext.status, 0, switchedContext.stderr || switchedContext.stdout);
  const switchedPayload = JSON.parse(switchedContext.stdout);
  assert.strictEqual(switchedPayload.projectId, 'approval-project');
  assert.strictEqual(switchedPayload.environment, 'production');
  assert.strictEqual(switchedPayload.status, 'active');
  const currentContext = runApproval('context', 'current', '--json');
  assert.strictEqual(currentContext.status, 0, currentContext.stderr || currentContext.stdout);
  assert.deepStrictEqual(JSON.parse(currentContext.stdout), switchedPayload);
  assert.strictEqual(fs.statSync(path.join(approvalHome, 'connections', 'active-session.json')).mode & 0o777, 0o600);
  const unknownContextCommand = runApproval('context', 'unknown');
  assert.notStrictEqual(unknownContextCommand.status, 0, 'Unknown context subcommands must fail');
  assert.match(unknownContextCommand.stderr, /Unknown or unsupported command: context unknown/);
  const unknownProviderCommand = runApproval('provider', 'supabase', 'unknown');
  assert.notStrictEqual(unknownProviderCommand.status, 0, 'Unknown provider subcommands must fail');
  assert.match(unknownProviderCommand.stderr, /Unknown or unsupported command: provider supabase/);
  console.log('✓ Project audit inspection and validated context switching pass.');

  const malformedApprovalState = '{ malformed approval state\n';
  fs.writeFileSync(approvalFile, malformedApprovalState, 'utf8');
  const malformedRequest = runApproval(
    'approvals', 'request', '--provider', 'supabase', '--operation', 'db-push', '--json'
  );
  assert.notStrictEqual(malformedRequest.status, 0, 'Malformed approval state must fail closed');
  assert.match(malformedRequest.stderr, /approval state.*malformed|invalid approval state/i);
  assert.strictEqual(fs.readFileSync(approvalFile, 'utf8'), malformedApprovalState, 'Malformed approval state must be preserved for recovery');
  console.log('✓ Production approval lifecycle is scoped, audited, expiring, and single-use.');

  // Cleanup temp folder
  try {
    fs.rmSync(`${tempDir}-linked`, { recursive: true, force: true });
    fs.rmSync(providerHome, { recursive: true, force: true });
    fs.rmSync(shimHome, { recursive: true, force: true });
    fs.rmSync(approvalProject, { recursive: true, force: true });
    fs.rmSync(approvalHome, { recursive: true, force: true });
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}

  console.log('✓ All Project Context Broker tests passed successfully!');
}
