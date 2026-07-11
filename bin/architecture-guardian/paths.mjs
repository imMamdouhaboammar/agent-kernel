import path from 'node:path';

export function architecturePaths(root) {
  const dir = path.join(root, '.agent-kernel', 'architecture');
  return {
    dir,
    policy: path.join(dir, 'policy.json'),
    map: path.join(dir, 'current-map.json'),
    baseline: path.join(dir, 'baseline.json'),
    contract: path.join(dir, 'change-contract.json'),
    exceptions: path.join(dir, 'exceptions.json'),
    reports: path.join(dir, 'reports')
  };
}
