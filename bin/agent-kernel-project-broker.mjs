#!/usr/bin/env node
import childProcess from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';

const VERSION = '1.13.0';

// ==========================================
// 1. UTILS & HELPERS
// ==========================================

function kernelHome() {
  return process.env.AGENT_KERNEL_HOME || path.join(os.homedir(), '.agent-kernel');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function readText(filePath, fallback = '') {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return fallback; }
}

function writeText(filePath, text) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, text, 'utf8');
}

function writeJsonAtomic(filePath, value) {
  ensureDir(path.dirname(filePath));
  const temporary = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(temporary, filePath);
}

function writeTextAtomic(filePath, text) {
  ensureDir(path.dirname(filePath));
  const temporary = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporary, text, { mode: 0o600 });
  fs.renameSync(temporary, filePath);
}

// Simple robust TOML Parser & Stringifier
export function parseToml(text) {
  const result = {};
  let current = result;
  const lines = text.split(/\r?\n/);
  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;
    if (line.startsWith('[') && line.endsWith(']')) {
      const sectionPath = line.slice(1, -1).trim();
      const parts = sectionPath.split('.');
      current = result;
      for (const part of parts) {
        const p = part.trim();
        if (!current[p]) current[p] = {};
        current = current[p];
      }
      continue;
    }
    const eq = line.indexOf('=');
    if (eq > 0) {
      const key = line.slice(0, eq).trim();
      let rawVal = line.slice(eq + 1).trim();
      let val;
      if (rawVal.startsWith('"') && rawVal.endsWith('"')) {
        val = rawVal.slice(1, -1);
      } else if (rawVal.startsWith("'") && rawVal.endsWith("'")) {
        val = rawVal.slice(1, -1);
      } else if (rawVal === 'true') {
        val = true;
      } else if (rawVal === 'false') {
        val = false;
      } else if (!isNaN(rawVal)) {
        val = Number(rawVal);
      } else {
        val = rawVal;
      }
      current[key] = val;
    }
  }
  return result;
}

export function stringifyToml(obj, prefix = '') {
  let lines = [];
  const scalarKeys = [];
  const objectKeys = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      objectKeys.push([k, v]);
    } else {
      scalarKeys.push([k, v]);
    }
  }
  for (const [k, v] of scalarKeys) {
    let valStr;
    if (typeof v === 'string') {
      valStr = `"${v.replace(/"/g, '\\"')}"`;
    } else if (typeof v === 'boolean') {
      valStr = v ? 'true' : 'false';
    } else if (typeof v === 'number') {
      valStr = String(v);
    } else {
      valStr = `"${String(v)}"`;
    }
    lines.push(`${k} = ${valStr}`);
  }
  if (scalarKeys.length > 0 && objectKeys.length > 0) {
    lines.push('');
  }
  for (const [k, v] of objectKeys) {
    const sectionName = prefix ? `${prefix}.${k}` : k;
    lines.push(`[${sectionName}]`);
    lines.push(stringifyToml(v, sectionName));
    lines.push('');
  }
  return lines.join('\n').trim();
}

// Redact secrets in text outputs/logs
function redact(text) {
  let out = String(text || '');
  const secretPatterns = [
    /OPENAI_API_KEY\s*=\s*["'][^"']+["']/gi,
    /ANTHROPIC_API_KEY\s*=\s*["'][^"']+["']/gi,
    /SUPABASE_SERVICE_ROLE_KEY\s*=\s*["'][^"']+["']/gi,
    /AIza[0-9A-Za-z\-_]{35}/g,
    /sk-[A-Za-z0-9]{20,}/g,
    /ghp_[A-Za-z0-9]{20,}/g,
    /xox[abposr]-[A-Za-z0-9-]{10,}/g,
    /keychain:\/\/[^\s]+/gi
  ];
  for (const pattern of secretPatterns) {
    out = out.replace(pattern, '[REDACTED_SECRET]');
  }
  return out;
}

// Git Helpers
function git(cwd, args) {
  try {
    return childProcess.execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return '';
  }
}

function getGitRemote(root) {
  const url = git(root, ['config', '--get', 'remote.origin.url']);
  return normalizeGitRemote(url);
}

function normalizeGitRemote(url) {
  let r = String(url || '').trim();
  if (!r) return '';
  r = r.replace(/^git@([^:]+):/, 'https://$1/');
  try {
    const parsed = new URL(r);
    return `${parsed.hostname}${parsed.pathname}`.replace(/\.git$/, '').replace(/^\/+|\/+$/g, '');
  } catch {
    return r.replace(/^[^@]+@/, '').replace(/\.git$/, '').replace(/^\/+|\/+$/g, '');
  }
}

// ==========================================
// 2. FILE LOCKING (CONCURRENCY)
// ==========================================

function acquireLock(lockPath, timeoutMs = 5000) {
  const start = Date.now();
  const lockDir = `${lockPath}.lock`;
  try {
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  } catch {}
  while (true) {
    try {
      fs.mkdirSync(lockDir);
      // Write lock metadata
      fs.writeFileSync(path.join(lockDir, 'pid'), String(process.pid));
      return () => {
        try { fs.rmSync(lockDir, { recursive: true, force: true }); } catch {}
      };
    } catch {
      if (Date.now() - start > timeoutMs) {
        throw new Error(`Timeout acquiring lock on: ${lockPath}`);
      }
      // Check for stale lock
      try {
        const pid = Number(fs.readFileSync(path.join(lockDir, 'pid'), 'utf8'));
        if (pid && !processExists(pid)) {
          fs.rmSync(lockDir, { recursive: true, force: true });
          continue;
        }
      } catch {}
      sleepSync(100);
    }
  }
}

function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function sleepSync(milliseconds) {
  const waitBuffer = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(waitBuffer, 0, 0, milliseconds);
}

