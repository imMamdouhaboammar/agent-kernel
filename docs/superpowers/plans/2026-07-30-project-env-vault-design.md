# Project Environment Vault & Auto-Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic local `.env` Vault & Auto-Sync system in Agent Kernel that automatically backs up local `.env` files indexed by unique project fingerprints (Git Remote URL / commit hash), syncs edits automatically via hooks, and restores `.env` automatically when fresh-cloned or pulled.

**Architecture:** A native subsystem `src/env-vault.mjs` backed by `~/.agent-kernel/vault/env-mirrors/<fingerprint>/` storage with `0600` permissions. Integrated with Agent Kernel CLI (`agent-kernel env <link|push|pull|status|list|unlink>`) and hooked into `SessionStart` and `PostToolUse` for zero-friction automatic backup and restore.

**Tech Stack:** Node.js ES Modules, Bun, `crypto` (SHA-256), `child_process` (git remote / commit hash discovery), `fs` (0600 file modes).

## Global Constraints

- Must use Bun for package management and test execution.
- Store vault mirrors in `~/.agent-kernel/vault/env-mirrors/<fingerprint_hash>/` with `0600` permissions.
- Calculate deterministic project fingerprint via Git Remote Origin URL first, fallback to initial git commit hash + project folder name.
- Auto-sync `.env` files when modified by any tool (`PostToolUse`).
- Auto-restore `.env` during `SessionStart` / `agent-kernel env restore` if `.env` is missing in workspace and exists in Vault.

---

### Task 1: Create `src/env-vault.mjs` Core Engine

**Files:**
- Create: `src/env-vault.mjs`
- Test: `test/env-vault.mjs`

**Interfaces:**
- Consumes: `kernelPaths()`, `gitRoot(cwd)`, `readText()`, `writeText()`, `exists()`, `ensureDir()` from `src/cli.mjs` / helpers.
- Produces: 
  - `calculateProjectFingerprint(projectDir)` -> `{ fingerprint: string, gitRemote: string|null, projectName: string }`
  - `vaultLinkProject(projectDir, flags)` -> `{ ok: boolean, fingerprint: string, syncedFiles: string[] }`
  - `vaultSyncProject(projectDir)` -> `{ ok: boolean, syncedFiles: string[], updated: boolean }`
  - `vaultRestoreProject(projectDir)` -> `{ ok: boolean, restoredFiles: string[] }`
  - `vaultGetStatus(projectDir)` -> `{ linked: boolean, fingerprint: string|null, status: string, diffs: Array }`
  - `vaultListProjects()` -> `Array<{ fingerprint: string, projectName: string, gitRemote: string, lastSyncedAt: string, files: string[] }>`
  - `vaultUnlinkProject(projectDir)` -> `{ ok: boolean }`

- [ ] **Step 1: Write failing test in `test/env-vault.mjs`**

```javascript
import { runCli, makeEnv, assertContains, assertNotContains, repo } from './_lib/helpers.mjs';
import { writeFileSync, readFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

export async function run() {
  const { env, homeDir } = makeEnv();
  const testProject = join(homeDir, 'my-secret-app');
  mkdirSync(testProject, { recursive: true });

  // Init git repo
  execFileSync('git', ['init'], { cwd: testProject });
  execFileSync('git', ['config', 'remote.origin.url', 'https://github.com/imMamdouhaboammar/my-secret-app.git'], { cwd: testProject });
  execFileSync('git', ['commit', '--allow-empty', '-m', 'initial commit'], { cwd: testProject });

  // Write .env
  writeFileSync(join(testProject, '.env'), 'DATABASE_URL="postgres://user:pass@localhost:5432/db"\nSECRET_KEY="super-secret"\n');

  // 1. Link project
  const linkOut = runCli(env, 'env', 'link', testProject);
  assertContains(linkOut, 'Linked project to Env Vault');

  // 2. Status
  const statusOut = runCli(env, 'env', 'status', testProject);
  assertContains(statusOut, 'Linked: YES');
  assertContains(statusOut, 'https://github.com/imMamdouhaboammar/my-secret-app.git');

  // 3. Remove local .env
  rmSync(join(testProject, '.env'));

  // 4. Restore
  const restoreOut = runCli(env, 'env', 'pull', testProject);
  assertContains(restoreOut, 'Restored .env');
  const restoredContent = readFileSync(join(testProject, '.env'), 'utf8');
  assertContains(restoredContent, 'super-secret');
}

export const name = 'env-vault';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test/smoke.mjs env-vault`
Expected: FAIL with "Unknown command: env" or module missing.

