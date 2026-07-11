import { architecturePaths } from './paths.mjs';
import { DEFAULT_CONTRACT } from './defaults.mjs';
import { csv, nowIso, writeJsonAtomic } from './common.mjs';
import { loadContract } from './config.mjs';
import { validateContract } from './validation.mjs';

export function createContract(root, input = {}) {
  const contract = {
    ...DEFAULT_CONTRACT,
    status: input.status || 'active',
    task: String(input.task || '').trim(),
    owner: String(input.owner || 'unassigned').trim(),
    allowedFiles: csv(input.allowedFiles),
    forbiddenFiles: csv(input.forbiddenFiles),
    expectedFiles: csv(input.expectedFiles),
    allowedNewDependencies: csv(input.allowedNewDependencies),
    requiredTests: csv(input.requiredTests),
    notes: csv(input.notes),
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  const validation = validateContract(contract);
  if (!validation.ok) throw new Error(validation.issues.map((item) => `${item.path}: ${item.message}`).join('\n'));
  writeJsonAtomic(architecturePaths(root).contract, contract);
  return contract;
}

export function closeContract(root) {
  const contract = loadContract(root);
  const updated = { ...contract, status: 'closed', updatedAt: nowIso(), closedAt: nowIso() };
  delete updated.file;
  writeJsonAtomic(architecturePaths(root).contract, updated);
  return updated;
}