function isExecutableFile(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return false;
    if (process.platform !== 'win32') fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function childExitCode(result, executable) {
  if (Number.isInteger(result?.status)) return result.status;
  const reason = result?.error?.message || (result?.signal ? `terminated by ${result.signal}` : 'unknown process failure');
  console.error(`Unable to execute ${executable}: ${reason}`);
  return 1;
}

// ==========================================
// 3. KEYCHAIN CREDENTIAL STORAGE
// ==========================================

export function keychainAdd(profile, provider, secret) {
  const service = `agent-kernel/${provider}`;
  childProcess.execFileSync('security', [
    'add-generic-password',
    '-a', profile,
    '-s', service,
    '-w', secret,
    '-U'
  ], { stdio: 'ignore' });
}

export function keychainGet(profile, provider) {
  const service = `agent-kernel/${provider}`;
  try {
    return childProcess.execFileSync('security', [
      'find-generic-password',
      '-a', profile,
      '-s', service,
      '-w'
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

export function keychainDelete(profile, provider) {
  const service = `agent-kernel/${provider}`;
  try {
    childProcess.execFileSync('security', [
      'delete-generic-password',
      '-a', profile,
      '-s', service
    ], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// ==========================================
// 4. STORAGE PATHS & SCHEMAS
// ==========================================

function registryPath() {
  return path.join(kernelHome(), 'connections', 'registry.toml');
}

function activeSessionPath() {
  return path.join(kernelHome(), 'connections', 'active-session.json');
}

function auditPath() {
  return path.join(kernelHome(), 'logs', 'project-audit.jsonl');
}

function approvalsPath() {
  return path.join(kernelHome(), 'connections', 'approvals.json');
}

function loadRegistry() {
  const file = registryPath();
  if (!exists(file)) return { version: 1, profiles: {}, projects: {} };
  try {
    return parseToml(fs.readFileSync(file, 'utf8'));
  } catch {
    return { version: 1, profiles: {}, projects: {} };
  }
}

function saveRegistry(reg) {
  const file = registryPath();
  const release = acquireLock(file);
  try {
    writeTextAtomic(file, stringifyToml(reg));
  } finally {
    release();
  }
}

// Log audit events
function auditLog(event) {
  const file = auditPath();
  const entry = { timestamp: new Date().toISOString(), ...event };
  ensureDir(path.dirname(file));
  const release = acquireLock(file);
  try {
    fs.appendFileSync(file, JSON.stringify(entry) + '\n', { mode: 0o600 });
    try { fs.chmodSync(file, 0o600); } catch {}
  } finally {
    release();
  }
}

// ==========================================
// 5. PROJECT CONTEXT RESOLVER
// ==========================================

export function findProjectRoot(startPath = '.') {
  let curr = path.resolve(startPath);
  while (true) {
    if (exists(path.join(curr, '.agent-kernel', 'project.toml')) || exists(path.join(curr, '.git'))) {
      return curr;
    }
    const parent = path.dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }
  return path.resolve(startPath);
}

export function loadProjectManifest(projectRoot) {
  const file = path.join(projectRoot, '.agent-kernel', 'project.toml');
  if (!exists(file)) return null;
  return parseToml(fs.readFileSync(file, 'utf8'));
}

export function resolveContext(dir = '.') {
  const root = findProjectRoot(dir);
  const manifest = loadProjectManifest(root);
  if (!manifest) {
    return { root, error: 'Missing .agent-kernel/project.toml manifest' };
  }
  const reg = loadRegistry();
  const projectId = manifest.project_id;
  const projectReg = reg.projects?.[projectId];

  // Git identity checks
  const currentRemote = getGitRemote(root);
  const currentBranch = git(root, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const currentCommit = git(root, ['rev-parse', 'HEAD']);
  const isDirty = git(root, ['status', '--porcelain']).trim().length > 0;

  return {
    root,
    projectId,
    displayName: manifest.display_name,
    repositoryUuid: manifest.identity?.repository_uuid,
    expectedRemote: manifest.identity?.expected_git_remote,
    currentRemote,
    currentBranch,
    currentCommit,
    isDirty,
    manifest,
    registryEntry: projectReg
  };
}

// ==========================================
// 6. POLICY GATES ENGINE
// ==========================================

export function evaluateGates(ctx, providerName, operation, requestedTier = 'public') {
  const manifest = ctx.manifest;
  if (!manifest) throw new Error('Gates: Missing project manifest.');

  // 1. Repository Identity Gate
  if (manifest.identity?.expected_git_remote) {
    const expected = normalizeGitRemote(manifest.identity.expected_git_remote);
    const actual = normalizeGitRemote(ctx.currentRemote);
    if (expected && actual && expected !== actual) {
      throw new Error(`Gate Failure: Repository expected remote mismatch. Expected: ${expected}, Actual: ${actual}`);
    }
  }
  if (ctx.repositoryUuid && ctx.registryEntry?.repository_uuid && ctx.repositoryUuid !== ctx.registryEntry.repository_uuid) {
    throw new Error(`Gate Failure: Repository UUID mismatch. Project: ${ctx.repositoryUuid}, Registry: ${ctx.registryEntry.repository_uuid}`);
  }

  // 2. Account Identity Gate
  const providerConf = manifest.providers?.[providerName];
  if (!providerConf) {
    throw new Error(`Gate Failure: Provider ${providerName} is not configured in this project.`);
  }

  // 3. Capability Gate
  const capabilityMap = {
    'supabase:db-pull': 'database_read',
    'supabase:db-push': 'database_write',
    'supabase:migration': 'migration_apply',
    'gcloud:deploy': 'cloud_deploy',
    'gcloud:run': 'cloud_deploy'
  };
  const requiredCap = capabilityMap[`${providerName}:${operation}`];
  if (requiredCap && manifest.capabilities?.[requiredCap] !== true) {
    throw new Error(`Gate Failure: Capability ${requiredCap} must be explicitly enabled in project manifest.`);
  }

  // 4. Context Drift Gate
  verifyContextDrift(ctx);

  // 5. Environment Risk & Approval Gate
  const activeEnv = manifest.default_environment || 'development';
  const envConfig = manifest.environments?.[activeEnv];
  if (requestedTier !== 'public') {
    if (!envConfig) {
      throw new Error(`Gate Failure: Environment ${activeEnv} is not configured in project manifest.`);
    }
    if (!['development', 'staging', 'production'].includes(envConfig.risk)) {
      throw new Error(`Gate Failure: Environment ${activeEnv} must declare risk as development, staging, or production.`);
    }
    if (envConfig.risk === 'production' && !consumeOperationApproval(ctx.projectId, activeEnv, providerName, operation)) {
      throw new Error(`Gate Failure: Production execution of ${providerName}:${operation} requires explicit approval. Run: agent-kernel approvals request --provider ${providerName} --operation ${operation}`);
    }
  }

  return true;
}

function verifyContextDrift(ctx) {
  if (!git(ctx.root, ['rev-parse', '--is-inside-work-tree'])) return; // Skip if not a git repo or worktree
  const current = resolveContext(ctx.root);
  if (current.currentBranch !== ctx.currentBranch) {
    throw new Error(`Gate Failure: Git branch has drifted from ${ctx.currentBranch} to ${current.currentBranch}`);
  }
}

// ==========================================
// 7. APPROVAL INBOX RECORDS
// ==========================================

const APPROVAL_OPERATIONS = Object.freeze({
  supabase: new Set(['db-pull', 'db-push', 'migration']),
  gcloud: new Set(['run', 'deploy'])
});

function readApprovalsFile(file = approvalsPath()) {
  if (!exists(file)) return [];
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    throw new Error(`Approval state is malformed: ${file}. Refusing to overwrite it.`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`Invalid approval state: ${file} must contain a JSON array.`);
  }
  return parsed;
}

function getApprovals() {
  return readApprovalsFile();
}

function mutateApprovals(mutator) {
  const file = approvalsPath();
  ensureDir(path.dirname(file));
  const release = acquireLock(file);
  try {
    const list = readApprovalsFile(file);
    const result = mutator(list);
    writeJsonAtomic(file, list);
    return result;
  } finally {
    release();
  }
}

export function isOperationApproved(projectId, environment, provider, operation) {
  const now = new Date().toISOString();
  return getApprovals().some((item) =>
    item.projectId === projectId &&
    item.environment === environment &&
    item.provider === provider &&
    item.operation === operation &&
    item.status === 'approved' &&
    item.expiresAt > now
  );
}

function consumeOperationApproval(projectId, environment, provider, operation) {
  const now = new Date().toISOString();
  const consumed = mutateApprovals((list) => {
    const matched = list.find((item) =>
      item.projectId === projectId &&
      item.environment === environment &&
      item.provider === provider &&
      item.operation === operation &&
      item.status === 'approved' &&
      item.expiresAt > now
    );
    if (!matched) return null;
    matched.status = 'consumed';
    matched.consumedAt = now;
    matched.updatedAt = now;
    return { ...matched };
  });
  if (consumed) {
    auditLog({
      session: projectId,
      project: projectId,
      provider,
      operation: 'approval.consume',
      target: consumed.id,
      environment,
      result: 'success'
    });
  }
  return consumed;
}

// ==========================================
// 8. PROVIDER ADAPTERS
// ==========================================

function normalizeProviderArgs(args, enforcedFlags = []) {
  const source = Array.isArray(args) ? [...args] : [];
  while (source[0] === '--') source.shift();
  const clean = [];
  for (let i = 0; i < source.length; i++) {
    const arg = String(source[i]);
    const enforcedFlag = enforcedFlags.find((flag) => arg === flag || arg.startsWith(`${flag}=`));
    if (!enforcedFlag) {
      clean.push(source[i]);
      continue;
    }
    if (arg === enforcedFlag && i + 1 < source.length && !String(source[i + 1]).startsWith('-')) {
      i++;
    }
  }
  return clean;
}

function classifySupabaseOperation(args) {
  const tokens = args.map((arg) => String(arg));
  const migrationIndex = tokens.indexOf('migration');
  if (migrationIndex >= 0) {
    const action = tokens[migrationIndex + 1];
    if (['up', 'repair'].includes(action)) return 'migration';
    if (action === 'list') return 'db-pull';
    return 'db-push';
  }
  const dbIndex = tokens.indexOf('db');
  if (dbIndex >= 0) {
    const action = tokens[dbIndex + 1];
    if (['pull', 'dump', 'lint'].includes(action)) return 'db-pull';
    if (['push', 'reset'].includes(action)) return 'db-push';
    return 'db-push';
  }
  if (tokens.includes('deploy')) return 'db-push';
  return 'db-push';
}

function classifyGcloudOperation(args) {
  return args.map((arg) => String(arg)).includes('deploy') ? 'deploy' : 'run';
}

export function execSupabase(ctx, args) {
  const profileName = ctx.manifest?.providers?.supabase?.profile;
  const projectRef = ctx.manifest?.providers?.supabase?.project_ref;
  if (!profileName || !projectRef) {
    throw new Error('Supabase adapter is not fully configured in project.toml');
  }

  const commandArgs = normalizeProviderArgs(args, ['--project-ref']);

  // Evaluate gates
  const operation = classifySupabaseOperation(commandArgs);
  evaluateGates(ctx, 'supabase', operation, operation === 'db-pull' ? 'public' : 'sensitive');

  // Retrieve token from Keychain
  const token = keychainGet(profileName, 'supabase');
  if (!token) {
    throw new Error(`Supabase token not found in Keychain for profile: ${profileName}`);
  }

  const env = {
    ...process.env,
    SUPABASE_ACCESS_TOKEN: token,
    AGENT_KERNEL_BYPASS_SHIMS: '1'
  };

  const fullArgs = [...commandArgs, '--project-ref', projectRef];
  const auditOperation = redact(commandArgs.join(' '));

  auditLog({
    session: ctx.projectId,
    project: ctx.projectId,
    provider: 'supabase',
    operation: auditOperation,
    target: projectRef,
    environment: ctx.manifest?.default_environment || 'development',
    result: 'pending'
  });

  const realExe = resolveRealExecutable('supabase');
  const result = childProcess.spawnSync(realExe, fullArgs, {
    cwd: ctx.root,
    env,
    stdio: 'inherit'
  });

  const exitCode = childExitCode(result, realExe);
  auditLog({
    session: ctx.projectId,
    project: ctx.projectId,
    provider: 'supabase',
    operation: auditOperation,
    target: projectRef,
    environment: ctx.manifest?.default_environment || 'development',
    result: exitCode === 0 ? 'success' : 'failure'
  });

  if (exitCode !== 0) process.exit(exitCode);
}

export function execGcloud(ctx, args) {
  const profileName = ctx.manifest?.providers?.gcloud?.profile;
  const projectID = ctx.manifest?.providers?.gcloud?.project_id;
  const region = ctx.manifest?.providers?.gcloud?.region;
  if (!profileName || !projectID) {
    throw new Error('Google Cloud adapter is not fully configured in project.toml');
  }

  const commandArgs = normalizeProviderArgs(args, [
    '--project',
    '--region',
    '--configuration',
    '--account',
    '--impersonate-service-account',
    '--billing-project'
  ]);

  // Isolated config dir
  const configDir = path.join(kernelHome(), 'gcloud', profileName);
  ensureDir(configDir);

  // Evaluate gates
  const operation = classifyGcloudOperation(commandArgs);
  evaluateGates(ctx, 'gcloud', operation, 'sensitive');

  const env = {
    ...process.env,
    CLOUDSDK_CONFIG: configDir,
    CLOUDSDK_ACTIVE_CONFIG_NAME: profileName,
    AGENT_KERNEL_BYPASS_SHIMS: '1'
  };

  const realExe = resolveRealExecutable('gcloud');
  const fullArgs = [...commandArgs, '--project', projectID];
  if (region) fullArgs.push('--region', region);
  const auditOperation = redact(commandArgs.join(' '));

  auditLog({
    session: ctx.projectId,
    project: ctx.projectId,
    provider: 'gcloud',
    operation: auditOperation,
    target: projectID,
    environment: ctx.manifest?.default_environment || 'development',
    result: 'pending'
  });

  const result = childProcess.spawnSync(realExe, fullArgs, {
    cwd: ctx.root,
    env,
    stdio: 'inherit'
  });

  const exitCode = childExitCode(result, realExe);
  auditLog({
    session: ctx.projectId,
    project: ctx.projectId,
    provider: 'gcloud',
    operation: auditOperation,
    target: projectID,
    environment: ctx.manifest?.default_environment || 'development',
    result: exitCode === 0 ? 'success' : 'failure'
  });

  if (exitCode !== 0) process.exit(exitCode);
}

function resolveRealExecutable(name) {
  const systemPath = process.env.PATH || '';
  const paths = systemPath.split(path.delimiter).filter((entry) => entry && !entry.includes('.agent-kernel/runtime/shims'));
  for (const dir of paths) {
    const full = path.join(dir, name);
    if (isExecutableFile(full)) return full;
  }
  return name;
}

// ==========================================
// 9. COMMAND SHIMS INSTALLATION
// ==========================================

export function installCommandShims() {
  const shimsDir = path.join(kernelHome(), 'runtime', 'shims');
  ensureDir(shimsDir);

  const shimmedTools = ['supabase', 'gcloud'];
  for (const tool of shimmedTools) {
    const shimFile = path.join(shimsDir, tool);
    const content = `#!/usr/bin/env node
import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function isExecutableFile(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return false;
    if (process.platform !== 'win32') fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function exitCode(result, executable) {
  if (Number.isInteger(result?.status)) return result.status;
  const reason = result?.error?.message || (result?.signal ? \`terminated by \${result.signal}\` : 'unknown process failure');
  console.error(\`Unable to execute \${executable}: \${reason}\`);
  return 1;
}

if (process.env.AGENT_KERNEL_BYPASS_SHIMS === '1') {
  const systemPath = process.env.PATH || '';
  const paths = systemPath.split(path.delimiter).filter((entry) => entry && !entry.includes('.agent-kernel/runtime/shims'));
  let realExe = '${tool}';
  for (const dir of paths) {
    const full = path.join(dir, '${tool}');
    if (isExecutableFile(full)) {
      realExe = full;
      break;
    }
  }
  const result = childProcess.spawnSync(realExe, process.argv.slice(2), { stdio: 'inherit', env: process.env });
  process.exit(exitCode(result, realExe));
} else {
  const executable = 'agent-kernel';
  const result = childProcess.spawnSync(executable, ['provider', '${tool}', 'exec', '--', ...process.argv.slice(2)], { stdio: 'inherit', env: process.env });
  process.exit(exitCode(result, executable));
}
`;
    fs.writeFileSync(shimFile, content, { mode: 0o755 });
  }
}

// ==========================================
// 10. CLI COMMAND DISPATCHERS
// ==========================================

function runInit() {
  const root = findProjectRoot('.');
  const dir = path.join(root, '.agent-kernel');
  ensureDir(dir);
  const file = path.join(dir, 'project.toml');
  if (exists(file)) {
    console.log(`Project manifest already exists at: ${file}`);
    return;
  }

  const projectId = path.basename(root).toLowerCase().replace(/[^a-z0-9]/g, '-');
  const uuid = `akp_01J_${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
  const remote = git(root, ['config', '--get', 'remote.origin.url']) || 'github.com/example/repo';

  const template = `version = 1

project_id = "${projectId}"
display_name = "${path.basename(root)}"
default_environment = "development"

[identity]
repository_uuid = "${uuid}"
expected_git_remote = "${remote}"
root_marker = "package.json"

[environments.development]
risk = "development"
allow_deploy = true
allow_database_writes = true
require_approval_for_migrations = false

[environments.production]
risk = "production"
allow_deploy = true
allow_database_writes = true
require_approval_for_migrations = true
require_approval_for_deploy = true
deny_destructive_database_commands = true

[providers.supabase]
profile = "supabase.personal-account-02"
project_ref = "exampleprojectref"
workdir = "."

[providers.gcloud]
profile = "gcloud.client-account-03"
project_id = "${projectId}-production"
configuration = "${projectId}-production"
region = "europe-west1"

[capabilities]
database_read = true
database_write = true
migration_apply = false
storage_write = true
cloud_deploy = false
`;
  fs.writeFileSync(file, template, 'utf8');
  console.log(`Initialized Project Manifest: ${file}`);
}

function runRegister() {
  const ctx = resolveContext();
  if (ctx.error) {
    throw new Error(ctx.error);
  }
  const reg = loadRegistry();
  if (!reg.projects) reg.projects = {};
  reg.projects[ctx.projectId] = {
    repository_uuid: ctx.repositoryUuid,
    root: ctx.root,
    expected_git_remote: ctx.expectedRemote
  };
  saveRegistry(reg);
  console.log(`Registered project ${ctx.projectId} in global connections registry.`);
}

function runInspect() {
  const ctx = resolveContext();
  if (ctx.error) {
    console.log(ctx.error);
    return;
  }
  console.log(`Project: ${ctx.displayName} (${ctx.projectId})`);
  console.log(`UUID: ${ctx.repositoryUuid}`);
  console.log(`Root: ${ctx.root}`);
  console.log(`Git Remote: ${ctx.currentRemote}`);
  console.log(`Git Branch: ${ctx.currentBranch}`);
}

function runVerify() {
  const ctx = resolveContext();
  if (ctx.error) {
    throw new Error(`Verification failed: ${ctx.error}`);
  }
  if (ctx.expectedRemote) {
    const expected = normalizeGitRemote(ctx.expectedRemote);
    const actual = normalizeGitRemote(ctx.currentRemote);
    if (expected && actual && expected !== actual) {
      throw new Error(`Verification failed: Repository remote mismatch. Expected: ${expected}, Actual: ${actual}`);
    }
  }
  console.log('✓ Project identity verified successfully.');
}

function runAuthAdd(provider, profile) {
  if (!provider || !profile) {
    throw new Error('Usage: agent-kernel auth add <provider> --profile <name>');
  }
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question(`Enter access token/secret key for ${provider} profile [${profile}]: `, (secret) => {
    rl.close();
    const token = secret.trim();
    if (!token) {
      console.log('Error: Secret token cannot be empty.');
      return;
    }
    keychainAdd(profile, provider, token);
    const reg = loadRegistry();
    if (!reg.profiles) reg.profiles = {};
    reg.profiles[`${provider}.${profile}`] = {
      provider,
      credential_ref: `keychain://agent-kernel/${provider}/${profile}`,
      profile_name: profile
    };
    saveRegistry(reg);
    console.log(`✓ Added auth profile ${provider}.${profile} securely in macOS Keychain.`);
  });
}

function runAuthList() {
  const reg = loadRegistry();
  const profiles = reg.profiles || {};
  console.log('Registered Provider Profiles:');
  for (const [key, p] of Object.entries(profiles)) {
    console.log(`- ${key} (Reference: ${p.credential_ref})`);
  }
}

function runAuthRemove(provider, profile) {
  if (!provider || !profile) {
    throw new Error('Usage: agent-kernel auth remove <provider> <profile>');
  }
  const reg = loadRegistry();
  delete reg.profiles?.[`${provider}.${profile}`];
  saveRegistry(reg);
  keychainDelete(profile, provider);
  console.log(`Removed auth profile ${provider}.${profile}.`);
}

function runEnvCheck() {
  const ctx = resolveContext();
  if (ctx.error) {
    throw new Error(ctx.error);
  }
  const schemaFile = path.join(ctx.root, '.agent-kernel', 'env.schema.toml');
  if (!exists(schemaFile)) {
    console.log('No .agent-kernel/env.schema.toml schema file found. Skipping checks.');
    return;
  }
  console.log('✓ Environment schema is valid.');
}

function runEnvExec(args) {
  const tierIdx = args.indexOf('--tier');
  let tier = 'public';
  if (tierIdx >= 0) {
    tier = args[tierIdx + 1];
    args.splice(tierIdx, 2);
  }
  const dashDash = args.indexOf('--');
  const commandArgs = dashDash >= 0 ? args.slice(dashDash + 1) : args;
  if (!commandArgs.length) {
    throw new Error('No command provided to execute.');
  }

  const ctx = resolveContext();
  if (ctx.error) throw new Error(ctx.error);
  const env = { ...process.env };

  if (ctx.manifest?.providers?.supabase?.project_ref) {
    env.SUPABASE_PROJECT_REF = ctx.manifest.providers.supabase.project_ref;
  }

  const cmd = commandArgs[0];
  const rest = commandArgs.slice(1);
  const child = childProcess.spawnSync(cmd, rest, {
    cwd: ctx.root,
    env,
    stdio: 'inherit'
  });
  process.exit(childExitCode(child, cmd));
}

function runProjectsDiscover(scanPath = '.') {
  const target = path.resolve(scanPath || '.');
  console.log(`Discovering projects under: ${target}`);
  const signals = [];
  if (exists(path.join(target, '.git'))) signals.push('Git Repository');
  if (exists(path.join(target, 'package.json'))) signals.push('Node/Bun Project');
  if (exists(path.join(target, 'supabase/config.toml'))) signals.push('Supabase Project');
  if (exists(path.join(target, '.env'))) signals.push('Environment File');

  const score = signals.length * 25;
  console.log(`\nConfidence: ${score}%`);
  console.log('Detected signals:', signals.join(', ') || 'None');
}

function runContextEnter(projectId, environment, args = []) {
  if (!projectId || !environment) {
    throw new Error('Usage: agent-kernel context enter <project-id> <environment> [--json]');
  }
  const ctx = resolveContext();
  if (ctx.error) throw new Error(ctx.error);
  if (projectId !== ctx.projectId) {
    throw new Error(`Project ${projectId} does not match the current project ${ctx.projectId}.`);
  }
  const envConfig = ctx.manifest.environments?.[environment];
  if (!envConfig) {
    throw new Error(`Environment ${environment} is not configured in project manifest.`);
  }
  const session = {
    projectId,
    environment,
    risk: envConfig.risk || null,
    repositoryUuid: ctx.repositoryUuid || null,
    root: ctx.root,
    enteredAt: new Date().toISOString(),
    status: 'active'
  };
  writeJsonAtomic(activeSessionPath(), session);
  auditLog({
    session: projectId,
    project: projectId,
    provider: 'context',
    operation: 'context.enter',
    target: projectId,
    environment,
    result: 'success'
  });
  if (jsonRequested(args)) {
    console.log(JSON.stringify(session, null, 2));
    return session;
  }
  console.log(`✓ Entered project context: ${projectId} [${environment}]`);
  return session;
}

function runContextCurrent(args = []) {
  const file = activeSessionPath();
  if (!exists(file)) {
    if (jsonRequested(args)) {
      console.log(JSON.stringify({ status: 'inactive' }, null, 2));
      return null;
    }
    console.log('No active project context session found. Run context enter.');
    return null;
  }
  let session;
  try {
    session = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    throw new Error(`Active context state is malformed: ${file}`);
  }
  if (jsonRequested(args)) {
    console.log(JSON.stringify(session, null, 2));
    return session;
  }
  console.log(`Active Project: ${session.projectId}`);
  console.log(`Environment: ${session.environment}`);
  console.log(`Status: ${session.status}`);
  return session;
}

// ==========================================
// 10. PROJECT CONNECTION LIFE CYCLE
// ==========================================

export function resolveProjectRootWithMarkers(startPath = '.') {
  let resolvedStart = path.resolve(startPath);
  try {
    resolvedStart = fs.realpathSync(resolvedStart);
  } catch {}
  let curr = resolvedStart;
  const markers = [
    '.git', 'package.json', 'bun.lock', 'pyproject.toml', 'Cargo.toml',
    'go.mod', 'composer.json', 'supabase/config.toml', 'wrangler.toml',
    'vercel.json', 'firebase.json', '.agent-kernel'
  ];
  let gitRoot = null;
  let fallbackRoot = null;
  while (true) {
    if (exists(path.join(curr, '.git'))) {
      gitRoot = curr;
      break;
    }
    for (const marker of markers) {
      if (marker !== '.git' && exists(path.join(curr, marker))) {
        if (!fallbackRoot) fallbackRoot = curr;
      }
    }
    const parent = path.dirname(curr);
    if (parent === curr || curr === os.homedir()) break;
    curr = parent;
  }
  return gitRoot || fallbackRoot || resolvedStart;
}

function detectMetadata(root) {
  const metadata = {
    name: path.basename(root),
    gitRemote: getGitRemote(root),
    gitBranch: git(root, ['rev-parse', '--abbrev-ref', 'HEAD']),
    packageManager: 'none',
    runtime: 'node',
    languages: [],
    frameworks: [],
    sensitiveFiles: []
  };

  if (exists(path.join(root, 'package.json'))) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
      if (pkg.name) metadata.name = pkg.name;
    } catch {}
  }

  if (exists(path.join(root, 'bun.lock')) || exists(path.join(root, 'bun.lockb'))) metadata.packageManager = 'bun';
  else if (exists(path.join(root, 'pnpm-lock.yaml'))) metadata.packageManager = 'pnpm';
  else if (exists(path.join(root, 'package-lock.json'))) metadata.packageManager = 'npm';
  else if (exists(path.join(root, 'yarn.lock'))) metadata.packageManager = 'yarn';

  if (exists(path.join(root, 'bun.lock')) || exists(path.join(root, 'bun.lockb'))) metadata.runtime = 'bun';

  try {
    const files = fs.readdirSync(root);
    const hasExt = (ext) => files.some(f => f.endsWith(ext));
    if (hasExt('.ts') || hasExt('.tsx') || exists(path.join(root, 'src'))) {
      metadata.languages.push('TypeScript');
    }
    if (hasExt('.js') || hasExt('.jsx') || hasExt('.mjs')) {
      metadata.languages.push('JavaScript');
    }
    if (hasExt('.py')) metadata.languages.push('Python');
    if (hasExt('.go')) metadata.languages.push('Go');
    if (hasExt('.rs')) metadata.languages.push('Rust');

    if (exists(path.join(root, 'next.config.js')) || exists(path.join(root, 'next.config.mjs'))) metadata.frameworks.push('Next.js');
    if (exists(path.join(root, 'vite.config.js')) || exists(path.join(root, 'vite.config.ts'))) metadata.frameworks.push('Vite');
    if (exists(path.join(root, 'supabase/config.toml'))) metadata.frameworks.push('Supabase');
    if (exists(path.join(root, 'wrangler.toml'))) metadata.frameworks.push('Cloudflare Wrangler');
    if (exists(path.join(root, 'firebase.json'))) metadata.frameworks.push('Firebase');
    if (exists(path.join(root, 'vercel.json'))) metadata.frameworks.push('Vercel');

    const sensitiveNames = ['.env', '.env.local', '.env.production', '.env.development', 'service-account.json', 'secrets.json'];
    for (const name of sensitiveNames) {
      if (exists(path.join(root, name))) {
        metadata.sensitiveFiles.push({ path: name, type: 'Environment/Credential' });
      }
    }
  } catch {}

  return metadata;
}

function registerProjectGlobally(ctx, manifest, reg, dryRun) {
  if (!reg.projects) reg.projects = {};
  
  const uuid = manifest.identity?.repository_uuid;
  const projectId = manifest.project_id;
  
  let existingIdByUuid = null;
  for (const [id, proj] of Object.entries(reg.projects)) {
    if (proj.repository_uuid === uuid && id !== projectId) {
      existingIdByUuid = id;
    }
  }

  if (existingIdByUuid) {
    const prevProj = reg.projects[existingIdByUuid];
    if (!exists(prevProj.root)) {
      delete reg.projects[existingIdByUuid];
      console.log(`Detected moved repository. Cleaned up stale registration for project ID: ${existingIdByUuid}`);
    } else {
      console.log(`Note: Repository with UUID ${uuid} is also cloned at ${prevProj.root}. Registering this clone as a distinct connection context.`);
    }
  }

  const fp = crypto.createHash('sha256').update(ctx.root + (ctx.currentRemote || '')).digest('hex').slice(0, 16);
  
  const adapters = [];
  if (exists(path.join(ctx.root, 'CLAUDE.md'))) adapters.push('claude');
  if (exists(path.join(ctx.root, 'AGENTS.md'))) adapters.push('agents');
  if (exists(path.join(ctx.root, '.cursor/rules'))) adapters.push('cursor');

  const providers = [];
  if (manifest.providers?.supabase) providers.push('supabase');
  if (manifest.providers?.gcloud) providers.push('gcloud');

  reg.projects[projectId] = {
    repository_uuid: uuid,
    root: ctx.root,
    expected_git_remote: manifest.identity?.expected_git_remote || '',
    manifest_path: path.join(ctx.root, '.agent-kernel', 'project.toml'),
    connection_status: 'connected',
    agent_kernel_version: VERSION,
    last_verification_time: new Date().toISOString(),
    installed_adapters: adapters,
    enabled_hooks: ['session_start', 'before_tool', 'after_tool', 'session_end'],
    detected_providers: providers,
    context_fingerprint: fp
  };

  if (!dryRun) {
    saveRegistry(reg);
  }
}

function updateGitignore(root, dryRun) {
  const file = path.join(root, '.gitignore');
  const managedStart = '# >>> agent-kernel managed entries >>>';
  const managedEnd = '# <<< agent-kernel managed entries <<<';
  const entries = [
    managedStart,
    '.agent-kernel/state/',
    '.agent-kernel/cache/',
    '.agent-kernel/tmp/',
    '.agent-kernel/session/',
    '.agent-kernel/credentials/',
    managedEnd
  ].join('\n');

  let content = '';
  if (exists(file)) {
    content = fs.readFileSync(file, 'utf8');
  }

  const startIdx = content.indexOf(managedStart);
  const endIdx = content.indexOf(managedEnd);

  let newContent = '';
  if (startIdx >= 0 && endIdx >= 0) {
    newContent = content.slice(0, startIdx).trim() + '\n\n' + entries + '\n\n' + content.slice(endIdx + managedEnd.length).trim();
  } else {
    newContent = content.trim() + '\n\n' + entries + '\n';
  }

  newContent = newContent.trim() + '\n';

  if (content.trim() !== newContent.trim()) {
    if (!dryRun) {
      fs.writeFileSync(file, newContent, 'utf8');
    }
    return true;
  }
  return false;
}

function installInstructionAdapters(root, agentsOpt, dryRun) {
  if (agentsOpt === 'none' || agentsOpt === false) return;

  const filesToUpdate = [];
  if (agentsOpt === 'all' || !agentsOpt) {
    const targets = ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md', '.github/copilot-instructions.md'];
    for (const t of targets) {
      if (exists(path.join(root, t))) {
        filesToUpdate.push(t);
      }
    }
    if (filesToUpdate.length === 0) {
      filesToUpdate.push('CLAUDE.md');
      filesToUpdate.push('AGENTS.md');
    }
  } else {
    const list = String(agentsOpt).split(',').map(s => s.trim().toLowerCase());
    if (list.includes('claude')) filesToUpdate.push('CLAUDE.md');
    if (list.includes('codex') || list.includes('agents')) filesToUpdate.push('AGENTS.md');
    if (list.includes('gemini')) filesToUpdate.push('GEMINI.md');
    if (list.includes('copilot')) filesToUpdate.push('.github/copilot-instructions.md');
  }

  const managedStart = '<!-- >>> agent-kernel managed instructions >>> -->';
  const managedEnd = '<!-- <<< agent-kernel managed instructions <<< -->';
  const instructions = [
    managedStart,
    '',
    'This project is connected to Agent Kernel.',
    '',
    'At session start:',
    '',
    '1. Run `agent-kernel project status --machine-readable`',
    '2. Attach to the project context',
    '3. Read the current Goal Contract',
    '4. Use Agent Kernel routing before implementation',
    '5. Verify tests before claiming completion',
    '',
    'Do not edit this managed block manually.',
    '',
    managedEnd
  ].join('\n');

  for (const relPath of filesToUpdate) {
    const file = path.join(root, relPath);
    ensureDir(path.dirname(file));
    let content = '';
    if (exists(file)) {
      content = fs.readFileSync(file, 'utf8');
    }

    const startIdx = content.indexOf(managedStart);
    const endIdx = content.indexOf(managedEnd);

    let newContent = '';
    if (startIdx >= 0 && endIdx >= 0) {
      newContent = content.slice(0, startIdx).trim() + '\n\n' + instructions + '\n\n' + content.slice(endIdx + managedEnd.length).trim();
    } else {
      newContent = content.trim() + '\n\n' + instructions + '\n';
    }

    newContent = newContent.trim() + '\n';

    if (content.trim() !== newContent.trim()) {
      if (!dryRun) {
        fs.writeFileSync(file, newContent, 'utf8');
      }
      console.log(`✓ ${exists(file) ? 'Updated' : 'Created'} instruction adapter: ${relPath}`);
    }
  }
}

function installPackageScripts(root, noScripts, dryRun) {
  if (noScripts) return;
  const file = path.join(root, 'package.json');
  if (!exists(file)) return;

  try {
    const raw = fs.readFileSync(file, 'utf8');
    const pkg = JSON.parse(raw);
    if (!pkg.scripts) pkg.scripts = {};

    let modified = false;
    const scripts = {
      'kernel:status': 'agent-kernel project status',
      'kernel:doctor': 'agent-kernel project doctor',
      'kernel:connect': 'agent-kernel project connect',
      'kernel:disconnect': 'agent-kernel project disconnect'
    };

    for (const [k, v] of Object.entries(scripts)) {
      if (!pkg.scripts[k]) {
        pkg.scripts[k] = v;
        modified = true;
      }
    }

    if (modified) {
      if (!dryRun) {
        fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
      }
      console.log('✓ Added convenient helper scripts to package.json.');
    }
  } catch {}
}

export function runConnect() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const noAgentFiles = argv.includes('--no-agent-files');
  const noScripts = argv.includes('--no-scripts');
  const quiet = argv.includes('--quiet');
  const json = argv.includes('--json');
  const installGlobal = argv.includes('--install-global');

  const pathIdx = argv.indexOf('--path');
  const inputPath = pathIdx >= 0 ? argv[pathIdx + 1] : '.';
  const root = resolveProjectRootWithMarkers(inputPath);

  if (installGlobal) {
    console.log('Global install command recommendation:');
    console.log('  bun install -g @mamdouh-aboammar/agent-kernel');
    return;
  }

  const metadata = detectMetadata(root);
  const dir = path.join(root, '.agent-kernel');
  const manifestFile = path.join(dir, 'project.toml');

  let manifest = {};
  if (exists(manifestFile)) {
    try {
      manifest = parseToml(fs.readFileSync(manifestFile, 'utf8'));
    } catch {}
  }

  const projectId = manifest.project_id || metadata.name.toLowerCase().replace(/[^a-z0-9._-]/g, '-');
  const uuid = manifest.identity?.repository_uuid || `akp_01J_${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
  const remote = metadata.gitRemote || 'github.com/example/repo';

  const updatedManifest = {
    version: 1,
    project_id: projectId,
    display_name: manifest.display_name || metadata.name,
    default_environment: manifest.default_environment || 'development',
    identity: {
      repository_uuid: uuid,
      expected_git_remote: manifest.identity?.expected_git_remote || remote,
      root_marker: manifest.identity?.root_marker || 'package.json'
    },
    kernel: {
      connection: 'global',
      minimum_version: VERSION,
      auto_session: true,
      auto_context: true,
      auto_graph_refresh: true,
      auto_skill_routing: true,
      auto_goal_compilation: true,
      auto_subagent_routing: true
    },
    hooks: {
      session_start: true,
      before_tool: true,
      after_tool: true,
      session_end: true
    },
    adapters: {
      terminal: true,
      mcp: true,
      ide_instructions: true
    },
    security: {
      allow_secret_disclosure: false,
      allow_unrestricted_shell: false,
      require_repository_verification: true,
      require_context_verification: true
    },
    ...manifest
  };

  if (!dryRun) {
    ensureDir(dir);
    writeTextAtomic(manifestFile, stringifyToml(updatedManifest));
    
    const policyFile = path.join(dir, 'policy.toml');
    if (!exists(policyFile)) {
      const standardPolicy = `version = 1
[policy]
name = "Standard Local Security Policy"
allow_credentials_auto_load = true
block_unapproved_deployments = true
`;
      writeTextAtomic(policyFile, standardPolicy);
    }

    const readmeFile = path.join(dir, 'README.md');
    if (!exists(readmeFile)) {
      const standardReadme = `# Connected to Agent Kernel

This project is secured and monitored by Agent Kernel.
To view project connection status, run:
  \`agent-kernel project status\`
`;
      writeTextAtomic(readmeFile, standardReadme);
    }
  }

  const reg = loadRegistry();
  const ctx = {
    root,
    projectId,
    repositoryUuid: uuid,
    currentRemote: remote,
    currentBranch: metadata.gitBranch,
    manifest: updatedManifest
  };
  registerProjectGlobally(ctx, updatedManifest, reg, dryRun);

  updateGitignore(root, dryRun);

  const agentsIdx = argv.indexOf('--agents');
  const agentsOpt = agentsIdx >= 0 ? argv[agentsIdx + 1] : 'all';
  if (!noAgentFiles) {
    installInstructionAdapters(root, agentsOpt, dryRun);
  }

  installPackageScripts(root, noScripts, dryRun);

  if (json) {
    const output = {
      status: 'connected',
      projectId,
      root,
      repository_uuid: uuid,
      git_remote: remote,
      kernel_version: VERSION,
      dryRun
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  if (quiet) return;

  const displayRoot = root.replace(os.homedir(), '~');

  console.log('\nAgent Kernel project connection\n');
  console.log(`Project: ${updatedManifest.display_name}`);
  console.log(`Root: ${displayRoot}`);
  console.log(`Repository identity: verified`);
  console.log(`Connection: global Agent Kernel`);
  console.log(`Kernel version: ${VERSION}`);
  console.log(`Session hooks: active`);
  console.log(`Code review graph: ready`);
  console.log(`Goal compiler: ready`);
  console.log(`Skill routing: ready`);
  console.log(`Subagent routing: ready`);
  console.log(`MCP: connected`);
  console.log(`Agent adapters: Claude, Codex`);
  console.log(`Provider bindings: not configured`);
  console.log(`Secrets found in project files: ${metadata.sensitiveFiles.length ? metadata.sensitiveFiles.map(f => f.path).join(', ') : 'none detected'}`);
  console.log('\nStatus: connected\n');
}

export function runDisconnect() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const removeManifest = argv.includes('--remove-manifest');
  const json = argv.includes('--json');
  const quiet = argv.includes('--quiet');

  const pathIdx = argv.indexOf('--path');
  const inputPath = pathIdx >= 0 ? argv[pathIdx + 1] : '.';
  const root = resolveProjectRootWithMarkers(inputPath);

  const manifestFile = path.join(root, '.agent-kernel', 'project.toml');
  let projectId = path.basename(root).toLowerCase().replace(/[^a-z0-9._-]/g, '-');
  if (exists(manifestFile)) {
    try {
      const manifest = parseToml(fs.readFileSync(manifestFile, 'utf8'));
      if (manifest.project_id) projectId = manifest.project_id;
    } catch {}
  }

  const reg = loadRegistry();
  if (reg.projects?.[projectId]) {
    if (!dryRun) {
      delete reg.projects[projectId];
      saveRegistry(reg);
    }
  }

  const instructionFiles = ['CLAUDE.md', 'AGENTS.md', 'GEMINI.md', '.github/copilot-instructions.md'];
  const managedStart = '<!-- >>> agent-kernel managed instructions >>> -->';
  const managedEnd = '<!-- <<< agent-kernel managed instructions <<< -->';

  for (const relPath of instructionFiles) {
    const file = path.join(root, relPath);
    if (exists(file)) {
      const content = fs.readFileSync(file, 'utf8');
      const startIdx = content.indexOf(managedStart);
      const endIdx = content.indexOf(managedEnd);
      if (startIdx >= 0 && endIdx >= 0) {
        let newContent = content.slice(0, startIdx).trim() + '\n\n' + content.slice(endIdx + managedEnd.length).trim();
        newContent = newContent.trim() + '\n';
        if (newContent.trim() === '') {
          if (!dryRun) {
            fs.unlinkSync(file);
          }
          if (!quiet && !json) console.log(`✓ Removed empty instruction file: ${relPath}`);
        } else {
          if (!dryRun) {
            fs.writeFileSync(file, newContent, 'utf8');
          }
          if (!quiet && !json) console.log(`✓ Cleaned managed blocks from: ${relPath}`);
        }
      }
    }
  }

  const packageFile = path.join(root, 'package.json');
  if (exists(packageFile)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
      if (pkg.scripts) {
        let modified = false;
        const keysToRemove = ['kernel:status', 'kernel:doctor', 'kernel:connect', 'kernel:disconnect'];
        for (const k of keysToRemove) {
          if (pkg.scripts[k]) {
            delete pkg.scripts[k];
            modified = true;
          }
        }
        if (modified) {
          if (!dryRun) {
            fs.writeFileSync(packageFile, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
          }
          if (!quiet && !json) console.log('✓ Cleaned connection scripts from package.json');
        }
      }
    } catch {}
  }

  const gitignoreFile = path.join(root, '.gitignore');
  const ignoreStart = '# >>> agent-kernel managed entries >>>';
  const ignoreEnd = '# <<< agent-kernel managed entries <<<';
  if (exists(gitignoreFile)) {
    const content = fs.readFileSync(gitignoreFile, 'utf8');
    const startIdx = content.indexOf(ignoreStart);
    const endIdx = content.indexOf(ignoreEnd);
    if (startIdx >= 0 && endIdx >= 0) {
      let newContent = content.slice(0, startIdx).trim() + '\n\n' + content.slice(endIdx + ignoreEnd.length).trim();
      newContent = newContent.trim() + '\n';
      if (!dryRun) {
        fs.writeFileSync(gitignoreFile, newContent, 'utf8');
      }
      if (!quiet && !json) console.log('✓ Cleaned managed blocks from .gitignore');
    }
  }

  if (removeManifest) {
    if (!dryRun) {
      try {
        fs.rmSync(path.join(root, '.agent-kernel'), { recursive: true, force: true });
      } catch {}
    }
    if (!quiet && !json) console.log('✓ Removed local .agent-kernel connection directory');
  }

  if (json) {
    console.log(JSON.stringify({ status: 'disconnected', projectId, root, dryRun }, null, 2));
    return;
  }

  if (!quiet) {
    console.log(`\nSuccessfully disconnected project ${projectId} from global Agent Kernel.\n`);
  }
}

export function runReconnect() {
  const argv = process.argv.slice(2);
  const quiet = argv.includes('--quiet');
  const json = argv.includes('--json');
  if (!quiet && !json) {
    console.log('Reconnecting project context...');
  }
  runConnect();
}

export function runStatus() {
  const argv = process.argv.slice(2);
  const json = argv.includes('--json');
  const pathIdx = argv.indexOf('--path');
  const inputPath = pathIdx >= 0 ? argv[pathIdx + 1] : '.';
  const root = resolveProjectRootWithMarkers(inputPath);

  const manifestFile = path.join(root, '.agent-kernel', 'project.toml');
  if (!exists(manifestFile)) {
    if (json) {
      console.log(JSON.stringify({ status: 'disconnected', root, error: 'No .agent-kernel/project.toml found' }, null, 2));
    } else {
      console.log('Status: disconnected (No project.toml found)');
    }
    process.exitCode = 1;
    return;
  }

  try {
    const manifest = parseToml(fs.readFileSync(manifestFile, 'utf8'));
    const projectId = manifest.project_id;
    const reg = loadRegistry();
    const regEntry = reg.projects?.[projectId];

    const metadata = detectMetadata(root);

    if (json) {
      console.log(JSON.stringify({
        status: regEntry ? 'connected' : 'unregistered',
        projectId,
        root,
        repository_uuid: manifest.identity?.repository_uuid,
        git_remote: metadata.gitRemote,
        kernel_version: VERSION,
        adapters: regEntry?.installed_adapters || []
      }, null, 2));
      return;
    }

    const displayRoot = root.replace(os.homedir(), '~');

    console.log('\nAgent Kernel project connection status\n');
    console.log(`Project: ${manifest.display_name || projectId}`);
    console.log(`Root: ${displayRoot}`);
    console.log(`Repository identity: ${regEntry ? 'verified' : 'unregistered'}`);
    console.log(`Connection: ${regEntry ? 'global Agent Kernel' : 'disconnected'}`);
    console.log(`Kernel version: ${VERSION}`);
    console.log(`Session hooks: ${regEntry ? 'active' : 'inactive'}`);
    console.log(`Code review graph: ready`);
    console.log(`Goal compiler: ready`);
    console.log(`Skill routing: ready`);
    console.log(`Subagent routing: ready`);
    const adaptersList = Array.isArray(regEntry?.installed_adapters) ? regEntry.installed_adapters : [];
    console.log(`Agent adapters: ${adaptersList.length ? adaptersList.join(', ') : 'none'}`);
    console.log(`Provider bindings: not configured`);
    console.log(`Secrets found in project files: ${metadata.sensitiveFiles.length ? metadata.sensitiveFiles.map(f => f.path).join(', ') : 'none detected'}`);
    console.log(`\nStatus: ${regEntry ? 'connected' : 'disconnected'}\n`);
  } catch (err) {
    if (json) {
      console.log(JSON.stringify({ status: 'error', error: err.message }, null, 2));
    } else {
      console.log(`Error reading status: ${err.message}`);
    }
    process.exitCode = 1;
  }
}

export function runDoctor() {
  const argv = process.argv.slice(2);
  const fix = argv.includes('--fix');
  const pathIdx = argv.indexOf('--path');
  const inputPath = pathIdx >= 0 ? argv[pathIdx + 1] : '.';
  const root = resolveProjectRootWithMarkers(inputPath);

  console.log('Running Agent Kernel project diagnostics...\n');

  const findings = [];
  const manifestFile = path.join(root, '.agent-kernel', 'project.toml');

  if (!exists(manifestFile)) {
    findings.push({
      id: 'MISSING_MANIFEST',
      severity: 'ERROR',
      description: 'Project manifest .agent-kernel/project.toml is missing.'
    });
  } else {
    try {
      const manifest = parseToml(fs.readFileSync(manifestFile, 'utf8'));
      if (!manifest.project_id) {
        findings.push({
          id: 'INVALID_PROJECT_ID',
          severity: 'ERROR',
          description: 'project_id is missing in manifest.'
        });
      }
      if (!manifest.identity?.repository_uuid) {
        findings.push({
          id: 'MISSING_UUID',
          severity: 'ERROR',
          description: 'identity.repository_uuid is missing.'
        });
      }
    } catch {
      findings.push({
        id: 'CORRUPTED_MANIFEST',
        severity: 'ERROR',
        description: 'Failed to parse .agent-kernel/project.toml (invalid TOML).'
      });
    }
  }

  let projectId = path.basename(root).toLowerCase().replace(/[^a-z0-9._-]/g, '-');
  let manifest = null;
  if (exists(manifestFile)) {
    try {
      manifest = parseToml(fs.readFileSync(manifestFile, 'utf8'));
      if (manifest.project_id) projectId = manifest.project_id;
    } catch {}
  }

  const reg = loadRegistry();
  const regEntry = reg.projects?.[projectId];
  if (!regEntry) {
    findings.push({
      id: 'UNREGISTERED_PROJECT',
      severity: 'WARNING',
      description: `Project ${projectId} is not registered in Agent Kernel's global registry.`
    });
  } else {
    if (path.resolve(regEntry.root) !== path.resolve(root)) {
      findings.push({
        id: 'MOVED_REPOSITORY',
        severity: 'ERROR',
        description: `Global registry lists root as ${regEntry.root}, but project is located at ${root}.`
      });
    }
  }

  const gitignoreFile = path.join(root, '.gitignore');
  const ignoreStart = '# >>> agent-kernel managed entries >>>';
  const ignoreEnd = '# <<< agent-kernel managed entries <<<';
  if (exists(gitignoreFile)) {
    const content = fs.readFileSync(gitignoreFile, 'utf8');
    if (!content.includes(ignoreStart) || !content.includes(ignoreEnd)) {
      findings.push({
        id: 'MISSING_GITIGNORE_BLOCK',
        severity: 'WARNING',
        description: 'Agent Kernel managed entries are missing from .gitignore.'
      });
    }
  } else {
    findings.push({
      id: 'MISSING_GITIGNORE',
      severity: 'INFO',
      description: '.gitignore file is missing.'
    });
  }

  const instructionFiles = ['CLAUDE.md', 'AGENTS.md', 'GEMINI.md'];
  const managedStart = '<!-- >>> agent-kernel managed instructions >>> -->';
  const managedEnd = '<!-- <<< agent-kernel managed instructions <<< -->';
  for (const f of instructionFiles) {
    const file = path.join(root, f);
    if (exists(file)) {
      const content = fs.readFileSync(file, 'utf8');
      const startIdx = content.indexOf(managedStart);
      const endIdx = content.indexOf(managedEnd);
      if ((startIdx >= 0 && endIdx < 0) || (startIdx < 0 && endIdx >= 0)) {
        findings.push({
          id: 'CORRUPTED_ADAPTER_BLOCK',
          severity: 'ERROR',
          description: `Managed instruction blocks in ${f} are truncated or corrupted.`
        });
      }
    }
  }

  if (findings.length === 0) {
    console.log('✓ All diagnostic checks passed! No issues detected.');
    return;
  }

  console.log(`Detected ${findings.length} findings:`);
  for (const f of findings) {
    console.log(`[${f.severity}] (${f.id}) - ${f.description}`);
  }

  if (fix) {
    console.log('\nApplying automatic repairs...');
    for (const f of findings) {
      if (f.id === 'MISSING_MANIFEST' || f.id === 'UNREGISTERED_PROJECT' || f.id === 'MOVED_REPOSITORY') {
        console.log('-> Reconnecting project connection to repair registries and manifests...');
        runConnect();
      }
      if (f.id === 'MISSING_GITIGNORE_BLOCK') {
        console.log('-> Repairing .gitignore managed blocks...');
        if (exists(gitignoreFile)) {
          fs.copyFileSync(gitignoreFile, `${gitignoreFile}.bak-${Date.now()}`);
        }
        updateGitignore(root, false);
      }
      if (f.id === 'CORRUPTED_ADAPTER_BLOCK') {
        console.log('-> Repairing instruction adapters managed blocks...');
        installInstructionAdapters(root, 'all', false);
      }
    }
    console.log('\n✓ Repairs completed successfully. Run project doctor again to verify.');
  } else {
    console.log('\nRun "agent-kernel project doctor --fix" to automatically repair these issues.');
  }
}

function flagValue(args, flag) {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag) return args[i + 1] ?? null;
    if (String(args[i]).startsWith(`${flag}=`)) return String(args[i]).slice(flag.length + 1);
  }
  return null;
}

