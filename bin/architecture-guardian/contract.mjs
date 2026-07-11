import path from 'node:path';
import { finding } from './findings.mjs';
import { matchesAny, normalizeRelative } from './common.mjs';

function testCompanionFindings(files, contract, policy) {
  if (policy.rules?.testCompanion?.enabled !== true || !contract?.requiredTests?.length) return [];
  const changedTests = files.filter((file) => /(^|\/)(test|tests|__tests__)(\/|$)|\.(test|spec)\.[^.]+$/.test(file));
  if (changedTests.length) return [];
  return [finding({
    ruleId: 'required-test-companion', type: 'test-companion',
    severity: policy.rules?.testCompanion?.severity || 'warning', confidence: 1,
    title: 'Required test evidence is missing from the change',
    message: `The active contract requires test evidence: ${contract.requiredTests.join(', ')}.`,
    files, evidence: { requiredTests: contract.requiredTests }, enforcement: 'review',
    remediation: 'Add or update the tests named by the active change contract.'
  })];
}

export function evaluateContract(files, contract, policy) {
  const result = [];
  const normalized = [...new Set((files || []).map(normalizeRelative).filter(Boolean))].sort();
  if (policy.requireContractForWrites && (!contract || contract.status !== 'active' || !contract.task)) {
    result.push(finding({
      ruleId: 'active-change-contract', type: 'missing-contract', severity: 'high', confidence: 1,
      title: 'Active change contract required', message: 'The policy requires a reviewed change contract before writes.',
      files: normalized, evidence: { contractStatus: contract?.status || 'missing' }, enforcement: 'block',
      remediation: 'Create .agent-kernel/architecture/change-contract.json with the approved task scope.'
    }));
    return result;
  }
  if (!contract || contract.status !== 'active') return result;
  for (const file of normalized) {
    if (contract.forbiddenFiles?.length && matchesAny(file, contract.forbiddenFiles)) {
      result.push(finding({
        ruleId: 'contract-forbidden-file', type: 'scope', severity: 'critical', confidence: 1,
        title: 'File is explicitly forbidden by the change contract', message: `${file} is outside the approved change boundary.`,
        files: [file], evidence: { file, contract: path.basename(contract.file || 'change-contract.json') }, enforcement: 'block',
        remediation: 'Revise the design and contract before modifying this file.'
      }));
    } else if (contract.allowedFiles?.length && !matchesAny(file, contract.allowedFiles)) {
      result.push(finding({
        ruleId: 'contract-allowed-files', type: 'scope', severity: policy.rules?.scope?.severity || 'high', confidence: 1,
        title: 'File is outside the approved change scope', message: `${file} does not match any allowedFiles pattern.`,
        files: [file], evidence: { file, allowedFiles: contract.allowedFiles }, enforcement: 'block',
        remediation: 'Use an approved file or update the contract through review.'
      }));
    }
  }
  const maxFiles = Number(contract.maxFiles || policy.maxFilesPerChange || 0);
  if (maxFiles > 0 && normalized.length > maxFiles) {
    result.push(finding({
      ruleId: 'change-size', type: 'scope-size', severity: 'high', confidence: 1,
      title: 'Change exceeds approved file count', message: `${normalized.length} files changed; limit is ${maxFiles}.`,
      files: normalized, evidence: { actual: normalized.length, limit: maxFiles }, enforcement: 'block',
      remediation: 'Split the work into smaller independently reviewable changes.'
    }));
  }
  result.push(...testCompanionFindings(normalized, contract, policy));
  return result;
}
