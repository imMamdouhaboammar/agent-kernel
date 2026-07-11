#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const VERSION = '1.8.0';

function kernelHome() {
  return process.env.AGENT_KERNEL_HOME || path.join(os.homedir(), '.agent-kernel');
}

function exists(filePath) {
  try { fs.accessSync(filePath); return true; } catch { return false; }
}

function readText(filePath, fallback = '') {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return fallback; }
}

function readJson(filePath, fallback) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return fallback; }
}

function runtimePaths() {
  const root = kernelHome();
  return {
    root,
    runtime: path.join(root, 'runtime'),
    runtimeStatus: path.join(root, 'runtime', 'daemon.json'),
    sessions: path.join(root, 'runtime', 'sessions'),
    pending: path.join(root, 'inbox', 'pending'),
    failures: path.join(root, 'source', 'failures', 'failure-lessons.json'),
    dist: path.join(root, 'dist'),
    distAgents: path.join(root, 'dist', 'AGENTS.md'),
    distPolicy: path.join(root, 'dist', 'policy.json')
  };
}

function parseFlags(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const raw = arg.slice(2);
      const eq = raw.indexOf('=');
      if (eq >= 0) out[raw.slice(0, eq)] = raw.slice(eq + 1);
      else if (argv[i + 1] && !argv[i + 1].startsWith('-')) out[raw] = argv[++i];
      else out[raw] = true;
    } else {
      out._.push(arg);
    }
  }
  return out;
}

function isPidAlive(pid) {
  if (!pid || !Number.isInteger(Number(pid))) return false;
  try { process.kill(Number(pid), 0); return true; } catch { return false; }
}

function listSessions() {
  const p = runtimePaths();
  if (!exists(p.sessions)) return [];
  return fs.readdirSync(p.sessions)
    .filter((name) => name.endsWith('.json') && !name.endsWith('.jsonl'))
    .map((name) => readJson(path.join(p.sessions, name), null))
    .filter(Boolean)
    .sort((a, b) => String(b.updatedAt || b.startedAt || '').localeCompare(String(a.updatedAt || a.startedAt || '')));
}

function sessionStats() {
  const sessions = listSessions();
  const activeSessions = sessions.filter((session) => session.status === 'active').length;
  const lastObservationAt = sessions
    .map((session) => session.updatedAt || session.startedAt || '')
    .filter(Boolean)
    .sort()
    .at(-1) || null;
  return { sessionCount: sessions.length, activeSessions, lastObservationAt };
}

function daemonStatus() {
  const p = runtimePaths();
  const raw = readJson(p.runtimeStatus, null);
  const running = !!raw && isPidAlive(raw.pid);
  const startedAtMs = running ? Date.parse(raw.startedAt || '') : NaN;
  const uptimeMs = running && Number.isFinite(startedAtMs) ? Math.max(0, Date.now() - startedAtMs) : null;
  return {
    running,
    statusPath: p.runtimeStatus,
    ...(raw || {}),
    ...sessionStats(),
    uptimeMs,
    uptimeSeconds: uptimeMs === null ? null : Math.floor(uptimeMs / 1000)
  };
}

function countJsonFiles(dir) {
  try { return fs.readdirSync(dir).filter((name) => name.endsWith('.json')).length; } catch { return 0; }
}

function failureLessonCount() {
  const value = readJson(runtimePaths().failures, []);
  return Array.isArray(value) ? value.length : 0;
}

function claudeMcpInstalled() {
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  const settings = readJson(settingsPath, {});
  return !!settings?.mcpServers?.['agent-kernel-memory'];
}

function gitHookInstalled() {
  const hookPath = path.join(process.cwd(), '.git', 'hooks', 'pre-commit');
  return readText(hookPath, '').includes('agent-kernel');
}

