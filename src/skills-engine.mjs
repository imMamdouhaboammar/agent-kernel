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
      if (path.resolve(skillSrcDir) === path.resolve(destSkillDir)) {
        installedPaths.push(destSkillDir);
        continue;
      }
      fs.mkdirSync(destSkillDir, { recursive: true });
      fs.cpSync(skillSrcDir, destSkillDir, { recursive: true });
      installedPaths.push(destSkillDir);
    }
  }

  return { ok: true, skillCount: skills.length, installedPaths };
}