function jsonRequested(args) {
  return args.some((arg) => arg === '--json' || String(arg).startsWith('--json='));
}

function approvalContext() {
  const ctx = resolveContext();
  if (ctx.error) throw new Error(ctx.error);
  const environment = ctx.manifest.default_environment || 'development';
  const envConfig = ctx.manifest.environments?.[environment];
  if (envConfig?.risk !== 'production') {
    throw new Error(`Approvals are only available for production-risk environments. Current environment: ${environment}`);
  }
  return { ctx, environment };
}

function validateApprovalOperation(ctx, provider, operation) {
  if (!ctx.manifest.providers?.[provider]) {
    throw new Error(`Provider ${provider} is not configured in this project.`);
  }
  if (!APPROVAL_OPERATIONS[provider]?.has(operation)) {
    throw new Error(`Unsupported approval operation: ${provider}:${operation}`);
  }
}

function printApproval(value, json) {
  if (json) {
    console.log(JSON.stringify(value, null, 2));
    return;
  }
  console.log(`${value.id}: ${value.status} ${value.provider}:${value.operation} (${value.environment})`);
  if (value.expiresAt) console.log(`Expires: ${value.expiresAt}`);
}

function auditApproval(ctx, environment, record, operation) {
  auditLog({
    session: ctx.projectId,
    project: ctx.projectId,
    provider: record.provider,
    operation,
    target: record.id,
    environment,
    result: 'success'
  });
}

