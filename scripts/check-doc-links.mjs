#!/usr/bin/env node

import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const root = resolve(process.argv[2] || repositoryRoot);
const ignoredDirectories = new Set(['.git', 'node_modules', 'coverage']);
const markdownLinkStartPattern = /!?\[[^\]]*\]\(/g;
const referenceDefinitionPattern = /^\s{0,3}\[[^\]]+\]:\s*(<[^>]+>|\S+)/gm;
const privateHomePathPatterns = [
  /\/Users\/([^/\s"'`]+)\//g,
  /\/home\/([^/\s"'`]+)\//g,
  /[A-Za-z]:[\\/]Users[\\/]([^\\/\s"'`]+)[\\/]/g
];
const privateUserNames = new Set(['mamdouh', 'mamdouhaboammar', 'mamdouh-aboammar']);
const privacyCheckedFiles = new Set(['development/BACKLOG.md']);

function walk(dir, results = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath, results);
    else if (entry.isFile() && extname(entry.name).toLowerCase() === '.md') results.push(fullPath);
  }
  return results;
}

function stripFencedCode(text) {
  const lines = text.split(/(?<=\n)/);
  const output = [];
  let fence = null;
  for (const line of lines) {
    const match = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (!fence) {
      if (match) {
        fence = { marker: match[1][0], length: match[1].length };
        output.push(line.replace(/[^\n]/g, ' '));
      } else output.push(line);
      continue;
    }
    const closingPattern = new RegExp(`^ {0,3}${fence.marker === '`' ? '`' : '~'}{${fence.length},}\\s*(?:\\n)?$`);
    output.push(line.replace(/[^\n]/g, ' '));
    if (closingPattern.test(line)) fence = null;
  }
  return output.join('');
}

function stripInlineCode(text) {
  const output = [...text];
  let index = 0;
  while (index < text.length) {
    if (text[index] !== '`') {
      index += 1;
      continue;
    }
    let runEnd = index;
    while (text[runEnd] === '`') runEnd += 1;
    const runLength = runEnd - index;
    let closingStart = runEnd;
    while (closingStart < text.length) {
      closingStart = text.indexOf('`'.repeat(runLength), closingStart);
      if (closingStart === -1) break;
      const beforeIsBacktick = closingStart > 0 && text[closingStart - 1] === '`';
      const afterIsBacktick = text[closingStart + runLength] === '`';
      if (!beforeIsBacktick && !afterIsBacktick) break;
      closingStart += runLength;
    }
    if (closingStart === -1) {
      index = runEnd;
      continue;
    }
    const closingEnd = closingStart + runLength;
    for (let cursor = index; cursor < closingEnd; cursor += 1) {
      if (output[cursor] !== '\n') output[cursor] = ' ';
    }
    index = closingEnd;
  }
  return output.join('');
}

function stripHtmlComments(text) {
  const output = [...text];
  let searchFrom = 0;
  while (searchFrom < text.length) {
    const openingStart = text.indexOf('<!--', searchFrom);
    if (openingStart === -1) break;
    const closingStart = text.indexOf('-->', openingStart + 4);
    const commentEnd = closingStart === -1 ? text.length : closingStart + 3;
    for (let cursor = openingStart; cursor < commentEnd; cursor += 1) {
      if (output[cursor] !== '\n') output[cursor] = ' ';
    }
    if (closingStart === -1) break;
    searchFrom = commentEnd;
  }
  return output.join('');
}

function parseDestination(rawDestination) {
  const trimmed = rawDestination.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('<')) {
    const closing = trimmed.indexOf('>');
    return closing === -1 ? null : trimmed.slice(1, closing);
  }
  return trimmed.split(/\s+["'(]/, 1)[0];
}

function shouldIgnore(destination) {
  return destination.startsWith('#') || destination.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(destination);
}

function resolveTarget(sourceFile, destination) {
  const withoutFragment = destination.split('#', 1)[0];
  const withoutQuery = withoutFragment.split('?', 1)[0];
  if (!withoutQuery) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(withoutQuery);
  } catch {
    decoded = withoutQuery;
  }
  return resolve(dirname(sourceFile), decoded);
}

function collectMarkdownLinkDestinations(text) {
  const destinations = [];
  markdownLinkStartPattern.lastIndex = 0;
  let match;
  while ((match = markdownLinkStartPattern.exec(text)) !== null) {
    const destinationStart = markdownLinkStartPattern.lastIndex;
    let nestedParentheses = 0;
    let cursor = destinationStart;
    while (cursor < text.length) {
      const character = text[cursor];
      if (character === '\\') {
        cursor += 2;
        continue;
      }
      if (character === '(') nestedParentheses += 1;
      else if (character === ')') {
        if (nestedParentheses === 0) {
          destinations.push(text.slice(destinationStart, cursor));
          markdownLinkStartPattern.lastIndex = cursor + 1;
          break;
        }
        nestedParentheses -= 1;
      }
      cursor += 1;
    }
  }
  return destinations;
}

function collectDestinations(text) {
  const destinations = collectMarkdownLinkDestinations(text);
  referenceDefinitionPattern.lastIndex = 0;
  let match;
  while ((match = referenceDefinitionPattern.exec(text)) !== null) destinations.push(match[1]);
  return destinations;
}

function collectPrivateHomePaths(text) {
  const matches = [];
  const lines = text.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const pattern of privateHomePathPatterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(line)) !== null) {
        if (privateUserNames.has(match[1].toLowerCase())) {
          matches.push({ line: index + 1, path: match[0] });
        }
      }
    }
  }
  return matches;
}

const linkFailures = [];
const privacyFailures = [];
let checkedLinks = 0;
const markdownFiles = walk(root);

for (const file of markdownFiles) {
  const relativeFile = relative(root, file).replace(/\\/g, '/');
  const rawText = readFileSync(file, 'utf8');
  const linkText = stripHtmlComments(stripInlineCode(stripFencedCode(rawText)));
  for (const rawDestination of collectDestinations(linkText)) {
    const destination = parseDestination(rawDestination);
    if (!destination || shouldIgnore(destination)) continue;
    const target = resolveTarget(file, destination);
    if (!target) continue;
    checkedLinks += 1;
    if (!existsSync(target)) {
      linkFailures.push(`${relativeFile}: ${destination}`);
      continue;
    }
    try {
      lstatSync(target);
    } catch {
      linkFailures.push(`${relativeFile}: ${destination}`);
    }
  }
  if (privacyCheckedFiles.has(relativeFile)) {
    for (const finding of collectPrivateHomePaths(rawText)) {
      privacyFailures.push(`${relativeFile}:${finding.line}: ${finding.path}`);
    }
  }
}

console.log(`Checked ${checkedLinks} local links across ${markdownFiles.length} markdown files.`);
if (linkFailures.length > 0) {
  console.error(`Found ${linkFailures.length} broken local markdown link(s):`);
  for (const failure of linkFailures) console.error(`  - ${failure}`);
}
if (privacyFailures.length > 0) {
  console.error(`Found ${privacyFailures.length} repository owner home path(s):`);
  for (const failure of privacyFailures) console.error(`  - ${failure}`);
}
if (linkFailures.length > 0 || privacyFailures.length > 0) process.exit(1);
console.log('All local markdown links resolve.');
console.log('No repository owner home paths found in checked Markdown examples.');
