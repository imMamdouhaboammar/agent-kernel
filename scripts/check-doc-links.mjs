#!/usr/bin/env node

import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const root = resolve(process.argv[2] || repositoryRoot);
const ignoredDirectories = new Set(['.git', 'node_modules', 'coverage']);
const markdownLinkPattern = /!?\[[^\]]*\]\(([^)]+)\)/g;
const referenceDefinitionPattern = /^\s{0,3}\[[^\]]+\]:\s*(<[^>]+>|\S+)/gm;

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
  return text.replace(/```[\s\S]*?```/g, '').replace(/~~~[\s\S]*?~~~/g, '');
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
  return (
    destination.startsWith('#') ||
    destination.startsWith('//') ||
    /^[a-z][a-z0-9+.-]*:/i.test(destination)
  );
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

function collectDestinations(text) {
  const destinations = [];
  for (const pattern of [markdownLinkPattern, referenceDefinitionPattern]) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) destinations.push(match[1]);
  }
  return destinations;
}

const failures = [];
let checkedLinks = 0;
const markdownFiles = walk(root);

for (const file of markdownFiles) {
  const relativeFile = relative(root, file).replace(/\\/g, '/');
  const text = stripFencedCode(readFileSync(file, 'utf8'));
  for (const rawDestination of collectDestinations(text)) {
    const destination = parseDestination(rawDestination);
    if (!destination || shouldIgnore(destination)) continue;
    const target = resolveTarget(file, destination);
    if (!target) continue;
    checkedLinks += 1;
    if (!existsSync(target)) {
      failures.push(`${relativeFile}: ${destination}`);
      continue;
    }
    try {
      lstatSync(target);
    } catch {
      failures.push(`${relativeFile}: ${destination}`);
    }
  }
}

console.log(`Checked ${checkedLinks} local links across ${markdownFiles.length} markdown files.`);

if (failures.length > 0) {
  console.error(`Found ${failures.length} broken local markdown link(s):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('All local markdown links resolve.');