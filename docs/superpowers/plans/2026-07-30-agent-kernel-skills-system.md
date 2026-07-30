# Universal Agent Kernel Skills System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a universal Skill Module System in Agent Kernel (`skills/agent-kernel-ops` & `agent-kernel skills <list|inspect|sync|install>`) that empowers any AI agent (Claude, Antigravity, Cursor, Codex, Gemini, OpenCode) to discover, operate, and sync Agent Kernel capabilities seamlessly.

**Architecture:** 
1. Create `skills/agent-kernel-ops/SKILL.md` in repository and sync to `~/.agent-kernel/skills/agent-kernel-ops/SKILL.md`.
2. Implement `src/skills-engine.mjs` for discovery, inspection, and multi-agent skill syncing across `~/.claude/skills`, `~/.codex/skills`, `~/.gemini/config/skills`, `~/.agents/skills`.
3. Add `commandSkills` in `src/cli.mjs` (`agent-kernel skills list`, `agent-kernel skills inspect <id>`, `agent-kernel skills sync`, `agent-kernel skills install`).

**Tech Stack:** Node.js ES Modules, Bun, Markdown SKILL.md specs, JSON metadata schemas.

## Global Constraints

- Must use Bun for package management and test execution.
- Skill modules must conform to universal `SKILL.md` frontmatter format (YAML name & description + triggers + detailed markdown workflow).
- Multi-agent sync must install skills cleanly into Claude, Codex, Gemini, Antigravity, Cursor, and OpenCode skill directories without overwriting user customizations.

---

### Task 1: Create `skills/agent-kernel-ops/SKILL.md` Universal Skill Module

**Files:**
- Create: `skills/agent-kernel-ops/SKILL.md`
- Create: `src/skills-engine.mjs`
- Test: `test/skills-engine.mjs`

**Interfaces:**
- Consumes: `kernelPaths()`, `readText()`, `writeText()`, `ensureDir()`
- Produces: 
  - `listRegisteredSkills()` -> `Array<{ id: string, name: string, description: string, triggers: string[], path: string }>`
  - `inspectSkill(skillId)` -> `{ id: string, skillMd: string, metadata: object }`
  - `syncSkillsToAgents()` -> `{ ok: boolean, installedPaths: string[] }`

- [ ] **Step 1: Create `skills/agent-kernel-ops/SKILL.md`**

```markdown
---
name: agent-kernel-ops
description: Universal Agent Kernel operational guide for AI agents. Enables any agent (Claude, Antigravity, Cursor, Codex, Gemini, OpenCode) to seamlessly operate Agent Kernel environment vault, memory, policies, and health diagnostics.
---

# Agent Kernel Universal Operations Guide

This skill provides step-by-step instructions for AI agents to interact with Agent Kernel CLI and runtime seamlessly.

## Triggers & Trigger Phrases
Activate this skill when:
- The user mentions `agent-kernel`, `agy`, `.env`, `env-vault`, `memory proposal`, `agent rule`, or `policy`.
- You need to manage environment keys, check project status, or run policy/guard checks.

## 1. Environment Vault Management (`agent-kernel env`)
- **Link Project `.env` to Vault:**
  `agent-kernel env link [projectPath]`
- **Check Sync Status & Fingerprint:**
  `agent-kernel env status [projectPath]`
- **Auto-Sync / Force Push Edits:**
  `agent-kernel env push [projectPath]`
- **Restore Missing `.env` Keys:**
  `agent-kernel env pull [projectPath]`
- **List All Backed-Up Projects:**
  `agent-kernel env list`

## 2. Memory & Rule Proposals (`agent-kernel propose / approve`)
- **Propose a New Rule:**
  `agent-kernel propose --from <agentName> --text "Your rule text" --reason "Why"`
- **Inspect Inbox:**
  `agent-kernel inbox`
- **Approve Proposal:**
  `agent-kernel approve <proposalId> --publish`

## 3. Governance & Quality Guards (`agent-kernel guard / policy`)
- **Run File & Policy Guard:**
  `agent-kernel guard [--staged|--file path]`
- **Verify Policy Compliance:**
  `agent-kernel policy check mandatory-bun-package-manager`

## 4. Health & Context Diagnostics (`agent-kernel doctor / status`)
- **Check Kernel Status:**
  `agent-kernel status`
- **Run Health Doctor:**
  `agent-kernel doctor`
```

- [ ] **Step 2: Create `src/skills-engine.mjs`**

