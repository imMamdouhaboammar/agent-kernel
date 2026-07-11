import path from 'node:path';
import { builtinModules } from 'node:module';
import { languageForFile } from './language.mjs';
import { normalizeRelative, unique } from './common.mjs';

const NODE_BUILTINS = new Set(builtinModules.flatMap((name) => [name, `node:${name}`]));
const PYTHON_STDLIB = new Set([
  'abc','argparse','array','asyncio','base64','binascii','bisect','builtins','calendar','cmath','collections',
  'concurrent','contextlib','contextvars','copy','csv','dataclasses','datetime','decimal','difflib','email','enum',
  'errno','faulthandler','fnmatch','fractions','functools','gc','getopt','getpass','gettext','glob','graphlib','gzip',
  'hashlib','heapq','hmac','html','http','importlib','inspect','io','ipaddress','itertools','json','logging','lzma',
  'math','mimetypes','multiprocessing','numbers','operator','os','pathlib','pickle','pkgutil','platform','plistlib',
  'pprint','profile','pstats','queue','random','re','reprlib','secrets','selectors','shelve','shlex','shutil','signal',
  'site','socket','sqlite3','ssl','statistics','string','struct','subprocess','sys','tempfile','textwrap','threading',
  'time','timeit','trace','traceback','tracemalloc','types','typing','unittest','urllib','uuid','venv','warnings',
  'wave','weakref','webbrowser','xml','zipfile','zipimport','zlib'
]);

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

export function packageName(specifier, language = 'javascript') {
  if (!specifier || specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('#')) return null;
  if (language === 'javascript' || language === 'typescript') {
    const root = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
    if (NODE_BUILTINS.has(specifier) || NODE_BUILTINS.has(root) || NODE_BUILTINS.has(`node:${root}`)) return null;
    return root;
  }
  if (language === 'python') {
    const root = specifier.split('.')[0];
    return PYTHON_STDLIB.has(root) ? null : root;
  }
  if (language === 'go') {
    const first = specifier.split('/')[0];
    return first.includes('.') ? specifier : null;
  }
  if (language === 'rust') {
    const root = specifier.split('::')[0].replace(/[^A-Za-z0-9_]/g, '');
    return ['crate','self','super','std','core','alloc'].includes(root) ? null : root || null;
  }
  return null;
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
