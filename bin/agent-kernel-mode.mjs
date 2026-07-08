#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const MODES = new Set(['approval', 'trusted', 'bypass']);

function homeDir() {
  return process.env.AGENT_KERNEL_HOME || path.join(os.homedir(), '.agent-kernel');
}

function configPath() {
  return path.join(homeDir(), 'config.json');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath, fallback) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return fallback; }
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function print(message = '') {
  process.stdout.write(String(message) + '\n');
}

function fail(message) {
  process.stderr.write(String(message) + '\n');
  process.exitCode = 1;
}

function defaultConfig() {
  return {
    version: '0.0.9',
    createdAt: new Date().toISOString(),
    generatedBy: 'agent-kernel',
    agentWriteMode: 'approval',
    memoryWritePolicy: {
      mode: 'approval',
      default: 'pending',
      bypassRequiresExplicitMode: true
    }
  };
}

function setMode(mode) {
  if (!MODES.has(mode)) {
    fail(`Unknown mode: ${mode}. Expected one of: ${Array.from(MODES).join(', ')}`);
    return;
  }
  const filePath = configPath();
  const config = readJson(filePath, defaultConfig());
  config.agentWriteMode = mode;
  config.memoryWritePolicy ||= {};
  config.memoryWritePolicy.mode = mode;
  config.memoryWritePolicy.default = mode === 'approval' ? 'pending' : mode === 'trusted' ? 'policy-gated' : 'approved';
  config.memoryWritePolicy.bypassRequiresExplicitMode = true;
  config.updatedAt = new Date().toISOString();
  writeJson(filePath, config);
  print(`Agent Kernel mode set to: ${mode}`);
  print(`Config: ${filePath}`);
}

function showMode() {
  const filePath = configPath();
  const config = readJson(filePath, defaultConfig());
  const mode = config.agentWriteMode || config.memoryWritePolicy?.mode || 'approval';
  print(JSON.stringify({ mode, config: filePath }, null, 2));
}

function usage() {
  print(`agent-kernel-mode\n\nUsage:\n  agent-kernel-mode show\n  agent-kernel-mode set approval\n  agent-kernel-mode set trusted\n  agent-kernel-mode set bypass\n\nModes:\n  approval  Agents create pending proposals. User approval is required.\n  trusted   Low-risk/project-scoped writes may be accepted; critical/global writes stay pending.\n  bypass    Agents may write approved memory directly. Use only when explicitly selected.\n`);
}

function main() {
  const [action, mode] = process.argv.slice(2);
  if (!action || action === '--help' || action === '-h') return usage();
  if (action === 'show') return showMode();
  if (action === 'set') return setMode(mode);
  fail(`Unknown action: ${action}`);
  usage();
}

main();
