#!/usr/bin/env node
import {
  TRUST_LEVELS,
  getAgentIdentity,
  loadAgentRegistry,
  normalizeAgentId,
  removeAgentIdentity,
  upsertAgentIdentity
} from './agent-kernel-agent-model.mjs';
import {
  findProject,
  identifyProject,
  loadProjectRegistry,
  setProjectId
} from './agent-kernel-project-model.mjs';

const VERSION = '1.20.1';

function parseFlags(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const raw = arg.slice(2);
      const eq = raw.indexOf('=');
      if (eq >= 0) flags[raw.slice(0, eq)] = raw.slice(eq + 1);
      else if (argv[i + 1] && !argv[i + 1].startsWith('-')) flags[raw] = argv[++i];
      else flags[raw] = true;
    } else flags._.push(arg);
  }
  return flags;
}

function aliases(value) {
  return String(value || '').split(',').map((item) => normalizeAgentId(item)).filter(Boolean);
}

function printJson(value) {
  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}

function printAgent(item) {
  process.stdout.write(`${item.agentId}\t${item.trustLevel}\t${item.surface}\t${item.displayName}\n`);
}

function validateTrust(value) {
  const trust = String(value || 'read-only');
  if (!TRUST_LEVELS.includes(trust)) throw new Error(`Invalid trust level: ${trust}. Allowed: ${TRUST_LEVELS.join(', ')}`);
  return trust;
}

function commandAgent(action, flags) {
  if (action === 'list') {
    const agents = loadAgentRegistry().agents.slice().sort((a, b) => a.agentId.localeCompare(b.agentId));
    if (flags.json) printJson({ agents });
    else agents.forEach(printAgent);
    return;
  }

  const id = String(flags._[0] || flags.id || '').trim();
  if (!id) throw new Error(`Usage: agent-kernel agent ${action} <agent-id>`);

  if (action === 'show') {
    const agent = getAgentIdentity(id);
    if (!agent) throw new Error(`Agent not found: ${id}`);
    if (flags.json) printJson(agent);
    else printAgent(agent);
    return;
  }

  if (action === 'add') {
    if (getAgentIdentity(id)) throw new Error(`Agent already exists: ${id}. Use agent set.`);
    const agent = upsertAgentIdentity({
      agentId: id,
      displayName: flags.name || id,
      surface: flags.surface || 'custom',
      aliases: aliases(flags.aliases),
      trustLevel: validateTrust(flags.trust || 'read-only')
    });
    if (flags.json) printJson(agent);
    else process.stdout.write(`Added agent ${agent.agentId} with trust ${agent.trustLevel}\n`);
    return;
  }

  if (action === 'set') {
    const existing = getAgentIdentity(id);
    if (!existing) throw new Error(`Agent not found: ${id}. Use agent add.`);
    const agent = upsertAgentIdentity({
      ...existing,
      displayName: flags.name || existing.displayName,
      surface: flags.surface || existing.surface,
      aliases: flags.aliases !== undefined ? aliases(flags.aliases) : existing.aliases,
      trustLevel: flags.trust ? validateTrust(flags.trust) : existing.trustLevel
    }, { allowBuiltInUpdate: true });
    if (flags.json) printJson(agent);
    else process.stdout.write(`Updated agent ${agent.agentId} with trust ${agent.trustLevel}\n`);
    return;
  }

  if (action === 'remove') {
    const removed = removeAgentIdentity(id);
    if (!removed) throw new Error(`Agent not found: ${id}`);
    if (flags.json) printJson({ removed });
    else process.stdout.write(`Removed agent ${removed.agentId}. Historical records were preserved.\n`);
    return;
  }

  throw new Error(`Unknown agent command: ${action}`);
}

function printProject(item) {
  process.stdout.write(`${item.projectId}\t${item.name}\t${item.root}\t${item.repoRemote || '-'}\n`);
}

function commandProject(action, flags) {
  if (action === 'list') {
    const projects = loadProjectRegistry().projects.slice().sort((a, b) => a.projectId.localeCompare(b.projectId));
    if (flags.json) printJson({ projects });
    else if (!projects.length) process.stdout.write('No projects identified\n');
    else projects.forEach(printProject);
    return;
  }

  if (action === 'identify') {
    const project = identifyProject(flags._[0] || '.', { name: flags.name, projectId: flags.id || flags.projectId });
    if (flags.json) printJson(project);
    else process.stdout.write(`Identified project ${project.projectId} at ${project.root}\n`);
    return;
  }

  if (action === 'show') {
    const value = flags._[0];
    if (!value) throw new Error('Usage: agent-kernel project show <project-id>');
    const project = findProject(value);
    if (!project) throw new Error(`Project not found: ${value}`);
    if (flags.json) printJson(project);
    else printProject(project);
    return;
  }

  if (action === 'set-id') {
    const target = flags._[0] || '.';
    const projectId = flags._[1] || flags.id || flags.projectId;
    if (!projectId) throw new Error('Usage: agent-kernel project set-id <path> <project-id>');
    const project = setProjectId(target, projectId);
    if (flags.json) printJson(project);
    else process.stdout.write(`Set project ID ${project.projectId} for ${project.root}\n`);
    return;
  }

  throw new Error(`Unknown project command: ${action}`);
}

function usage() {
  process.stdout.write(`agent-kernel-registry ${VERSION}\n\nUsage:\n  agent-kernel agent list [--json]\n  agent-kernel agent add <id> [--trust read-only] [--name name] [--surface cli] [--aliases a,b]\n  agent-kernel agent set <id> [--trust propose-only]\n  agent-kernel agent show <id> [--json]\n  agent-kernel agent remove <id>\n  agent-kernel project identify [path] [--id project-id] [--json]\n  agent-kernel project list [--json]\n  agent-kernel project show <project-id> [--json]\n  agent-kernel project set-id <path> <project-id> [--json]\n`);
}

function main() {
  const [family, action, ...rest] = process.argv.slice(2);
  if (!family || family === 'help' || family === '--help' || family === '-h') return usage();
  const flags = parseFlags(rest);
  if (family === 'agent') return commandAgent(action || 'list', flags);
  if (family === 'project') return commandProject(action || 'list', flags);
  throw new Error(`Unknown registry family: ${family}`);
}

try { main(); }
catch (error) {
  process.stderr.write(`${error?.message || String(error)}\n`);
  process.exitCode = 1;
}
