import { architecturePaths } from './paths.mjs';
import { DEFAULT_CONTRACT, DEFAULT_POLICY } from './defaults.mjs';
import { readJsonDocument, writeJsonAtomic } from './common.mjs';

function object(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function valueOrThrow(state, file) {
  if (!state.ok) throw new Error(`Invalid JSON at ${file}: ${state.error}`);
  return state.exists ? state.value : null;
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
  const raw = object(readPolicyDocument(root));
  return {
    ...DEFAULT_POLICY,
    ...raw,
    rules: { ...DEFAULT_POLICY.rules, ...object(raw.rules) },
    ignore: Array.isArray(raw.ignore) ? raw.ignore : DEFAULT_POLICY.ignore,
    sourceRoots: Array.isArray(raw.sourceRoots) ? raw.sourceRoots : DEFAULT_POLICY.sourceRoots,
    forbiddenDependencies: Array.isArray(raw.forbiddenDependencies) ? raw.forbiddenDependencies : [],
    layers: Array.isArray(raw.layers) ? raw.layers : [],
    deniedExternalPackages: Array.isArray(raw.deniedExternalPackages) ? raw.deniedExternalPackages : [],
    allowedExternalPackages: Array.isArray(raw.allowedExternalPackages) ? raw.allowedExternalPackages : []
  };
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
  const raw = object(readContractDocument(root, explicitFile));
  return { ...DEFAULT_CONTRACT, ...raw, file };
}
