import path from 'node:path';
import { extractImports, packageName, resolveLocalImport } from './imports.mjs';
import { extractSymbols } from './symbols.mjs';
import { findCycles } from './graph.mjs';
import { languageForFile } from './language.mjs';
import { matchesAny, nowIso, readText, shortHash, sortObject, unique, walkCodeFiles } from './common.mjs';

function assignLayer(file, policy) {
  const matches = (policy.layers || []).filter((layer) => matchesAny(file, layer.include || []));
  return matches.length ? matches[0].name : null;
}

export function discoverArchitecture(root, policy) {
  const files = walkCodeFiles(root, { ignore: policy.ignore });
  const fileSet = new Set(files);
  const nodes = [];
  const edges = [];
  const externalPackages = [];
  const adjacency = new Map(files.map((file) => [file, []]));
  const languages = {};
  for (const file of files) {
    const text = readText(path.join(root, file));
    const language = languageForFile(file);
    languages[language] = (languages[language] || 0) + 1;
    const imports = extractImports(file, text);
    const symbols = extractSymbols(file, text);
    const layer = assignLayer(file, policy);
    nodes.push({ file, language, layer, symbols, hash: shortHash(text) });
    for (const specifier of imports) {
      const target = resolveLocalImport(file, specifier, fileSet);
      if (target) {
        edges.push({ from: file, to: target, specifier, fromLayer: layer, toLayer: assignLayer(target, policy) });
        adjacency.get(file).push(target);
      } else {
        const dependency = packageName(specifier);
        if (dependency) externalPackages.push(dependency);
      }
    }
  }
  const map = {
    version: 1,
    generatedAt: nowIso(),
    root: path.basename(root),
    fileCount: files.length,
    languages,
    externalPackages: unique(externalPackages).sort(),
    nodes: nodes.sort((a, b) => a.file.localeCompare(b.file)),
    edges: edges.sort((a, b) => `${a.from}:${a.to}`.localeCompare(`${b.from}:${b.to}`)),
    cycles: findCycles(adjacency).map((cycle) => cycle.path)
  };
  map.fingerprint = shortHash(sortObject({ nodes: map.nodes, edges: map.edges, externalPackages: map.externalPackages }));
  return map;
}
