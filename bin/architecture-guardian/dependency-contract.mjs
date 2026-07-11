import { finding } from './findings.mjs';

export function evaluateDependencyContract(map, diff, contract, hasBaseline) {
  if (!hasBaseline || !contract || contract.status !== 'active') return [];
  const allowed = new Set(contract.allowedNewDependencies || []);
  return (diff.externalPackages?.added || [])
    .filter((name) => !allowed.has(name))
    .map((name) => {
      const imports = (map.externalImports || []).filter((item) => item.package === name);
      return finding({
        ruleId: 'contract-new-dependency', type: 'new-dependency', severity: 'high', confidence: 1,
        title: `New dependency is outside the change contract: ${name}`,
        message: `${name} was added after the architecture baseline but is not listed in allowedNewDependencies.`,
        files: imports.map((item) => item.from), evidence: { package: name, imports, allowed: [...allowed] }, enforcement: 'block',
        remediation: 'Use an existing dependency or update the reviewed change contract before adding this package.'
      });
    });
}