function diagnostics() {
  const p = runtimePaths();
  const status = daemonStatus();
  const checks = [];
  const add = (id, level, message, detail = {}) => checks.push({ id, level, message, ...detail });

  add('kernel-home', exists(p.root) ? 'ok' : 'warn', exists(p.root) ? `Kernel home exists: ${p.root}` : `Kernel home missing: ${p.root}`, { path: p.root });
  add('runtime-daemon', status.running ? 'ok' : 'warn', status.running ? `Daemon running on ${status.host}:${status.port}` : 'Daemon is stopped. Start it with: agent-kernel daemon start', { running: status.running });

  if (status.running && status.host !== '127.0.0.1' && status.host !== 'localhost') {
    add('runtime-bind', 'critical', `Daemon is bound to non-local host: ${status.host}`, { host: status.host });
  } else {
    add('runtime-bind', 'ok', status.running ? `Daemon bind is local: ${status.host}` : 'Daemon bind cannot be checked while stopped');
  }

  if (process.env.AGENT_KERNEL_DAEMON_ALLOW_REMOTE && !process.env.AGENT_KERNEL_DAEMON_TOKEN) {
    add('runtime-secret', 'critical', 'Remote daemon mode is enabled without AGENT_KERNEL_DAEMON_TOKEN');
  } else {
    add('runtime-secret', 'ok', 'No unsafe remote daemon secret state detected');
  }

  add('sessions', 'ok', `${status.sessionCount} session(s), ${status.activeSessions} active`, { sessionCount: status.sessionCount, activeSessions: status.activeSessions, lastObservationAt: status.lastObservationAt });
  add('pending-proposals', 'ok', `${countJsonFiles(p.pending)} pending proposal(s)`, { pendingProposals: countJsonFiles(p.pending) });
  add('failure-lessons', 'ok', `${failureLessonCount()} Failure Lesson(s)`, { failureLessons: failureLessonCount() });
  add('compiled-agents', exists(p.distAgents) ? 'ok' : 'warn', exists(p.distAgents) ? 'Compiled AGENTS.md exists' : 'Compiled AGENTS.md missing. Run: agent-kernel compile');
  add('compiled-policy', exists(p.distPolicy) ? 'ok' : 'warn', exists(p.distPolicy) ? 'Compiled policy.json exists' : 'Compiled policy.json missing. Run: agent-kernel compile');
  add('mcp-claude', claudeMcpInstalled() ? 'ok' : 'warn', claudeMcpInstalled() ? 'Claude MCP config installed' : 'Claude MCP config not installed. Run: agent-kernel mcp install claude');
  add('git-hook', gitHookInstalled() ? 'ok' : 'warn', gitHookInstalled() ? 'Project pre-commit hook mentions agent-kernel' : 'Project pre-commit hook not detected. Run: agent-kernel-safe-git-hook .');

  const hasCritical = checks.some((check) => check.level === 'critical');
  const hasWarn = checks.some((check) => check.level === 'warn');
  return {
    ok: !hasCritical && !hasWarn,
    level: hasCritical ? 'critical' : hasWarn ? 'warning' : 'ok',
    version: VERSION,
    home: p.root,
    runtime: status,
    checks
  };
}

function commandStatus(flags) {
  const status = daemonStatus();
  if (flags.json) {
    process.stdout.write(JSON.stringify({ version: VERSION, home: kernelHome(), runtime: status }, null, 2) + '\n');
    return;
  }
  process.stdout.write(`Agent Kernel ${VERSION}\n`);
  process.stdout.write(`Home: ${kernelHome()}\n`);
  process.stdout.write(`Runtime: ${status.running ? 'running' : 'stopped'}\n`);
  if (status.running) {
    process.stdout.write(`URL: http://${status.host}:${status.port}\n`);
    process.stdout.write(`PID: ${status.pid}\n`);
    process.stdout.write(`Uptime: ${status.uptimeSeconds}s\n`);
  }
  process.stdout.write(`Sessions: ${status.sessionCount}\n`);
  process.stdout.write(`Active sessions: ${status.activeSessions}\n`);
  process.stdout.write(`Last observation: ${status.lastObservationAt || 'none'}\n`);
}

function commandDoctor(flags) {
  const report = diagnostics();
  if (flags.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    process.stdout.write(`Agent Kernel runtime doctor ${VERSION}\n\n`);
    for (const check of report.checks) {
      const mark = check.level === 'ok' ? '✓' : check.level === 'warn' ? '!' : '✗';
      process.stdout.write(`${mark} ${check.id}: ${check.message}\n`);
    }
    process.stdout.write(`\nResult: ${report.level}\n`);
  }
  process.exitCode = report.level === 'critical' ? 2 : report.level === 'warning' ? 1 : 0;
}

function usage() {
  process.stdout.write(`agent-kernel-runtime-doctor ${VERSION}\n\nUsage:\n  agent-kernel-runtime-doctor status [--json]\n  agent-kernel-runtime-doctor doctor [--json]\n`);
}

function main() {
  const [command, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);
  if (!command || command === 'help' || command === '--help' || command === '-h') return usage();
  if (command === 'status') return commandStatus(flags);
  if (command === 'doctor') return commandDoctor(flags);
  process.stderr.write(`Unknown runtime diagnostic command: ${command}\n`);
  usage();
  process.exitCode = 1;
}

main();
