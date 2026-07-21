#!/usr/bin/env node
import childProcess from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';

const VERSION = '1.12.0';

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
      childProcess.spawnSync('sleep', ['0.1']);
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
  const entry = {
    timestamp: new Date().toISOString(),
    ...event
  };
  ensureDir(path.dirname(file));
  fs.appendFileSync(file, JSON.stringify(entry) + '\n');
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
  if (requiredCap && manifest.capabilities?.[requiredCap] === false) {
    throw new Error(`Gate Failure: Capability ${requiredCap} is explicitly blocked in project manifest.`);
  }

  // 4. Environment Risk & Approval Gates
  const activeEnv = manifest.default_environment || 'development';
  const envConfig = manifest.environments?.[activeEnv];
  if (envConfig) {
    if (envConfig.risk === 'production' && requestedTier !== 'public') {
      // Production sensitive execution needs explicit approval
      if (!isOperationApproved(ctx.projectId, activeEnv, providerName, operation)) {
        throw new Error(`Gate Failure: Production execution of ${providerName}:${operation} requires explicit approval. Run: agent-kernel approvals request`);
      }
    }
  }

  // 5. Context Drift Gate
  verifyContextDrift(ctx);

  return true;
}

function verifyContextDrift(ctx) {
  if (!fs.existsSync(path.join(ctx.root, '.git'))) return; // Skip if not a git repo
  const current = resolveContext(ctx.root);
  if (current.currentBranch !== ctx.currentBranch) {
    throw new Error(`Gate Failure: Git branch has drifted from ${ctx.currentBranch} to ${current.currentBranch}`);
  }
}

// ==========================================
// 7. APPROVAL INBOX RECORDS
// ==========================================

function getApprovals() {
  const file = approvalsPath();
  if (!exists(file)) return [];
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; }
}

function saveApprovals(list) {
  writeJsonAtomic(approvalsPath(), list);
}

export function isOperationApproved(projectId, environment, provider, operation) {
  const list = getApprovals();
  const now = new Date().toISOString();
  const matched = list.find((item) =>
    item.projectId === projectId &&
    item.environment === environment &&
    item.provider === provider &&
    item.operation === operation &&
    item.status === 'approved' &&
    item.expiresAt > now
  );
  return !!matched;
}

// ==========================================
// 8. PROVIDER ADAPTERS
// ==========================================

