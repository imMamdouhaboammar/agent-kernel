import { architecturePaths } from './paths.mjs';
import { csv, nowIso, readJsonStrict, shortHash, writeJsonAtomic } from './common.mjs';
import { validateExceptionsDocument } from './validation.mjs';

function document(root) {
  const value = readJsonStrict(architecturePaths(root).exceptions, { version: 1, exceptions: [] });
  const validation = validateExceptionsDocument(value);
  if (!validation.ok) throw new Error(validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
  return value;
}
export function listExceptions(root) { return document(root); }
export function addException(root, input = {}) {
  const doc = document(root);
  const createdAt = nowIso();
  const item = {
    id: input.id || `arch_exception_${shortHash(`${input.ruleId || ''}:${input.fingerprint || ''}:${createdAt}`, 12)}`,
    ruleId: input.ruleId || null,
    fingerprint: input.fingerprint || null,
    files: csv(input.files),
    reason: String(input.reason || '').trim(),
    owner: String(input.owner || 'user').trim(),
    createdAt,
    expiresAt: String(input.expiresAt || '').trim(),
    status: 'active'
  };
  const next = { version: 1, exceptions: [...doc.exceptions, item] };
  const validation = validateExceptionsDocument(next);
  if (!validation.ok) throw new Error(validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
  writeJsonAtomic(architecturePaths(root).exceptions, next);
  return item;
}
export function revokeException(root, id) {
  const doc = document(root);
  let found = false;
  doc.exceptions = doc.exceptions.map((item) => {
    if (item.id !== id) return item;
    found = true;
    return { ...item, status: 'revoked', revokedAt: nowIso() };
  });
  if (!found) throw new Error(`Architecture exception not found: ${id}`);
  writeJsonAtomic(architecturePaths(root).exceptions, doc);
  return doc.exceptions.find((item) => item.id === id);
}