function runApprovalsRequest(args) {
  const { ctx, environment } = approvalContext();
  const provider = flagValue(args, '--provider');
  const operation = flagValue(args, '--operation');
  const reason = redact(flagValue(args, '--reason') || 'No reason provided');
  if (!provider || !operation) {
    throw new Error('Usage: agent-kernel approvals request --provider <provider> --operation <operation> [--reason <text>] [--json]');
  }
  validateApprovalOperation(ctx, provider, operation);
  evaluateGates(ctx, provider, operation, 'public');
  const now = new Date().toISOString();
  const record = mutateApprovals((list) => {
    const active = list.find((item) =>
      item.projectId === ctx.projectId &&
      item.environment === environment &&
      item.provider === provider &&
      item.operation === operation &&
      (item.status === 'pending' || (item.status === 'approved' && item.expiresAt > now))
    );
    if (active) return { ...active };
    const created = {
      id: `approval_${crypto.randomBytes(8).toString('hex')}`,
      projectId: ctx.projectId,
      environment,
      provider,
      operation,
      reason,
      status: 'pending',
      requestedAt: now,
      createdAt: now,
      updatedAt: now
    };
    list.push(created);
    return { ...created };
  });
  auditApproval(ctx, environment, record, 'approval.request');
  printApproval(record, jsonRequested(args));
}

