#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  DashboardError,
  JSON_REQUESTED,
  RAW_ARGS,
  VERSION,
  appendDashboardAudit,
  browserInvocation,
  dashboardPaths,
  enabled,
  ensureSafeTarget,
  exists,
  openDashboard,
  parseFlags,
  printJson,
  redactLocalPaths,
  redactText,
  writeAtomic
} from './dashboard/common.mjs';
import { renderDashboard } from './dashboard/render.mjs';
import { dashboardSnapshot } from './dashboard/state.mjs';

function usage() {
  process.stdout.write(`agent-kernel dashboard ${VERSION}\n\nUsage:\n  agent-kernel dashboard [--out file.html] [--project path] [--no-open|--open] [--json]\n`);
}

function main(argv) {
  const flags = parseFlags(argv);
  if (enabled(flags.help)) return usage();
  if (enabled(flags.open) && enabled(flags['no-open'])) {
    throw new DashboardError('invalid-arguments', 'Flags --open and --no-open cannot be used together.');
  }

  const projectPath = flags.project ? path.resolve(flags.project) : process.cwd();
  if (!exists(projectPath) || !fs.statSync(projectPath).isDirectory()) {
    throw new DashboardError('invalid-project', `Dashboard project does not exist or is not a directory: ${projectPath}`);
  }

  const outputCandidate = path.resolve(flags.out || path.join(dashboardPaths().reports, 'dashboard.html'));
  const shouldOpen = enabled(flags.open) || (!enabled(flags.json) && !enabled(flags['no-open']));
  const invocation = shouldOpen ? browserInvocation(outputCandidate) : null;
  const output = ensureSafeTarget(outputCandidate);
  const data = dashboardSnapshot(projectPath);
  const html = redactLocalPaths(redactText(renderDashboard(data)), projectPath);
  writeAtomic(output, html);

  const opened = invocation ? openDashboard(invocation) : { opened: false, browser: null, error: null };
  const result = {
    ok: true,
    path: output,
    generatedAt: data.generatedAt,
    opened: opened.opened,
    browser: opened.browser,
    browserError: opened.error,
    externalAssets: false,
    scripts: 'inline-copy-filter-only',
    sections: data.sections.map((section) => section.id)
  };
  appendDashboardAudit(result);

  if (enabled(flags.json)) return printJson(result);
  process.stdout.write(`Generated static dashboard: ${output}\n`);
  if (result.opened) process.stdout.write(`Opened in browser: ${result.browser}\n`);
  else if (result.browserError) process.stdout.write(`Browser did not open: ${result.browserError}\n`);
}

try {
  main(RAW_ARGS);
} catch (error) {
  const category = error instanceof DashboardError ? error.category : 'dashboard-error';
  const message = error instanceof DashboardError ? error.message : 'Unable to generate the static dashboard.';
  if (JSON_REQUESTED) printJson({ ok: false, error: category, message });
  else process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
