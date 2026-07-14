#!/usr/bin/env node
// scripts/build.mjs — Build the agent-kernel CLI.
//
// Step 1: read package.json and inject the version string into both
//         src/cli.mjs and dist/cli.mjs so they stay in lock-step with
//         the published npm package version.
// Step 2: apply small runtime compatibility patches that keep the
//         monolithic CLI aligned with public helper behavior.
// Step 3: write the updated src/cli.mjs (if it changed) and copy it
//         to dist/cli.mjs.
// Step 4: ensure dist/cli.mjs is executable.
//
// After this script runs, dist/cli.mjs is byte-identical to
// src/cli.mjs, both with VERSION = package.json#version.

import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const srcPath = join(root, 'src', 'cli.mjs');
const distPath = join(root, 'dist', 'cli.mjs');
const VERSION_REGEX = /const VERSION = ['"]([^'"]+)['"]/;

function applyRuntimePatches(srcText) {
  const agentsWrite = "writeText(path.join(root, 'AGENTS.md'), `${agents}\n\n## Project bridge\n\nLinked project: ${root}\nLinked at: ${nowIso()}\n`);";
  const claudeWrite = "writeText(path.join(root, 'CLAUDE.md'), readText(path.join(p.dist, 'CLAUDE.md')));";

  if (!srcText.includes(agentsWrite)) {
    console.error('✗ commandLink AGENTS.md write anchor not found — inspect src/cli.mjs before building');
    process.exit(1);
  }

  if (!srcText.includes(claudeWrite)) {
    srcText = srcText.replace(agentsWrite, `${agentsWrite}\n  ${claudeWrite}`);
  }

  const episodeLimitLine = 'const EPISODE_TEXT_LIMIT = 120000;';
  const redactionBlock = `const EPISODE_REDACTION_PATTERNS = [
  ...DEFAULT_SECRET_PATTERNS,
  '(' + 'OPENAI_API_KEY|ANTHROPIC_API_KEY|SUPABASE_SERVICE_ROLE_KEY' + ')\\s*=\\s*[^\\s\\n]+',
  'github_' + 'pat_[A-Za-z0-9_]{20,}',
  'xox' + '[abposr]-[A-Za-z0-9-]{10,}'
];

function redactEpisodeText(value) {
  let text = String(value || '');
  for (const pattern of EPISODE_REDACTION_PATTERNS) {
    try { text = text.replace(new RegExp(pattern, 'gi'), '[REDACTED_SECRET]'); } catch {}
  }
  return text;
}`;

  if (!srcText.includes('function redactEpisodeText(')) {
    if (!srcText.includes(episodeLimitLine)) {
      console.error('✗ EPISODE_TEXT_LIMIT anchor not found — inspect src/cli.mjs before building');
      process.exit(1);
    }
    srcText = srcText.replace(episodeLimitLine, `${episodeLimitLine}\n${redactionBlock}`);
  }

  const rawTextLine = "const text = String(input.text || '').slice(0, EPISODE_TEXT_LIMIT);";
  const redactedTextLine = "const text = redactEpisodeText(input.text || '').slice(0, EPISODE_TEXT_LIMIT);";
  if (srcText.includes(rawTextLine)) srcText = srcText.replace(rawTextLine, redactedTextLine);

  const titleLine = "title: input.title || titleFromText(text),";
  const redactedTitleLine = "title: redactEpisodeText(input.title || titleFromText(text)).slice(0, 200),";
  if (srcText.includes(titleLine)) srcText = srcText.replace(titleLine, redactedTitleLine);

  const summaryLine = "summary: input.summary || '',";
  const redactedSummaryLine = "summary: redactEpisodeText(input.summary || ''),";
  if (srcText.includes(summaryLine)) srcText = srcText.replace(summaryLine, redactedSummaryLine);

  const projectLine = "project: input.project || '',";
  const redactedProjectLine = "project: redactEpisodeText(input.project || ''),";
  if (srcText.includes(projectLine)) srcText = srcText.replace(projectLine, redactedProjectLine);

  const tagsLine = "tags: Array.isArray(input.tags) ? input.tags : String(input.tags || '').split(',').map(s => s.trim()).filter(Boolean),";
  const redactedTagsLine = "tags: Array.isArray(input.tags) ? input.tags.map(redactEpisodeText) : redactEpisodeText(String(input.tags || '')).split(',').map(s => s.trim()).filter(Boolean),";
  if (srcText.includes(tagsLine)) srcText = srcText.replace(tagsLine, redactedTagsLine);

  const updateRendererAnchor = 'function renderAgentsMd(data) {';
  const updateRendererBlock = [
    'function renderUpdateGuidance(data) {',
    "  const cache = readJson(path.join(data.paths.root, 'runtime', 'update-status.json'), null);",
    "  if (!cache || cache.updateAvailable !== true || !cache.currentVersion || !cache.targetVersion) return '';",
    "  const updates = { mode: 'disabled', channel: cache.channel || 'latest', trustedAgents: [], ...(data.config?.updates || {}) };",
    "  const trusted = Array.isArray(updates.trustedAgents) && updates.trustedAgents.length ? updates.trustedAgents.join(', ') : 'none';",
    "  return '\\n## Agent Kernel update available\\n\\n- Installed: ' + cache.currentVersion + '\\n- Available: ' + cache.targetVersion + '\\n- Channel: ' + (cache.channel || updates.channel) + '\\n- Mode: ' + updates.mode + '\\n- Trusted agents: ' + trusted + '\\n\\nRun: agent-kernel update apply --agent <agent-id>\\n';",
    '}',
    '',
    updateRendererAnchor
  ].join('\n');

  if (!srcText.includes('function renderUpdateGuidance(')) {
    if (!srcText.includes(updateRendererAnchor)) {
      console.error('✗ renderAgentsMd anchor not found — inspect src/cli.mjs before building');
      process.exit(1);
    }
    srcText = srcText.replace(updateRendererAnchor, updateRendererBlock);
  }

  const checklistAnchor = '- Never hide policy violations or skipped checks.\\n${MARKER_END}\\n`;';
  const checklistReplacement = '- Never hide policy violations or skipped checks.\\n${renderUpdateGuidance(data)}\\n${MARKER_END}\\n`;';
  if (!srcText.includes(checklistReplacement)) {
    if (!srcText.includes(checklistAnchor)) {
      console.error('✗ final checklist anchor not found — inspect src/cli.mjs before building');
      process.exit(1);
    }
    srcText = srcText.replace(checklistAnchor, checklistReplacement);
  }

  return srcText;
}

// Ensure dist/ exists. copyFileSync would fail otherwise.
mkdirSync(dirname(distPath), { recursive: true });

// Step 1: read package.json and the source file.
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
let srcText = readFileSync(srcPath, 'utf8');

const before = srcText.match(VERSION_REGEX);
if (!before) {
  console.error(`✗ src/cli.mjs has no const VERSION = '...' — was the source refactored?`);
  process.exit(1);
}

// Step 2: rewrite the VERSION constant if it drifted.
if (before[1] !== pkg.version) {
  console.log(`  bumping VERSION: ${before[1]} → ${pkg.version}`);
  srcText = srcText.replace(VERSION_REGEX, `const VERSION = '${pkg.version}'`);
}

// Step 3: apply targeted runtime patches and persist source if needed.
srcText = applyRuntimePatches(srcText);
if (srcText !== readFileSync(srcPath, 'utf8')) {
  writeFileSync(srcPath, srcText);
}

// Step 4: copy to dist and ensure it is executable.
copyFileSync(srcPath, distPath);
const currentMode = statSync(distPath).mode;
if (!(currentMode & 0o111)) {
  chmodSync(distPath, 0o755);
}

console.log(`Built dist/cli.mjs (v${pkg.version})`);
