// test/package-files.mjs — Verify `npm pack --dry-run` includes the
// right files and excludes the wrong ones.
//
// Invariants:
//   1. The published tarball includes all required discovery and
//      governance files: dist/, docs/, README.md, CHANGELOG.md,
//      LICENSE, SKILL.md, skills.sh.json, .claude-plugin/.
//   2. The published tarball does NOT include: node_modules, .git,
//      audit logs, secrets, test fixtures.
//   3. The published package.json has the right name + version.
//
// The list of required files matches package.json#files.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { repo } from './_lib/helpers.mjs';

function resolveNpmCli() {
  const nodeDir = dirname(process.execPath);
  const candidates = [
    process.env.npm_execpath,
    join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    resolve(nodeDir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    '/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js',
    '/usr/local/lib/node_modules/npm/bin/npm-cli.js',
    '/usr/lib/node_modules/npm/bin/npm-cli.js'
  ].filter(Boolean);

  const npmCli = candidates.find((candidate) => existsSync(candidate));
  if (!npmCli) {
    throw new Error(
      `Unable to locate npm CLI without a shell. Checked: ${candidates.join(', ')}. ` +
        'Run this test through npm or install npm alongside Node.js.'
    );
  }
  return npmCli;
}

export async function run() {
  const pkg = JSON.parse(readFileSync(join(repo.root, 'package.json'), 'utf8'));

  // Build expected tarball entries from package.json#files.
  const expected = new Set(pkg.files);

  // `npm pack --dry-run` triggers the `prepack` script by default, which
  // can re-enter our test suite. Use --ignore-scripts to avoid that.
  // Execute npm's JavaScript CLI with the active Node binary so Windows
  // does not need cmd.exe and POSIX does not need sh.
  const npmCli = resolveNpmCli();
  const result = spawnSync(process.execPath, [npmCli, 'pack', '--dry-run', '--ignore-scripts'], {
    cwd: repo.root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  const out = `${stdout}\n${stderr}`;

  if (result.error || result.status !== 0) {
    const details = [
      `npm pack --dry-run failed (status: ${result.status ?? 'unknown'}, signal: ${result.signal ?? 'none'})`,
      result.error ? `error: ${result.error.message}` : null,
      `npm CLI: ${npmCli}`,
      `stdout:\n${stdout || '<empty>'}`,
      `stderr:\n${stderr || '<empty>'}`
    ]
      .filter(Boolean)
      .join('\n');
    throw new Error(details);
  }

  // The dry-run output contains one file entry per line, e.g.:
  //   "npm notice 1.2kB README.md"
  //   "npm notice 1.3kB .claude-plugin/marketplace.json"
  // Extract just the path component.
  const entries = out
    .split(/\r?\n/)
    .map((l) => {
      const m = l.match(/npm notice\s+\S+\s+(.+)$/);
      return m ? m[1].trim() : null;
    })
    .filter((e) => e && e.length > 0);

  // 1. Required top-level entries are present.
  for (const f of expected) {
    const present = entries.some((e) => e === f || e === `./${f}` || e.startsWith(f + '/') || e.startsWith('./' + f + '/'));
    if (!present) {
      throw new Error(
        `npm pack missing required entry: ${f}\n  total entries: ${entries.length}\n  first 5: ${entries.slice(0, 5).join(', ')}`
      );
    }
  }

  // 2. Forbidden entries are absent.
  const forbidden = [
    'node_modules',
    '.git',
    '.env',
    '.npmrc',
    'audit.json',
    'package-lock.json',
    'development',
    'develpment'
  ];
  for (const f of forbidden) {
    const present = entries.some((e) => e === f || e.startsWith(f + '/') || e.startsWith('./' + f + '/'));
    if (present) {
      throw new Error(`npm pack leaked forbidden entry: ${f}`);
    }
  }

  // 3. package.json metadata sanity.
  if (!pkg.name) throw new Error('package.json has no name');
  if (!pkg.version) throw new Error('package.json has no version');
  if (!pkg.license) throw new Error('package.json has no license');
}

export const name = 'package-files';