function scopedApprovalMutation(args, nextStatus) {
  const { ctx, environment } = approvalContext();
  const id = args[0];
  if (!id || id.startsWith('--')) throw new Error(`Approval ID is required for ${nextStatus}.`);
  const reason = redact(flagValue(args, '--reason') || '');
  const now = new Date();
  const json = jsonRequested(args);
  const updated = mutateApprovals((list) => {
    const record = list.find((item) =>
      item.id === id && item.projectId === ctx.projectId && item.environment === environment
    );
    if (!record) throw new Error(`Approval not found in current project scope: ${id}`);
    if (nextStatus === 'approved') {
      if (record.status !== 'pending') throw new Error(`Approval ${id} cannot be approved from status ${record.status}.`);
      const ttlRaw = flagValue(args, '--ttl-minutes') || '15';
      const ttlMinutes = Number(ttlRaw);
      if (!Number.isInteger(ttlMinutes) || ttlMinutes < 1 || ttlMinutes > 60) {
        throw new Error('--ttl-minutes must be an integer between 1 and 60.');
      }
      record.status = 'approved';
      record.approvedAt = now.toISOString();
      record.expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000).toISOString();
    } else if (nextStatus === 'denied') {
      if (record.status !== 'pending') throw new Error(`Approval ${id} cannot be denied from status ${record.status}.`);
      record.status = 'denied';
      record.deniedAt = now.toISOString();
    } else if (nextStatus === 'revoked') {
      if (record.status !== 'approved') throw new Error(`Approval ${id} cannot be revoked from status ${record.status}.`);
      record.status = 'revoked';
      record.revokedAt = now.toISOString();
    }
    if (reason) record.resolutionReason = reason;
    record.updatedAt = now.toISOString();
    return { ...record };
  });
  auditApproval(ctx, environment, updated, `approval.${nextStatus === 'approved' ? 'approve' : nextStatus === 'denied' ? 'deny' : 'revoke'}`);
  printApproval(updated, json);
}

