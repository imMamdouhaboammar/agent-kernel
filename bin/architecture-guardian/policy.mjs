import { finding } from './findings.mjs';
import { matchesAny } from './common.mjs';

function layerPolicyFindings(map, policy) {
  const byName = new Map((policy.layers || []).map((layer) => [layer.name, layer]));
  const result = [];
  for (const edge of map.edges) {
    if (!edge.fromLayer || !edge.toLayer) continue;
    const layer = byName.get(edge.fromLayer);
    const allowed = layer?.mayDependOn || [];
    if (allowed.includes('*') || allowed.includes(edge.toLayer) || edge.fromLayer === edge.toLayer) continue;
    result.push(finding({
      ruleId: `layer:${edge.fromLayer}`,
      type: 'layer-dependency', severity: layer?.severity || 'high', confidence: 1,
      title: `Layer ${edge.fromLayer} cannot depend on ${edge.toLayer}`,
      message: `${edge.from} imports ${edge.to}, crossing an undeclared layer boundary.`,
      files: [edge.from, edge.to], evidence: { edge }, enforcement: layer?.enforcement || 'block',
      remediation: `Move the dependency behind an interface owned by ${edge.fromLayer}, or update the reviewed layer policy.`
    }));
  }
  return result;
}
function forbiddenFindings(map, policy) {
  const result = [];
  for (const rule of policy.forbiddenDependencies || []) {
    for (const edge of map.edges) {
      if (!matchesAny(edge.from, rule.from || []) || !matchesAny(edge.to, rule.to || [])) continue;
      result.push(finding({
        ruleId: rule.id || 'forbidden-dependency', type: 'forbidden-dependency',
        severity: rule.severity || 'critical', confidence: 1,
        title: rule.title || 'Forbidden dependency',
        message: rule.message || `${edge.from} must not depend on ${edge.to}.`,
        files: [edge.from, edge.to], evidence: { edge }, enforcement: rule.enforcement || 'block',
        remediation: rule.remediation || 'Use the approved boundary or dependency inversion.'
      }));
    }
  }
  return result;
}
function cycleFindings(map, policy) {
  if (policy.rules?.cycles?.enabled === false) return [];
  return map.cycles.map((cycle) => finding({
    ruleId: 'no-cycles', type: 'cycle', severity: policy.rules?.cycles?.severity || 'high', confidence: 1,
    title: 'Circular dependency detected', message: cycle.join(' -> '), files: [...new Set(cycle)],
    evidence: { cycle }, enforcement: 'block', remediation: 'Extract a stable interface or reverse one dependency.'
  }));
}
function externalPackageFindings(map, policy) {
  const denied = new Set(policy.deniedExternalPackages || []);
  const allowed = new Set(policy.allowedExternalPackages || []);
  const blocked = map.externalPackages.filter((name) => denied.has(name) || (policy.enforceExternalAllowlist && !allowed.has(name)));
  return blocked.map((name) => {
    const imports = (map.externalImports || []).filter((item) => item.package === name);
    return finding({
      ruleId: 'denied-external-package', type: 'external-package', severity: 'critical', confidence: 1,
      title: `External package is not approved: ${name}`, message: `${name} is disallowed by project architecture policy.`,
      files: imports.map((item) => item.from), evidence: { package: name, imports }, enforcement: 'block',
      remediation: 'Use an approved dependency or request a reviewed policy exception.'
    });
  });
}
export function evaluateArchitecture(map, policy) {
  return [...layerPolicyFindings(map, policy), ...forbiddenFindings(map, policy), ...cycleFindings(map, policy), ...externalPackageFindings(map, policy)];
}
