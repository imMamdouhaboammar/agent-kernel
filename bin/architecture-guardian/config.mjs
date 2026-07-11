import { architecturePaths } from './paths.mjs';
import { DEFAULT_CONTRACT, DEFAULT_POLICY } from './defaults.mjs';
import { readJson, writeJsonAtomic } from './common.mjs';

function object(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }

export function readPolicyDocument(root) {
  return readJson(architecturePaths(root).policy, null);
}
export function readContractDocument(root, explicitFile = null) {
  return readJson(explicitFile || architecturePaths(root).contract, null);
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
  const existing = readPolicyDocument(root);
  if (existing && !force) return { file, created: false, policy: loadPolicy(root) };
  writeJsonAtomic(file, DEFAULT_POLICY);
  return { file, created: true, policy: DEFAULT_POLICY };
}
export function loadContract(root, explicitFile = null) {
  const file = explicitFile || architecturePaths(root).contract;
  const raw = object(readContractDocument(root, explicitFile));
  return { ...DEFAULT_CONTRACT, ...raw, file };
}