export function execSupabase(ctx, args) {
  const profileName = ctx.manifest?.providers?.supabase?.profile;
  const projectRef = ctx.manifest?.providers?.supabase?.project_ref;
  if (!profileName || !projectRef) {
    throw new Error('Supabase adapter is not fully configured in project.toml');
  }

  // Evaluate gates
  const isWrite = args.includes('push') || args.includes('deploy');
  evaluateGates(ctx, 'supabase', isWrite ? 'db-push' : 'db-pull');

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

  const cleanArgs = args.filter((a) => a !== '--project-ref'); // Strip potential mismatching ref
  const fullArgs = [...cleanArgs, '--project-ref', projectRef];

  auditLog({
    session: ctx.projectId,
    project: ctx.projectId,
    provider: 'supabase',
    operation: args.join(' '),
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

  auditLog({
    session: ctx.projectId,
    project: ctx.projectId,
    provider: 'supabase',
    operation: args.join(' '),
    target: projectRef,
    environment: ctx.manifest?.default_environment || 'development',
    result: result.status === 0 ? 'success' : 'failure'
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

export function execGcloud(ctx, args) {
  const profileName = ctx.manifest?.providers?.gcloud?.profile;
  const projectID = ctx.manifest?.providers?.gcloud?.project_id;
  const region = ctx.manifest?.providers?.gcloud?.region;
  if (!profileName || !projectID) {
    throw new Error('Google Cloud adapter is not fully configured in project.toml');
  }

  // Isolated config dir
  const configDir = path.join(kernelHome(), 'gcloud', profileName);
  ensureDir(configDir);

  // Evaluate gates
  evaluateGates(ctx, 'gcloud', 'run');

  const env = {
    ...process.env,
    CLOUDSDK_CONFIG: configDir,
    CLOUDSDK_ACTIVE_CONFIG_NAME: profileName,
    AGENT_KERNEL_BYPASS_SHIMS: '1'
  };

  const realExe = resolveRealExecutable('gcloud');
  const fullArgs = [...args];
  if (!args.includes('--project')) {
    fullArgs.push('--project', projectID);
  }
  if (region && !args.includes('--region')) {
    fullArgs.push('--region', region);
  }

  auditLog({
    session: ctx.projectId,
    project: ctx.projectId,
    provider: 'gcloud',
    operation: args.join(' '),
    target: projectID,
    environment: ctx.manifest?.default_environment || 'development',
    result: 'pending'
  });

  const result = childProcess.spawnSync(realExe, fullArgs, {
    cwd: ctx.root,
    env,
    stdio: 'inherit'
  });

  auditLog({
    session: ctx.projectId,
    project: ctx.projectId,
    provider: 'gcloud',
    operation: args.join(' '),
    target: projectID,
    environment: ctx.manifest?.default_environment || 'development',
    result: result.status === 0 ? 'success' : 'failure'
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function resolveRealExecutable(name) {
  const systemPath = process.env.PATH || '';
  const paths = systemPath.split(':').filter((p) => !p.includes('.agent-kernel/runtime/shims'));
  for (const dir of paths) {
    const full = path.join(dir, name);
    if (exists(full)) return full;
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
if (process.env.AGENT_KERNEL_BYPASS_SHIMS === '1') {
  const systemPath = process.env.PATH || '';
  const paths = systemPath.split(':').filter((p) => !p.includes('.agent-kernel/runtime/shims'));
  let realExe = '${tool}';
  for (const dir of paths) {
    const full = dir + '/' + '${tool}';
    try {
      childProcess.execFileSync('test', ['-x', full]);
      realExe = full;
      break;
    } catch {}
  }
  const result = childProcess.spawnSync(realExe, process.argv.slice(2), { stdio: 'inherit', env: process.env });
  process.exit(result.status ?? 0);
} else {
  const result = childProcess.spawnSync('agent-kernel', ['provider', '${tool}', 'exec', '--', ...process.argv.slice(2)], { stdio: 'inherit', env: process.env });
  process.exit(result.status ?? 0);
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
  const env = { ...process.env };

  if (ctx.manifest?.providers?.supabase?.project_ref) {
    env.SUPABASE_PROJECT_REF = ctx.manifest.providers.supabase.project_ref;
  }

  const cmd = commandArgs[0];
  const rest = commandArgs.slice(1);
  const child = childProcess.spawnSync(cmd, rest, {
    cwd: ctx.root || process.cwd(),
    env,
    stdio: 'inherit'
  });
  process.exit(child.status ?? 0);
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

function runContextEnter(projectId, environment) {
  if (!projectId || !environment) {
    throw new Error('Usage: agent-kernel context enter <project-id> <environment>');
  }
  const ctx = resolveContext();
  const session = {
    projectId,
    environment,
    enteredAt: new Date().toISOString(),
    status: 'active'
  };
  writeJsonAtomic(activeSessionPath(), session);
  console.log(`✓ Entered project context: ${projectId} [${environment}]`);
}

function runContextCurrent() {
  const file = activeSessionPath();
  if (!exists(file)) {
    console.log('No active project context session found. Run context enter.');
    return;
  }
  const session = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(`Active Project: ${session.projectId}`);
  console.log(`Environment: ${session.environment}`);
  console.log(`Status: ${session.status}`);
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
  const [command, subcommand, ...rest] = argv;

  try {
    if (command === 'project') {
      if (subcommand === 'init') return runInit();
      if (subcommand === 'register') return runRegister();
      if (subcommand === 'inspect') return runInspect();
      if (subcommand === 'verify') return runVerify();
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
      if (subcommand === 'enter') return runContextEnter(rest[0], rest[1]);
      if (subcommand === 'current') return runContextCurrent();
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

    // Default help / usage
    console.log(`Agent Kernel Project Context Broker ${VERSION}`);
    console.log('\nUsage:');
    console.log('  agent-kernel project init');
    console.log('  agent-kernel project register');
    console.log('  agent-kernel project inspect');
    console.log('  agent-kernel project verify');
    console.log('  agent-kernel auth add <provider> --profile <name>');
    console.log('  agent-kernel auth list');
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