- [ ] **Step 3: Implement `src/env-vault.mjs`**

```javascript
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import childProcess from 'node:child_process';

export function getVaultHome() {
  const home = os.homedir();
  return path.join(home, '.agent-kernel', 'vault', 'env-mirrors');
}

export function gitRemoteUrl(cwd) {
  try {
    const out = childProcess.execFileSync('git', ['config', '--get', 'remote.origin.url'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.trim() || null;
  } catch {
    return null;
  }
}

export function initialCommitHash(cwd) {
  try {
    const out = childProcess.execFileSync('git', ['rev-list', '--max-parents=0', 'HEAD'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.trim().split(/\s+/)[0] || null;
  } catch {
    return null;
  }
}

export function calculateProjectFingerprint(projectDir) {
  const remote = gitRemoteUrl(projectDir);
  const projectName = path.basename(path.resolve(projectDir));
  let sourceString = '';

  if (remote) {
    sourceString = remote.toLowerCase().replace(/\.git$/, '').trim();
  } else {
    const initHash = initialCommitHash(projectDir);
    if (initHash) {
      sourceString = `commit:${initHash}:${projectName}`;
    } else {
      sourceString = `path:${path.resolve(projectDir)}`;
    }
  }

  const hash = crypto.createHash('sha256').update(sourceString).digest('hex').slice(0, 16);
  return {
    fingerprint: `env_vault_${hash}`,
    gitRemote: remote,
    projectName,
    sourceString
  };
}

export function getProjectVaultDir(projectDir) {
  const { fingerprint } = calculateProjectFingerprint(projectDir);
  return path.join(getVaultHome(), fingerprint);
}

export function readVaultMetadata(vaultDir) {
  const metaPath = path.join(vaultDir, 'metadata.json');
  if (!fs.existsSync(metaPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  } catch {
    return null;
  }
}

export function writeVaultMetadata(vaultDir, meta) {
  fs.mkdirSync(vaultDir, { recursive: true, mode: 0o700 });
  const metaPath = path.join(vaultDir, 'metadata.json');
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), { encoding: 'utf8', mode: 0o600 });
}

export function fileSha256(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export function vaultLinkProject(projectDir) {
  const resolvedPath = path.resolve(projectDir || '.');
  const info = calculateProjectFingerprint(resolvedPath);
  const vaultDir = path.join(getVaultHome(), info.fingerprint);
  fs.mkdirSync(vaultDir, { recursive: true, mode: 0o700 });

  const envCandidates = ['.env', '.env.local', '.env.development', '.env.production', '.env.test'];
  const syncedFiles = [];
  const filesMeta = {};

  for (const name of envCandidates) {
    const localFile = path.join(resolvedPath, name);
    if (fs.existsSync(localFile) && fs.statSync(localFile).isFile()) {
      const content = fs.readFileSync(localFile);
      const sha = crypto.createHash('sha256').update(content).digest('hex');
      const targetInVault = path.join(vaultDir, name);
      fs.writeFileSync(targetInVault, content, { mode: 0o600 });
      syncedFiles.push(name);
      filesMeta[name] = {
        sha256: sha,
        updatedAt: new Date().toISOString(),
        sizeBytes: content.length
      };
    }
  }

  const metadata = {
    fingerprint: info.fingerprint,
    gitRemote: info.gitRemote,
    projectName: info.projectName,
    lastKnownPath: resolvedPath,
    createdAt: new Date().toISOString(),
    lastSyncedAt: new Date().toISOString(),
    files: filesMeta
  };

  writeVaultMetadata(vaultDir, metadata);
  return { ok: true, fingerprint: info.fingerprint, syncedFiles, gitRemote: info.gitRemote, vaultDir };
}

export function vaultSyncProject(projectDir) {
  const resolvedPath = path.resolve(projectDir || '.');
  const info = calculateProjectFingerprint(resolvedPath);
  const vaultDir = path.join(getVaultHome(), info.fingerprint);
  let metadata = readVaultMetadata(vaultDir);

  if (!metadata) {
    return vaultLinkProject(resolvedPath);
  }

  const envCandidates = ['.env', '.env.local', '.env.development', '.env.production', '.env.test'];
  const syncedFiles = [];
  let updated = false;

  for (const name of envCandidates) {
    const localFile = path.join(resolvedPath, name);
    if (fs.existsSync(localFile) && fs.statSync(localFile).isFile()) {
      const content = fs.readFileSync(localFile);
      const sha = crypto.createHash('sha256').update(content).digest('hex');
      const prevSha = metadata.files?.[name]?.sha256;

      if (sha !== prevSha) {
        const targetInVault = path.join(vaultDir, name);
        fs.writeFileSync(targetInVault, content, { mode: 0o600 });
        metadata.files = metadata.files || {};
        metadata.files[name] = {
          sha256: sha,
          updatedAt: new Date().toISOString(),
          sizeBytes: content.length
        };
        updated = true;
      }
      syncedFiles.push(name);
    }
  }

  if (updated) {
    metadata.lastSyncedAt = new Date().toISOString();
    metadata.lastKnownPath = resolvedPath;
    writeVaultMetadata(vaultDir, metadata);
  }

  return { ok: true, syncedFiles, updated };
}

export function vaultRestoreProject(projectDir) {
  const resolvedPath = path.resolve(projectDir || '.');
  const info = calculateProjectFingerprint(resolvedPath);
  const vaultDir = path.join(getVaultHome(), info.fingerprint);
  const metadata = readVaultMetadata(vaultDir);

  if (!metadata || !metadata.files) {
    return { ok: false, reason: 'No vault mirror found for project fingerprint: ' + info.fingerprint };
  }

  const restoredFiles = [];
  for (const [name, fileMeta] of Object.entries(metadata.files)) {
    const vaultFile = path.join(vaultDir, name);
    const localFile = path.join(resolvedPath, name);

    if (fs.existsSync(vaultFile)) {
      const content = fs.readFileSync(vaultFile);
      fs.writeFileSync(localFile, content, { mode: 0o600 });
      restoredFiles.push(name);
    }
  }

  return { ok: true, restoredFiles, fingerprint: info.fingerprint, gitRemote: metadata.gitRemote };
}

export function vaultGetStatus(projectDir) {
  const resolvedPath = path.resolve(projectDir || '.');
  const info = calculateProjectFingerprint(resolvedPath);
  const vaultDir = path.join(getVaultHome(), info.fingerprint);
  const metadata = readVaultMetadata(vaultDir);

  if (!metadata) {
    return { linked: false, fingerprint: info.fingerprint, gitRemote: info.gitRemote, projectName: info.projectName };
  }

  const diffs = [];
  const envCandidates = ['.env', '.env.local', '.env.development', '.env.production', '.env.test'];

  for (const name of envCandidates) {
    const localFile = path.join(resolvedPath, name);
    const vaultFile = path.join(vaultDir, name);
    const hasLocal = fs.existsSync(localFile);
    const hasVault = fs.existsSync(vaultFile);

    if (hasLocal && hasVault) {
      const localSha = fileSha256(localFile);
      const vaultSha = fileSha256(vaultFile);
      diffs.push({ file: name, status: localSha === vaultSha ? 'IN_SYNC' : 'MODIFIED_LOCAL' });
    } else if (hasLocal && !hasVault) {
      diffs.push({ file: name, status: 'UNSAVED_LOCAL' });
    } else if (!hasLocal && hasVault) {
      diffs.push({ file: name, status: 'MISSING_LOCAL' });
    }
  }

  return {
    linked: true,
    fingerprint: info.fingerprint,
    gitRemote: metadata.gitRemote || info.gitRemote,
    projectName: metadata.projectName || info.projectName,
    lastKnownPath: metadata.lastKnownPath,
    lastSyncedAt: metadata.lastSyncedAt,
    diffs
  };
}

export function vaultListProjects() {
  const vaultHome = getVaultHome();
  if (!fs.existsSync(vaultHome)) return [];
  const entries = fs.readdirSync(vaultHome, { withFileTypes: true });
  const projects = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const vaultDir = path.join(vaultHome, entry.name);
      const meta = readVaultMetadata(vaultDir);
      if (meta) {
        projects.push({
          fingerprint: meta.fingerprint,
          projectName: meta.projectName,
          gitRemote: meta.gitRemote,
          lastKnownPath: meta.lastKnownPath,
          lastSyncedAt: meta.lastSyncedAt,
          files: Object.keys(meta.files || {})
        });
      }
    }
  }

  return projects;
}

export function vaultUnlinkProject(projectDir) {
  const resolvedPath = path.resolve(projectDir || '.');
  const info = calculateProjectFingerprint(resolvedPath);
  const vaultDir = path.join(getVaultHome(), info.fingerprint);

  if (fs.existsSync(vaultDir)) {
    fs.rmSync(vaultDir, { recursive: true, force: true });
    return { ok: true, fingerprint: info.fingerprint };
  }

  return { ok: false, reason: 'Project is not linked in Vault.' };
}
```

