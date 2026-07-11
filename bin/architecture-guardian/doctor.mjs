import fs from 'node:fs';
import { architecturePaths } from './paths.mjs';
import { loadContract, loadPolicy } from './config.mjs';
import { readJson } from './common.mjs';
import { validateContract, validateExceptionsDocument, validatePolicy } from './validation.mjs';

export function architectureDoctor(root) {
  const paths = architecturePaths(root);
  const policyExists = fs.existsSync(paths.policy);
  const policy = loadPolicy(root);
  const policyValidation = validatePolicy(policy);
  const contractExists = fs.existsSync(paths.contract);
  const contractValidation = contractExists ? validateContract(loadContract(root)) : { ok: true, issues: [] };
  const exceptionsExists = fs.existsSync(paths.exceptions);
  const exceptionsRaw = exceptionsExists ? readJson(paths.exceptions, null) : { version: 1, exceptions: [] };
  const exceptionsValidation = validateExceptionsDocument(exceptionsRaw);
  const checks = [
    { id: 'policy-present', ok: policyExists, detail: paths.policy },
    { id: 'policy-valid', ok: policyValidation.ok, detail: policyValidation.issues },
    { id: 'contract-valid', ok: contractValidation.ok, detail: contractValidation.issues },
    { id: 'exceptions-valid', ok: exceptionsValidation.ok, detail: exceptionsValidation.issues }
  ];
  return { ok: checks.every((check) => check.ok), checks };
}
