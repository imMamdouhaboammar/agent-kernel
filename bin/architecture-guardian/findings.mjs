import { shortHash } from './common.mjs';

export function finding(input) {
  const normalized = {
    ruleId: input.ruleId,
    type: input.type,
    severity: input.severity || 'warning',
    confidence: Number(input.confidence ?? 1),
    title: input.title,
    message: input.message,
    files: [...new Set(input.files || [])].sort(),
    evidence: input.evidence || {},
    remediation: input.remediation || null,
    enforcement: input.enforcement || 'review'
  };
  normalized.fingerprint = shortHash({
    ruleId: normalized.ruleId,
    type: normalized.type,
    files: normalized.files,
    evidence: normalized.evidence
  }, 20);
  return normalized;
}

export function filterByConfidence(findings, threshold) {
  return findings.filter((item) => item.confidence >= threshold);
}
