import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_MAX_FILE_BYTES,
  normalizeRelativePath,
  projectFilePath,
  uniqueSorted
} from './common.mjs';
import { readRegularFile } from './storage.mjs';

const EXCLUDED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '.turbo',
  '.cache',
  '.agent-kernel'
]);

const EXCLUDED_ENV_NAMES = new Set([
  '.env.example',
  '.env.sample',
  '.env.template',
  '.env.defaults'
]);

function isEnvironmentName(name) {
  return name === '.env' || name.startsWith('.env.');
}

function escapeRegex(value) {
  return value.replace(/[.+^${}()|[\]\\]/gu, '\\$&');
}

function globMatches(pattern, relativePath) {
  const normalizedPattern = normalizeRelativePath(pattern);
  const token = '__DOUBLE_STAR__';
  const source = escapeRegex(normalizedPattern.replace(/\*\*/gu, token))
    .replace(/\*/gu, '[^/]*')
    .replace(new RegExp(token, 'gu'), '.*');
  return new RegExp(`^${source}$`, 'u').test(relativePath);
}

function excluded(relativePath, patterns) {
  const name = path.posix.basename(relativePath);
  if (EXCLUDED_ENV_NAMES.has(name)) return true;
  return patterns.some((pattern) => globMatches(pattern, relativePath));
}

export function discoverEnvironmentFiles(projectRoot, options = {}) {
  const maxBytes = Number(options.maxBytes || DEFAULT_MAX_FILE_BYTES);
  const include = Array.isArray(options.include) ? options.include : options.include ? [options.include] : [];
  const exclude = Array.isArray(options.exclude) ? options.exclude : options.exclude ? [options.exclude] : [];
  const selected = [];
  let visited = 0;
  const maxVisited = Number(options.maxVisited || 10000);

  function walk(directory, prefix = '') {
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    for (const entry of entries) {
      visited += 1;
      if (visited > maxVisited) throw new Error(`Environment discovery exceeded ${maxVisited} entries`);
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = path.join(directory, entry.name);

      if (entry.isSymbolicLink()) {
        if (isEnvironmentName(entry.name)) throw new Error(`Refusing symlink environment file: ${relative}`);
        continue;
      }
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRECTORIES.has(entry.name)) walk(absolute, relative);
        continue;
      }
      if (!entry.isFile() || !isEnvironmentName(entry.name) || excluded(relative, exclude)) continue;
      readRegularFile(absolute, { maxBytes });
      selected.push(relative);
    }
  }

  walk(path.resolve(projectRoot));

  for (const requested of include) {
    const relative = normalizeRelativePath(requested);
    if (excluded(relative, exclude)) continue;
    const absolute = projectFilePath(projectRoot, relative);
    if (!fs.existsSync(absolute)) throw new Error(`Included environment file does not exist: ${relative}`);
    readRegularFile(absolute, { maxBytes });
    selected.push(relative);
  }

  return uniqueSorted(selected);
}

export function normalizeRequestedFiles(projectRoot, values) {
  if (!values) return null;
  const list = Array.isArray(values) ? values : [values];
  return uniqueSorted(list.map((value) => {
    if (path.isAbsolute(String(value))) {
      const relative = path.relative(path.resolve(projectRoot), path.resolve(String(value)));
      if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        throw new Error(`Environment file path escapes the project root: ${value}`);
      }
      return normalizeRelativePath(relative.split(path.sep).join('/'));
    }
    return normalizeRelativePath(value);
  }));
}