- [ ] **Step 4: Connect `env` subcommand to `src/cli.mjs`**

Add `commandEnv(flags)` to `src/cli.mjs`:

```javascript
import {
  vaultLinkProject,
  vaultSyncProject,
  vaultRestoreProject,
  vaultGetStatus,
  vaultListProjects,
  vaultUnlinkProject
} from './env-vault.mjs';

function commandEnv(flags = {}) {
  const sub = flags._ ? flags._[0] : 'status';
  const targetDir = flags._ ? flags._[1] || '.' : '.';

  if (sub === 'link') {
    const res = vaultLinkProject(targetDir);
    print(`Linked project to Env Vault.`);
    print(`- Fingerprint: ${res.fingerprint}`);
    print(`- Git Remote: ${res.gitRemote || 'N/A'}`);
    print(`- Synced files: ${res.syncedFiles.join(', ') || 'None'}`);
    return;
  }

  if (sub === 'push' || sub === 'sync') {
    const res = vaultSyncProject(targetDir);
    print(`Env Vault synchronized.`);
    print(`- Synced files: ${res.syncedFiles.join(', ') || 'None'}`);
    print(`- Changes updated: ${res.updated ? 'YES' : 'NO (Up to date)'}`);
    return;
  }

  if (sub === 'pull' || sub === 'restore') {
    const res = vaultRestoreProject(targetDir);
    if (!res.ok) {
      error(res.reason);
      process.exitCode = 1;
      return;
    }
    print(`Restored .env from Env Vault.`);
    print(`- Fingerprint: ${res.fingerprint}`);
    print(`- Restored files: ${res.restoredFiles.join(', ')}`);
    return;
  }

  if (sub === 'status') {
    const status = vaultGetStatus(targetDir);
    print(`Env Vault Status:`);
    print(`- Linked: ${status.linked ? 'YES' : 'NO'}`);
    print(`- Fingerprint: ${status.fingerprint}`);
    print(`- Git Remote: ${status.gitRemote || 'N/A'}`);
    if (status.linked) {
      print(`- Last Synced: ${status.lastSyncedAt}`);
      print(`- Files:`);
      status.diffs.forEach(d => print(`    [${d.status}] ${d.file}`));
    }
    return;
  }

  if (sub === 'list') {
    const projects = vaultListProjects();
    print(`Env Vault Backed Projects (${projects.length}):`);
    projects.forEach(p => {
      print(`- ${p.projectName} [${p.fingerprint}]`);
      print(`    Remote: ${p.gitRemote || 'N/A'}`);
      print(`    Path: ${p.lastKnownPath}`);
      print(`    Files: ${p.files.join(', ')}`);
    });
    return;
  }

  if (sub === 'unlink') {
    const res = vaultUnlinkProject(targetDir);
    if (!res.ok) {
      error(res.reason);
      process.exitCode = 1;
      return;
    }
    print(`Unlinked project from Env Vault (${res.fingerprint}).`);
    return;
  }

  error('Unknown env subcommand. Usage: agent-kernel env <link|push|pull|status|list|unlink>');
  process.exitCode = 1;
}
```

