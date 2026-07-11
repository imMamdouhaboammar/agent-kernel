#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { evaluateContract } from './architecture-guardian/contract.mjs';
import { loadContract, loadPolicy } from './architecture-guardian/config.mjs';
import { projectRoot, safeRelative } from './architecture-guardian/common.mjs';

function readPayload() { try { return JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { return {}; } }
function collectFiles(payload, root) {
  const input = payload.tool_input || payload.toolInput || {};
  const values = [input.file_path, input.filePath, input.path, input.filename, ...(Array.isArray(input.files) ? input.files : [])].filter(Boolean);
  return [...new Set(values.map((value) => safeRelative(root, path.isAbsolute(value) ? value : path.join(root, value))).filter(Boolean))];
}
function write(value) { process.stdout.write(JSON.stringify(value)); }
function deny(reason) {
  return write({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: String(reason || 'Architecture Guardian could not validate the write.').slice(0, 1000)
    }
  });
}
function hookPolicy(root) {
  const policy = loadPolicy(root);
  const override = process.env.AGENT_KERNEL_ARCHITECTURE_MODE;
  return ['review', 'strict'].includes(override) ? { ...policy, mode: override } : policy;
}
function main() {
  const payload = readPayload();
  const event = payload.hook_event_name || payload.hookEventName || payload.event || process.argv[2];
  if (event !== 'PreToolUse') return write({});
  const tool = String(payload.tool_name || payload.toolName || '');
  if (!['Write','Edit','MultiEdit'].includes(tool)) return write({});
  const root = projectRoot(payload.cwd || process.cwd());
  const files = collectFiles(payload, root);
  const policy = hookPolicy(root);
  const findings = evaluateContract(files, loadContract(root), policy);
  const candidateBlocking = findings.filter((item) => item.enforcement === 'block' && (policy.blockOn || []).includes(item.severity));
  if (policy.mode === 'strict' && candidateBlocking.length) {
    return deny(candidateBlocking.map((item) => item.message).join('\n'));
  }
  const review = candidateBlocking.length
    ? `Architecture Guardian review findings: ${candidateBlocking.map((item) => item.message).join(' | ')}`
    : files.length
      ? `Architecture Guardian checked scope for: ${files.join(', ')}`
      : 'Architecture Guardian found no file path to scope-check.';
  return write({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: review.slice(0, 1500) } });
}
try { main(); }
catch (error) { deny(`Architecture Guardian state validation failed: ${error?.message || String(error)}`); }
