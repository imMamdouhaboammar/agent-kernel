import path from 'node:path';

const GROUPS = {
  javascript: new Set(['.js', '.mjs', '.cjs', '.jsx']),
  typescript: new Set(['.ts', '.tsx', '.mts', '.cts']),
  python: new Set(['.py']),
  go: new Set(['.go']),
  java: new Set(['.java']),
  ruby: new Set(['.rb']),
  php: new Set(['.php']),
  csharp: new Set(['.cs']),
  rust: new Set(['.rs']),
  kotlin: new Set(['.kt', '.kts']),
  swift: new Set(['.swift'])
};

export function languageForFile(file) {
  const ext = path.extname(file).toLowerCase();
  for (const [language, extensions] of Object.entries(GROUPS)) if (extensions.has(ext)) return language;
  return 'unknown';
}