Add `'env'` to `subcommandFamilies` and router in `main()`.

- [ ] **Step 5: Run tests and verify they pass**

Run: `bun run build && bun test/smoke.mjs env-vault`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/env-vault.mjs src/cli.mjs test/env-vault.mjs test/smoke.mjs
git commit -m "feat(env-vault): implement project environment vault core engine and CLI commands"
```

---

### Task 2: Integrate Auto-Restore (`SessionStart`) and Auto-Sync (`PostToolUse`) Hooks

**Files:**
- Modify: `src/cli.mjs`
- Test: `test/env-vault.mjs`

**Interfaces:**
- Consumes: `vaultRestoreProject(cwd)`, `vaultSyncProject(cwd)`, `vaultGetStatus(cwd)`
- Produces: Seamless auto-restoration when `.env` is missing on session start, and automatic mirror update after tool writes `.env`.

- [ ] **Step 1: Write failing hook test in `test/env-vault.mjs`**

```javascript
  // Test auto-restore on SessionStart
  rmSync(join(testProject, '.env'));
  const sessionInput = JSON.stringify({ cwd: testProject, hook_event: 'SessionStart' });
  const sessionStartOut = execFileSync(process.execPath, [join(repo.root, 'dist', 'cli.mjs'), 'hook', 'session-start'], {
    cwd: repo.root,
    env,
    input: sessionInput,
    encoding: 'utf8'
  });
  assertContains(sessionStartOut, 'Restored .env from Env Vault');
  assert(existsSync(join(testProject, '.env')), 'Auto-restore failed on SessionStart');

  // Test auto-sync on PostToolUse
  writeFileSync(join(testProject, '.env'), 'DATABASE_URL="postgres://newuser:newpass@localhost:5432/db"\n');
  const postInput = JSON.stringify({ cwd: testProject, tool_name: 'Write', tool_input: { path: '.env' } });
  execFileSync(process.execPath, [join(repo.root, 'dist', 'cli.mjs'), 'hook', 'post-tool-use'], {
    cwd: repo.root,
    env,
    input: postInput,
    encoding: 'utf8'
  });

  const statusAfterEdit = runCli(env, 'env', 'status', testProject);
  assertContains(statusAfterEdit, 'IN_SYNC');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test/smoke.mjs env-vault`
Expected: FAIL on `Auto-restore failed on SessionStart`.

- [ ] **Step 3: Update `commandHook` in `src/cli.mjs`**

In `SessionStart` handler:
```javascript
  if (kind === 'session-start') {
    const p = kernelPaths();
    commandCompile({ quiet: true });
    let additionalContext = readText(path.join(p.dist, 'AGENTS.md')).slice(0, 12000);

    // Auto-restore .env if missing and present in Vault
    const status = vaultGetStatus(cwd);
    if (status.linked) {
      const missingFiles = status.diffs.filter(d => d.status === 'MISSING_LOCAL');
      if (missingFiles.length > 0) {
        const restoreRes = vaultRestoreProject(cwd);
        if (restoreRes.ok) {
          additionalContext += `\n\n[Agent Kernel Env Vault] Automatically restored missing environment files from vault: ${restoreRes.restoredFiles.join(', ')} (Fingerprint: ${restoreRes.fingerprint}).`;
        }
      } else {
        // Background sync
        vaultSyncProject(cwd);
      }
    }

    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext } }));
    return;
  }
