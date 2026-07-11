#!/usr/bin/env node
import { createBaseline, architectureDiff, readBaseline } from './architecture-guardian/baseline.mjs';
import { architecturePaths } from './architecture-guardian/paths.mjs';
import { csv, parseFlags, projectRoot, readJson, writeJsonAtomic } from './architecture-guardian/common.mjs';
import { loadContract, loadPolicy, writeDefaultPolicy } from './architecture-guardian/config.mjs';
import { closeContract, createContract } from './architecture-guardian/contract-store.mjs';
import { discoverArchitecture } from './architecture-guardian/discovery.mjs';
import { architectureDoctor } from './architecture-guardian/doctor.mjs';
import { runCheck } from './architecture-guardian/engine.mjs';
import { addException, listExceptions, revokeException } from './architecture-guardian/exception-store.mjs';
import { evaluateArchitecture } from './architecture-guardian/policy.mjs';
import { formatReport } from './architecture-guardian/report.mjs';
import { searchReuse } from './architecture-guardian/reuse.mjs';
import { validateContract, validatePolicy } from './architecture-guardian/validation.mjs';

function output(value, json) { process.stdout.write(json ? JSON.stringify(value, null, 2) + '\n' : String(value)); }
function usage() {
  output(`agent-kernel architecture\n\nCommands:\n  init [project]\n  discover [project]\n  baseline [project]\n  diff [project]\n  check [project] [--files a,b] [--base ref] [--strict|--review]\n  reuse <query> [project]\n  contract init|show|validate|close [project]\n  exception add|list|revoke [project]\n  policy validate [project]\n  doctor [project]\n`, false);
}
function rootFor(flags, index) { return projectRoot(flags.project || flags._[index] || '.'); }
function failValidation(result) {
  output(result, true);
  if (!result.ok) process.exitCode = 2;
}
function requestedMode(flags) {
  if (flags.strict && flags.review) throw new Error('Use either --strict or --review, not both.');
  if (flags.strict) return 'strict';
  if (flags.review) return 'review';
  return null;
}
function main() {
  const flags = parseFlags(process.argv.slice(2));
  const command = flags._[0];
  if (!command || flags.help || flags.h) return usage();
  if (command === 'reuse') {
    const root = rootFor(flags, 2);
    const query = flags._[1] || flags.query || '';
    if (!query) throw new Error('reuse query is required');
    return output(searchReuse(discoverArchitecture(root, loadPolicy(root)), query, flags.limit), flags.json);
  }
  if (command === 'contract') {
    const action = flags._[1];
    const root = rootFor(flags, 2);
    if (action === 'init') return output(createContract(root, {
      task: flags.task, owner: flags.owner, status: flags.status,
      allowedFiles: flags.allow || flags.allowedFiles, forbiddenFiles: flags.forbid || flags.forbiddenFiles,
      expectedFiles: flags.expect || flags.expectedFiles, allowedNewDependencies: flags.dependencies,
      requiredTests: flags.tests, notes: flags.notes
    }), flags.json);
    if (action === 'show') return output(loadContract(root), flags.json);
    if (action === 'validate') return failValidation(validateContract(loadContract(root)));
    if (action === 'close') return output(closeContract(root), flags.json);
    throw new Error(`Unknown contract action: ${action || ''}`);
  }
  if (command === 'exception') {
    const action = flags._[1];
    const root = rootFor(flags, 2);
    if (action === 'add') return output(addException(root, {
      id: flags.id, ruleId: flags.rule, fingerprint: flags.fingerprint, files: flags.files,
      reason: flags.reason, owner: flags.owner, expiresAt: flags.expires
    }), flags.json);
    if (action === 'list') return output(listExceptions(root), flags.json);
    if (action === 'revoke') return output(revokeException(root, flags.id || flags._[3]), flags.json);
    throw new Error(`Unknown exception action: ${action || ''}`);
  }
  if (command === 'policy') {
    const action = flags._[1];
    const root = rootFor(flags, 2);
    if (action === 'validate') return failValidation(validatePolicy(loadPolicy(root)));
    throw new Error(`Unknown policy action: ${action || ''}`);
  }
  const root = rootFor(flags, 1);
  const paths = architecturePaths(root);
  if (command === 'init') {
    const policyResult = writeDefaultPolicy(root, Boolean(flags.force));
    if (!readJson(paths.exceptions, null)) writeJsonAtomic(paths.exceptions, { version: 1, exceptions: [] });
    return output({ ...policyResult, exceptionsFile: paths.exceptions }, flags.json);
  }
  if (command === 'discover') {
    const map = discoverArchitecture(root, loadPolicy(root));
    if (!flags['no-write']) writeJsonAtomic(paths.map, map);
    return output(map, flags.json);
  }
  if (command === 'baseline') {
    const policy = loadPolicy(root);
    const map = discoverArchitecture(root, policy);
    const baseline = createBaseline(map, evaluateArchitecture(map, policy));
    writeJsonAtomic(paths.baseline, baseline);
    return output(baseline, flags.json);
  }
  if (command === 'diff') {
    const map = discoverArchitecture(root, loadPolicy(root));
    return output(architectureDiff(map, readBaseline(flags.baseline || paths.baseline)), flags.json);
  }
  if (command === 'check') {
    const result = runCheck(root, {
      files: csv(flags.files), base: flags.base, contractFile: flags.contract,
      baselineFile: flags.baseline, mode: requestedMode(flags)
    });
    output(flags.json ? result.report : formatReport(result.report), flags.json);
    if (result.report.status === 'failed') process.exitCode = 2;
    return;
  }
  if (command === 'doctor') {
    const result = architectureDoctor(root);
    output(result, flags.json);
    if (!result.ok) process.exitCode = 2;
    return;
  }
  throw new Error(`Unknown architecture command: ${command}`);
}
try { main(); } catch (error) { process.stderr.write(`${error?.message || String(error)}\n`); process.exitCode = 1; }
