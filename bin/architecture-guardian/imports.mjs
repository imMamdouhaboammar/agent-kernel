import path from 'node:path';
import { languageForFile } from './language.mjs';
import { normalizeRelative, unique } from './common.mjs';

function stripJsComments(text) {
  return String(text || '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}
function stripHashComments(text) {
  return String(text || '').replace(/^\s*#.*$/gm, '');
}

const EXTRACTORS = {
  javascript(text) {
    text = stripJsComments(text);
    const values = [];
    const patterns = [
      /(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g,
      /require\(\s*['"]([^'"]+)['"]\s*\)/g,
      /import\(\s*['"]([^'"]+)['"]\s*\)/g
    ];
    for (const pattern of patterns) for (const match of text.matchAll(pattern)) values.push(match[1]);
    return unique(values);
  },
  typescript(text) { return EXTRACTORS.javascript(text); },
  python(text) {
    text = stripHashComments(text);
    const values = [];
    for (const match of text.matchAll(/^\s*from\s+([A-Za-z0-9_\.]+)\s+import\s+/gm)) values.push(match[1]);
    for (const match of text.matchAll(/^\s*import\s+([A-Za-z0-9_\.]+)/gm)) values.push(match[1]);
    return unique(values);
  },
  go(text) {
    const values = [];
    for (const match of text.matchAll(/import\s+(?:[A-Za-z0-9_\.]+\s+)?"([^"]+)"/g)) values.push(match[1]);
    for (const block of text.matchAll(/import\s*\(([^)]+)\)/gs)) {
      for (const match of block[1].matchAll(/(?:[A-Za-z0-9_\.]+\s+)?"([^"]+)"/g)) values.push(match[1]);
    }
    return unique(values);
  },
  rust(text) {
    const values = [];
    for (const match of text.matchAll(/^\s*(?:use|mod)\s+([^;]+);/gm)) values.push(match[1].trim());
    return unique(values);
  },
  java(text) {
    return unique([...text.matchAll(/^\s*import\s+(?:static\s+)?([^;]+);/gm)].map((match) => match[1].trim()));
  },
  kotlin(text) { return EXTRACTORS.java(text); },
  csharp(text) {
    return unique([...text.matchAll(/^\s*using\s+([^;=]+);/gm)].map((match) => match[1].trim()));
  },
  ruby(text) {
    return unique([...text.matchAll(/^\s*require(?:_relative)?\s+['"]([^'"]+)['"]/gm)].map((match) => match[1]));
  },
  php(text) {
    return unique([...text.matchAll(/(?:require|include)(?:_once)?\s*\(?\s*['"]([^'"]+)['"]/g)].map((match) => match[1]));
  },
  swift(text) {
    return unique([...text.matchAll(/^\s*import\s+([A-Za-z0-9_\.]+)/gm)].map((match) => match[1]));
  }
};

export function extractImports(file, text) {
  const language = languageForFile(file);
  const extractor = EXTRACTORS[language];
  return extractor ? extractor(String(text || '')) : [];
}

export function packageName(specifier) {
  if (!specifier || specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('#')) return null;
  if (specifier.startsWith('@')) return specifier.split('/').slice(0, 2).join('/');
  return specifier.split('/')[0];
}

export function resolveLocalImport(fromFile, specifier, allFiles) {
  if (!specifier || (!specifier.startsWith('.') && !specifier.startsWith('/'))) return null;
  const base = normalizeRelative(path.join(path.dirname(fromFile), specifier));
  const candidates = [
    base,
    ...['.js','.mjs','.cjs','.jsx','.ts','.tsx','.mts','.cts','.py','.go','.java','.rb','.php','.cs','.rs','.kt','.kts','.swift'].map((ext) => base + ext),
    ...['index.js','index.mjs','index.cjs','index.jsx','index.ts','index.tsx','__init__.py','mod.rs'].map((name) => normalizeRelative(path.join(base, name)))
  ];
  return candidates.find((candidate) => allFiles.has(candidate)) || null;
}
