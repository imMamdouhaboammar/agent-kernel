import { nowIso, severityRank } from './common.mjs';

export function buildReport(input) {
  const blockOn = new Set(input.policy.blockOn || ['critical', 'high']);
  const blocking = input.newFindings.filter((item) => item.enforcement === 'block' && blockOn.has(item.severity));
  const counts = { info: 0, warning: 0, medium: 0, high: 0, critical: 0 };
  for (const item of input.findings) counts[item.severity] = (counts[item.severity] || 0) + 1;
  return {
    version: 1,
    generatedAt: nowIso(),
    status: blocking.length ? 'failed' : input.newFindings.length ? 'review' : 'passed',
    summary: {
      filesScanned: input.map.fileCount,
      changedFiles: input.changedFiles.length,
      findings: input.findings.length,
      newFindings: input.newFindings.length,
      preExistingFindings: input.preExistingFindings.length,
      suppressed: input.suppressed.length,
      blocking: blocking.length,
      counts
    },
    blockingFindings: blocking.sort((a, b) => severityRank(b.severity) - severityRank(a.severity)),
    newFindings: input.newFindings,
    preExistingFindings: input.preExistingFindings,
    suppressed: input.suppressed,
    resolvedFingerprints: input.resolvedFingerprints,
    architectureDiff: input.architectureDiff,
    mapFingerprint: input.map.fingerprint
  };
}
export function formatReport(report) {
  const lines = [
    `Architecture Guardian: ${report.status.toUpperCase()}`,
    `Files scanned: ${report.summary.filesScanned}`,
    `Changed files: ${report.summary.changedFiles}`,
    `New findings: ${report.summary.newFindings}`,
    `Pre-existing findings: ${report.summary.preExistingFindings}`,
    `Suppressed: ${report.summary.suppressed}`,
    `Blocking: ${report.summary.blocking}`
  ];
  for (const item of report.blockingFindings) lines.push(`\n[${item.severity.toUpperCase()}] ${item.ruleId}\n${item.message}\nFiles: ${item.files.join(', ') || 'n/a'}`);
  return lines.join('\n') + '\n';
}