```

In `PostToolUse` handler:
```javascript
  if (kind === 'post-tool-use') {
    const toolInput = input.tool_input || input.toolInput || {};
    const filePath = toolInput.file_path || toolInput.path || toolInput.filename;
    
    // Auto-sync env files if modified
    if (filePath && (filePath.endsWith('.env') || filePath.includes('.env.'))) {
      vaultSyncProject(cwd);
    }
    process.stdout.write(JSON.stringify({}));
    return;
  }
```

- [ ] **Step 4: Run tests and verify pass**

Run: `bun run build && bun test/smoke.mjs env-vault`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/cli.mjs test/env-vault.mjs
git commit -m "feat(env-vault): integrate auto-restore on SessionStart and auto-sync on PostToolUse"
```

---

### Task 3: Full Smoke Suite Integration & Documentation Update

**Files:**
- Modify: `test/smoke.mjs`
- Modify: `README.md`

- [ ] **Step 1: Wire `runEnvVault` into `test/smoke.mjs`**

```javascript
import { run as runEnvVault } from './env-vault.mjs';

// Add to tests array:
  ['env-vault', runEnvVault]
```

- [ ] **Step 2: Update README.md with `agent-kernel env` documentation**

Add section:
```markdown
### Environment Vault (`agent-kernel env`)

Agent Kernel automatically mirrors and protects your local `.env` files across directory deletions and fresh clones using deterministic project fingerprinting (Git Remote / commit hash).

Commands:
- `agent-kernel env link [project]` - Link project `.env` files to Vault.
- `agent-kernel env status [project]` - Check sync status and fingerprint.
- `agent-kernel env push [project]` - Force push local `.env` changes to Vault.
- `agent-kernel env pull [project]` - Force restore `.env` files from Vault.
- `agent-kernel env list` - List all backed-up project environments.
- `agent-kernel env unlink [project]` - Remove project mirror from Vault.
```

- [ ] **Step 3: Run full smoke suite**

Run: `bun run build && bun test/smoke.mjs`
Expected: 100% tests PASS (48/48 passed).

- [ ] **Step 4: Push to GitHub & Link Global CLI**

```bash
git add .
git commit -m "docs(env-vault): document agent-kernel env commands and complete smoke test suite"
git push origin master
bun link
```