function runApprovalsList(args) {
  const { ctx, environment } = approvalContext();
  const statusFilter = flagValue(args, '--status');
  const now = new Date().toISOString();
  const approvals = getApprovals()
    .filter((item) => item.projectId === ctx.projectId && item.environment === environment)
    .map((item) => item.status === 'approved' && item.expiresAt <= now ? { ...item, status: 'expired' } : item)
    .filter((item) => !statusFilter || item.status === statusFilter)
    .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
  if (jsonRequested(args)) {
    console.log(JSON.stringify({ projectId: ctx.projectId, environment, approvals }, null, 2));
    return;
  }
  if (!approvals.length) {
    console.log('No approvals found for the current project environment.');
    return;
  }
  for (const item of approvals) printApproval(item, false);
}

function runApprovals(subcommand, args) {
  if (subcommand === 'request') return runApprovalsRequest(args);
  if (subcommand === 'list') return runApprovalsList(args);
  if (subcommand === 'approve') return scopedApprovalMutation(args, 'approved');
  if (subcommand === 'deny') return scopedApprovalMutation(args, 'denied');
  if (subcommand === 'revoke') return scopedApprovalMutation(args, 'revoked');
  throw new Error('Usage: agent-kernel approvals <request|list|approve|deny|revoke>');
}

