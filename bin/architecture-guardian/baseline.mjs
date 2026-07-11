import { nowIso, readJson, shortHash, sortObject } from './common.mjs';

export function createBaseline(map, findings) {
  return {
    version: 1,
    createdAt: nowIso(),
    mapFingerprint: map.fingerprint,
    findingFingerprints: [...new Set(findings.map((item) => item.fingerprint))].sort(),
    architecture: sortObject({
      nodes: map.nodes,
      edges: map.edges,
      externalPackages: map.externalPackages,
      externalImports: map.externalImports,
      cycles: map.cycles
    })
  };
}
export function classifyAgainstBaseline(findings, baseline) {
  const known = new Set(baseline?.findingFingerprints || []);
  return {
    newFindings: findings.filter((item) => !known.has(item.fingerprint)),
    preExistingFindings: findings.filter((item) => known.has(item.fingerprint)),
    resolvedFingerprints: [...known].filter((fingerprint) => !findings.some((item) => item.fingerprint === fingerprint))
  };
}
export function architectureDiff(map, baseline) {
  const before = baseline?.architecture || { nodes: [], edges: [], externalPackages: [], externalImports: [], cycles: [] };
  const key = (value) => shortHash(sortObject(value), 20);
  function diff(beforeItems, afterItems) {
    const beforeMap = new Map(beforeItems.map((item) => [key(item), item]));
    const afterMap = new Map(afterItems.map((item) => [key(item), item]));
    return {
      added: [...afterMap].filter(([id]) => !beforeMap.has(id)).map(([, item]) => item),
      removed: [...beforeMap].filter(([id]) => !afterMap.has(id)).map(([, item]) => item)
    };
  }
  return {
    nodes: diff(before.nodes || [], map.nodes || []),
    edges: diff(before.edges || [], map.edges || []),
    externalPackages: {
      added: (map.externalPackages || []).filter((item) => !(before.externalPackages || []).includes(item)),
      removed: (before.externalPackages || []).filter((item) => !(map.externalPackages || []).includes(item))
    },
    externalImports: diff(before.externalImports || [], map.externalImports || []),
    cycles: diff(before.cycles || [], map.cycles || [])
  };
}
export function readBaseline(file) { return readJson(file, null); }
