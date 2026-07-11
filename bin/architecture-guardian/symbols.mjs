import path from 'node:path';
import { languageForFile } from './language.mjs';
import { unique } from './common.mjs';

function jsSymbols(text) {
  const names = [];
  const patterns = [
    /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g,
    /(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/g,
    /(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g
  ];
  for (const pattern of patterns) for (const match of text.matchAll(pattern)) names.push(match[1]);
  return names;
}
function generic(text, patterns) {
  const names = [];
  for (const pattern of patterns) for (const match of text.matchAll(pattern)) names.push(match[1]);
  return names;
}
export function extractSymbols(file, text) {
  const language = languageForFile(file);
  const value = String(text || '');
  let names = [];
  if (language === 'javascript' || language === 'typescript') names = jsSymbols(value);
  else if (language === 'python') names = generic(value, [/^\s*def\s+([A-Za-z_]\w*)/gm, /^\s*class\s+([A-Za-z_]\w*)/gm]);
  else if (language === 'go') names = generic(value, [/^\s*func\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)/gm, /^\s*type\s+([A-Za-z_]\w*)/gm]);
  else if (language === 'rust') names = generic(value, [/^\s*(?:pub\s+)?fn\s+([A-Za-z_]\w*)/gm, /^\s*(?:pub\s+)?(?:struct|enum|trait)\s+([A-Za-z_]\w*)/gm]);
  else names = generic(value, [/(?:class|interface|struct|enum|function|func)\s+([A-Za-z_]\w*)/g]);
  if (!names.length) names.push(path.basename(file, path.extname(file)));
  return unique(names).sort();
}

export function capabilityTokens(value) {
  return String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .toLowerCase().split(/\s+/).filter((token) => token.length > 1);
}