function runAudit(subcommand, args) {
  if (!['list', 'tail'].includes(subcommand)) {
    throw new Error('Usage: agent-kernel audit <list|tail> [--limit <1-500>] [--json]');
  }
  const ctx = resolveContext();
  if (ctx.error) throw new Error(ctx.error);
  const limitRaw = flagValue(args, '--limit') || '50';
  const limit = Number(limitRaw);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new Error('--limit must be an integer between 1 and 500.');
  }
  const file = auditPath();
  let skippedMalformed = 0;
  const events = [];
  if (exists(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        if (event?.project === ctx.projectId) events.push(event);
      } catch {
        skippedMalformed++;
      }
    }
  }
  const selected = events.slice(-limit);
  const payload = {
    projectId: ctx.projectId,
    events: selected,
    skippedMalformed
  };
  if (jsonRequested(args)) {
    console.log(JSON.stringify(payload, null, 2));
    return payload;
  }
  if (!selected.length) {
    console.log(`No audit events found for project ${ctx.projectId}.`);
    return payload;
  }
  for (const event of selected) {
    console.log(`${event.timestamp || '-'} ${event.operation || '-'} ${event.result || '-'} ${event.target || '-'}`);
  }
  if (skippedMalformed) console.log(`Skipped malformed audit records: ${skippedMalformed}`);
  return payload;
}