```javascript
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export function getAgentSkillDirectories() {
  const home = os.homedir();
  return [
    path.join(home, '.agent-kernel', 'skills'),
    path.join(home, '.claude', 'skills'),
    path.join(home, '.codex', 'skills'),
    path.join(home, '.gemini', 'config', 'skills'),
    path.join(home, '.agents', 'skills')
  ];
}

export function listRegisteredSkills(repoRoot) {
  const kernelSkillsDir = path.join(repoRoot || process.cwd(), 'skills');
  const userSkillsDir = path.join(os.homedir(), '.agent-kernel', 'skills');
  const skillsMap = new Map();

  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillMd = path.join(dir, entry.name, 'SKILL.md');
        if (fs.existsSync(skillMd)) {
          const content = fs.readFileSync(skillMd, 'utf8');
          const nameMatch = content.match(/^name:\s*(.+)$/m);
          const descMatch = content.match(/^description:\s*(.+)$/m);
          skillsMap.set(entry.name, {
            id: entry.name,
            name: nameMatch ? nameMatch[1].trim() : entry.name,
            description: descMatch ? descMatch[1].trim() : 'Agent Kernel Skill Module',
            path: skillMd
          });
        }
      }
    }
  }

  scanDir(kernelSkillsDir);
  scanDir(userSkillsDir);

  return Array.from(skillsMap.values());
}

export function syncSkillsToAllAgents(repoRoot) {
  const skills = listRegisteredSkills(repoRoot);
  const targetDirs = getAgentSkillDirectories();
  const installedPaths = [];

  for (const skill of skills) {
    const skillName = skill.id;
    const skillSrcDir = path.dirname(skill.path);

    for (const targetBaseDir of targetDirs) {
      const destSkillDir = path.join(targetBaseDir, skillName);
      fs.mkdirSync(destSkillDir, { recursive: true });
      fs.cpSync(skillSrcDir, destSkillDir, { recursive: true });
      installedPaths.push(destSkillDir);
    }
  }

  return { ok: true, skillCount: skills.length, installedPaths };
}
```

- [ ] **Step 3: Create test `test/skills-engine.mjs`**

```javascript
import { runCli, makeEnv, assertContains, repo } from './_lib/helpers.mjs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export async function run() {
  const { env, homeDir } = makeEnv();

  // 1. List skills
  const listOut = runCli(env, 'skills', 'list');
  assertContains(listOut, 'agent-kernel-ops');

  // 2. Inspect skill
  const inspectOut = runCli(env, 'skills', 'inspect', 'agent-kernel-ops');
  assertContains(inspectOut, 'Agent Kernel Universal Operations Guide');

  // 3. Sync skills to agent directories
  const syncOut = runCli(env, 'skills', 'sync');
  assertContains(syncOut, 'Successfully synchronized');
}

export const name = 'skills-engine';
```

- [ ] **Step 4: Connect `commandSkills` in `src/cli.mjs`**

```javascript
import { listRegisteredSkills, syncSkillsToAllAgents } from './skills-engine.mjs';

function commandSkills(flags = {}) {
  const sub = flags._ ? flags._[0] : 'list';
  const repoRoot = gitRoot(process.cwd());

  if (sub === 'list') {
    const skills = listRegisteredSkills(repoRoot);
    print(`Registered Agent Kernel Skill Modules (${skills.length}):`);
    skills.forEach(s => {
      print(`- [${s.id}] ${s.name}`);
      print(`    Description: ${s.description}`);
      print(`    Path: ${s.path}`);
    });
    return;
  }

  if (sub === 'inspect') {
    const id = flags._ ? flags._[1] : null;
    if (!id) {
      error('Usage: agent-kernel skills inspect <skill-id>');
      process.exitCode = 1;
      return;
    }
    const skills = listRegisteredSkills(repoRoot);
    const hit = skills.find(s => s.id === id);
    if (!hit) {
      error(`Skill not found: ${id}`);
      process.exitCode = 1;
      return;
    }
    const content = readText(hit.path);
    print(`# Skill Inspect: ${hit.name} (${hit.id})`);
    print(`Path: ${hit.path}\n`);
    print('--- SKILL.md Content ---');
    print(content);
    return;
  }

  if (sub === 'sync' || sub === 'install') {
    const res = syncSkillsToAllAgents(repoRoot);
    print(`Successfully synchronized ${res.skillCount} Agent Kernel Skill Modules across all AI Agent environments.`);
    print(`- Installed targets count: ${res.installedPaths.length}`);
    return;
  }

  error('Unknown skills subcommand. Usage: agent-kernel skills <list|inspect|sync|install>');
  process.exitCode = 1;
}
```

Add `'skills'` to `subcommandFamilies` and router in `main()`.

- [ ] **Step 5: Run tests and verify**

Run: `bun run build && bun test/smoke.mjs skills-engine`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add skills/agent-kernel-ops/SKILL.md src/skills-engine.mjs src/cli.mjs test/skills-engine.mjs test/smoke.mjs
git commit -m "feat(skills): add agent-kernel-ops universal skill module and multi-agent skills sync engine"
```
