import { architecturePaths } from './paths.mjs';
import { readContractState, readPolicyState } from './config.mjs';
import { readJsonDocument } from './common.mjs';
import { validateContract, validateExceptionsDocument, validatePolicy } from './validation.mjs';

function validateState(state, validator, options = {}) {
  if (!state.ok) return { ok: false, issues: [{ path: '$', message: `invalid JSON: ${state.error}` }] };
  if (!state.exists) {
    return options.required
      ? { ok: false, issues: [{ path: '$', message: `${options.name || 'document'} file is missing` }] }
      : { ok: true, issues: [] };
  }
  return validator(state.value);
}

export function architectureDoctor(root) {
  const paths = architecturePaths(root);
  const policyState = readPolicyState(root);
  const contractState = readContractState(root);
  const exceptionsState = readJsonDocument(paths.exceptions);
  const policyValidation = validateState(policyState, validatePolicy, { required: true, name: 'policy' });
  const contractValidation = validateState(contractState, validateContract);
  const exceptionsValidation = exceptionsState.exists
    ? validateState(exceptionsState, validateExceptionsDocument)
    : validateExceptionsDocument({ version: 1, exceptions: [] });
  const checks = [
    { id: 'policy-present', ok: policyState.exists, detail: paths.policy },
    { id: 'policy-valid', ok: policyValidation.ok, detail: policyValidation.issues },
    { id: 'contract-valid', ok: contractValidation.ok, detail: contractValidation.issues },
    { id: 'exceptions-valid', ok: exceptionsValidation.ok, detail: exceptionsValidation.issues }
  ];
  return { ok: checks.every((check) => check.ok), checks };
}