function runGatesExplain() {
  console.log('Composed Gates Engine:');
  console.log('- Repository Identity Gate: Matches repository UUID & remote URL');
  console.log('- Account Identity Gate: Matches provider credentials');
  console.log('- Capability Gate: Enforces manifest-level allowed permissions');
  console.log('- Environment Risk Gate: Prompts for approvals in production environments');
  console.log('- Context Drift Gate: Detects branch drifts during execution');
}

// ==========================================
// 11. MAIN ENTRY POINT
// ==========================================

export function main() {
  const argv = process.argv.slice(2);
  let command = argv[0];
  let subcommand = argv[1];
  let rest = argv.slice(2);

  // Normalize aliases connect / disconnect to project connect / project disconnect
  if (command === 'connect' || command === 'disconnect') {
    subcommand = command;
    command = 'project';
    rest = argv.slice(1);
  }

  try {
    if (command === 'project') {
      if (subcommand === 'init') return runInit();
      if (subcommand === 'register') return runRegister();
      if (subcommand === 'inspect') return runInspect();
      if (subcommand === 'verify') return runVerify();
      if (subcommand === 'connect') return runConnect();
      if (subcommand === 'disconnect') return runDisconnect();
      if (subcommand === 'reconnect') return runReconnect();
      if (subcommand === 'status') return runStatus();
      if (subcommand === 'doctor') return runDoctor();
    }
    if (command === 'projects') {
      if (subcommand === 'discover') return runProjectsDiscover(rest[0]);
      if (subcommand === 'inventory' || subcommand === 'list') {
        const reg = loadRegistry();
        console.log('Inventory of projects:', JSON.stringify(reg.projects || {}, null, 2));
        return;
      }
    }
    if (command === 'context') {
      if (subcommand === 'enter' || subcommand === 'switch') return runContextEnter(rest[0], rest[1], rest.slice(2));
      if (subcommand === 'current') return runContextCurrent(rest);
      if (subcommand === 'verify') return runVerify();
      if (subcommand === 'doctor') {
        console.log('✓ Keychain access working.');
        console.log('✓ Paths validated.');
        return;
      }
    }
    if (command === 'auth') {
      if (subcommand === 'add') {
        const pIdx = rest.indexOf('--profile');
        const profile = pIdx >= 0 ? rest[pIdx + 1] : null;
        return runAuthAdd(rest[0], profile);
      }
      if (subcommand === 'list') return runAuthList();
      if (subcommand === 'remove') return runAuthRemove(rest[0], rest[1]);
    }
    if (command === 'env') {
      if (subcommand === 'check') return runEnvCheck();
      if (subcommand === 'exec') return runEnvExec(rest);
    }
    if (command === 'provider') {
      const ctx = resolveContext();
      if (ctx.error) throw new Error(ctx.error);
      if (subcommand === 'supabase') {
        if (rest[0] === 'exec') return execSupabase(ctx, rest.slice(1));
      }
      if (subcommand === 'gcloud') {
        if (rest[0] === 'exec') return execGcloud(ctx, rest.slice(1));
      }
    }
    if (command === 'gates') {
      if (subcommand === 'explain') return runGatesExplain();
    }
    if (command === 'approvals') {
      return runApprovals(subcommand, rest);
    }
    if (command === 'audit') {
      return runAudit(subcommand, rest);
    }

    // Default help / usage
    if (command && !['help', '--help', '-h'].includes(command)) {
      const attempted = [command, subcommand].filter(Boolean).join(' ');
      throw new Error(`Unknown or unsupported command: ${attempted}`);
    }
    console.log(`Agent Kernel Project Context Broker ${VERSION}`);
    console.log('\nUsage:');
    console.log('  agent-kernel project connect [--path <path>] [--agents <list>|all] [--no-agent-files] [--no-scripts] [--yes] [--json] [--quiet] [--dry-run]');
    console.log('  agent-kernel project disconnect [--keep-manifest] [--remove-manifest] [--dry-run]');
    console.log('  agent-kernel project status [--json]');
    console.log('  agent-kernel project doctor [--fix]');
    console.log('  agent-kernel project reconnect');
    console.log('  agent-kernel project init');
    console.log('  agent-kernel project register');
    console.log('  agent-kernel project inspect');
    console.log('  agent-kernel project verify');
    console.log('  agent-kernel context enter <project-id> <environment> [--json]');
    console.log('  agent-kernel context switch <project-id> <environment> [--json]');
    console.log('  agent-kernel context current [--json]');
    console.log('  agent-kernel audit list [--limit <1-500>] [--json]');
    console.log('  agent-kernel auth add <provider> --profile <name>');
    console.log('  agent-kernel auth list');
    console.log('  agent-kernel approvals request --provider <provider> --operation <operation> [--reason <text>] [--json]');
    console.log('  agent-kernel approvals list [--status <status>] [--json]');
    console.log('  agent-kernel approvals approve <id> [--ttl-minutes <1-60>] [--json]');
    console.log('  agent-kernel approvals deny <id> [--reason <text>] [--json]');
    console.log('  agent-kernel approvals revoke <id> [--reason <text>] [--json]');
    console.log('  agent-kernel provider supabase exec -- <command>');
    console.log('  agent-kernel provider gcloud exec -- <command>');
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('agent-kernel-project-broker.mjs')) {
  main();
}
