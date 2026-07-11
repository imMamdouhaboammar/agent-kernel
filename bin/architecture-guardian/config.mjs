import { architecturePaths } from './paths.mjs';
import { DEFAULT_CONTRACT, DEFAULT_POLICY } from './defaults.mjs';
import { readJsonDocument, writeJsonAtomic } from './common.mjs';
import { validateContract, validatePolicy } from './validation.mjs';

function object(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function valueOrThrow(state, file) {
  if (!state.ok) throw new Error(`Invalid JSON at ${file}: ${state.error}`);
  return state.exists ? state.value : null;
}
function throwValidation(label, validation) {
  if (validation.ok) return;
  throw new Error(`${label} is invalid:\n${validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n')}`);
}
function mergeRules(rawRules) {
  if (rawRules === undefined) return DEFAULT_POLICY.rules;
  if (!rawRules || typeof rawRules !== 'object' || Array.isArray(rawRules)) return rawRules;
  const names = new Set([...Object.keys(DEFAULT_POLICY.rules), ...Object.keys(rawRules)]);
  return Object.fromEntries([...names].map((name) => {
    const base = DEFAULT_POLICY.rules[name];
    const override = rawRules[name];
    if (base && override && typeof override === 'object' && !Array.isArray(override)) return [name, { ...base, ...override }];
    return [name, override === undefined ? base : override];
  }));
}

export function readPolicyState(root) {
  return readJsonDocument(architecturePaths(root).policy);
}
export function readContractState(root, explicitFile = null) {
  return readJsonDocument(explicitFile || architecturePaths(root).contract);
}
export function readPolicyDocument(root) {
  const file = architecturePaths(root).policy;
  return valueOrThrow(readPolicyState(root), file);
}
export function readContractDocument(root, explicitFile = null) {
  const file = explicitFile || architecturePaths(root).contract;
  return valueOrThrow(readContractState(root, explicitFile), file);
}
export function loadPolicy(root) {
  const rawValue = readPolicyDocument(root);
  const raw = object(rawValue);
  if (rawValue !== null && rawValue !== raw) throw new Error('Architecture policy must be a JSON object.');
  const policy = { ...DEFAULT_POLICY, ...raw, rules: mergeRules(raw.rules) };
  throwValidation('Architecture policy', validatePolicy(policy));
  return policy;
}
export function writeDefaultPolicy(root, force = false) {
  const file = architecturePaths(root).policy;
  const state = readPolicyState(root);
  if (!state.ok && !force) throw new Error(`Invalid JSON at ${file}: ${state.error}`);
  if (state.exists && !force) return { file, created: false, policy: loadPolicy(root) };
  writeJsonAtomic(file, DEFAULT_POLICY);
  return { file, created: true, policy: DEFAULT_POLICY };
}
export function loadContract(root, explicitFile = null) {
  const file = explicitFile || architecturePaths(root).contract;
  const rawValue = readContractDocument(root, explicitFile);
  const raw = object(rawValue);
  if (rawValue !== null && rawValue !== raw) throw new Error('Architecture change contract must be a JSON object.');
  const contract = { ...DEFAULT_CONTRACT, ...raw, file };
  throwValidation('Architecture change contract', validateContract(contract));
  return contract;
}
