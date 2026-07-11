import { architecturePaths } from './paths.mjs';
import { matchesAny, nowIso, readJsonStrict } from './common.mjs';
import { validateExceptionsDocument } from './validation.mjs';

export function loadExceptions(root) {
  const value = readJsonStrict(architecturePaths(root).exceptions, { version: 1, exceptions: [] });
  const document = Array.isArray(value) ? { version: 1, exceptions: value } : value;
  const validation = validateExceptionsDocument(document);
  if (!validation.ok) {
    throw new Error(validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
  }
  return document.exceptions;
}
function active(exception, now = nowIso()) {
  if (exception.status === 'revoked') return false;
  return !exception.expiresAt || exception.expiresAt >= now;
}
function matches(exception, finding) {
  if (exception.ruleId && exception.ruleId !== finding.ruleId) return false;
  if (exception.fingerprint && exception.fingerprint !== finding.fingerprint) return false;
  if (exception.files?.length && !finding.files.some((file) => matchesAny(file, exception.files))) return false;
  return true;
}
export function applyExceptions(findings, exceptions, now = nowIso()) {
  const kept = [];
  const suppressed = [];
  for (const item of findings) {
    const exception = exceptions.find((candidate) => active(candidate, now) && matches(candidate, item));
    if (exception) suppressed.push({ ...item, suppressedBy: exception.id || null, suppressionReason: exception.reason || null });
    else kept.push(item);
  }
  return { findings: kept, suppressed };
}
