import { architecturePaths } from './paths.mjs';
import { architectureDiff, classifyAgainstBaseline, readBaseline } from './baseline.mjs';
import { changedFiles, writeJsonAtomic } from './common.mjs';
import { loadContract, loadPolicy } from './config.mjs';
import { evaluateContract } from './contract.mjs';
import { evaluateDependencyContract } from './dependency-contract.mjs';
import { discoverArchitecture } from './discovery.mjs';
import { applyExceptions, loadExceptions } from './exceptions.mjs';
import { filterByConfidence } from './findings.mjs';
import { evaluateArchitecture } from './policy.mjs';
import { buildReport } from './report.mjs';

export function runCheck(root, options = {}) {
  const policy = loadPolicy(root);
  const map = discoverArchitecture(root, policy);
  const files = changedFiles(root, { files: options.files, base: options.base });
  const contract = loadContract(root, options.contractFile);
  const paths = architecturePaths(root);
  const baseline = readBaseline(options.baselineFile || paths.baseline);
  const diff = architectureDiff(map, baseline);
  const rawFindings = [
    ...evaluateArchitecture(map, policy),
    ...evaluateContract(files, contract, policy),
    ...evaluateDependencyContract(map, diff, contract, Boolean(baseline))
  ];
  const confident = filterByConfidence(rawFindings, Number(policy.confidenceThreshold || 0));
  const { findings, suppressed } = applyExceptions(confident, loadExceptions(root));
  const classification = classifyAgainstBaseline(findings, baseline);
  const report = buildReport({
    policy, map, changedFiles: files, findings, suppressed,
    ...classification,
    architectureDiff: diff
  });
  if (options.write !== false) {
    writeJsonAtomic(paths.map, map);
    writeJsonAtomic(`${paths.reports}/latest.json`, report);
  }
  return { policy, map, contract, report };
}
