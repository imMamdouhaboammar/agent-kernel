import { capabilityTokens } from './symbols.mjs';

function similarity(queryTokens, candidateTokens) {
  if (!queryTokens.length || !candidateTokens.length) return 0;
  const query = new Set(queryTokens);
  const candidate = new Set(candidateTokens);
  const intersection = [...query].filter((token) => candidate.has(token)).length;
  const union = new Set([...query, ...candidate]).size;
  const containment = intersection / Math.min(query.size, candidate.size);
  const jaccard = intersection / union;
  return containment * 0.65 + jaccard * 0.35;
}
export function searchReuse(map, query, limit = 10) {
  const queryTokens = capabilityTokens(query);
  const candidates = [];
  for (const node of map.nodes || []) {
    for (const symbol of node.symbols || []) {
      const score = similarity(queryTokens, capabilityTokens(`${symbol} ${node.file}`));
      if (score <= 0) continue;
      candidates.push({ symbol, file: node.file, language: node.language, layer: node.layer, score: Number(score.toFixed(3)) });
    }
  }
  return candidates.sort((a, b) => b.score - a.score || a.file.localeCompare(b.file)).slice(0, Math.max(1, Number(limit || 10)));
}
