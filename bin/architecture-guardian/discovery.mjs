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
function inSourceRoots(file, policy) {
  const roots = policy.sourceRoots || [];
  return !roots.length || matchesAny(file, roots);
}

export function discoverArchitecture(root, policy) {
  const files = walkCodeFiles(root, { ignore: policy.ignore }).filter((file) => inSourceRoots(file, policy));
  const fileSet = new Set(files);
  const nodes = [];
  const edges = [];
  const externalImports = [];
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
        if (dependency) externalImports.push({ from: file, package: dependency, specifier });
      }
    }
  }
  const externalPackages = unique(externalImports.map((item) => item.package)).sort();
  const map = {
    version: 1,
    generatedAt: nowIso(),
    root: path.basename(root),
    fileCount: files.length,
    languages,
    externalPackages,
    externalImports: externalImports.sort((a, b) => `${a.package}:${a.from}`.localeCompare(`${b.package}:${b.from}`)),
    nodes: nodes.sort((a, b) => a.file.localeCompare(b.file)),
    edges: edges.sort((a, b) => `${a.from}:${a.to}`.localeCompare(`${b.from}:${b.to}`)),
    cycles: findCycles(adjacency).map((cycle) => cycle.path)
  };
  map.fingerprint = shortHash(sortObject({ nodes: map.nodes, edges: map.edges, externalImports: map.externalImports }));
  return map;
}
