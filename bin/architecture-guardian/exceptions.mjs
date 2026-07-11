import { architecturePaths } from './paths.mjs';
import { matchesAny, nowIso, readJson } from './common.mjs';

export function loadExceptions(root) {
  const value = readJson(architecturePaths(root).exceptions, { version: 1, exceptions: [] });
  return Array.isArray(value) ? value : Array.isArray(value?.exceptions) ? value.exceptions : [];
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
