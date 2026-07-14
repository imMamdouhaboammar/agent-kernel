#!/usr/bin/env node
import childProcess from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const VERSION = String(pkg.version || '0.0.0');
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;
const SECRET_PATTERNS = [
  /OPENAI_API_KEY\s*=\s*["'][^"']+["']/gi,
  /ANTHROPIC_API_KEY\s*=\s*["'][^"']+["']/gi,
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*["'][^"']+["']/gi,
  /AIza[0-9A-Za-z\-_]{35}/g,
  /sk-[A-Za-z0-9]{20,}/g,
  /ghp_[A-Za-z0-9]{20,}/g,
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /xox[abposr]-[A-Za-z0-9-]{10,}/g
];
const SENSITIVE_KEY = /^(token|password|secret|credential|authorization|cookie|api.?key|private.?key)$/i;
const ALLOWED_FLAGS = new Set(['out', 'project', 'open', 'no-open', 'json', 'help']);

function kernelHome() {
  return process.env.AGENT_KERNEL_HOME || path.join(os.homedir(), '.agent-kernel');
}

function paths() {
  const home = kernelHome();
  return {
    home,
    memories: path.join(home, 'source', 'memories'),
    pending: path.join(home, 'inbox', 'pending'),
    reports: path.join(home, 'reports'),
    audit: path.join(home, 'logs', 'audit.jsonl')
  };
}

function nowIso() {
  return new Date().toISOString();
}

function exists(filePath) {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function parseFlags(argv) {
  const flags = { _: [] };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg.startsWith('--')) {
      flags._.push(arg);
      continue;
    }
    const raw = arg.slice(2);
    const equals = raw.indexOf('=');
    const name = equals >= 0 ? raw.slice(0, equals) : raw;
    if (!ALLOWED_FLAGS.has(name)) throw new Error(`Unknown dashboard flag: --${name}`);
    if (Object.hasOwn(flags, name)) throw new Error(`Duplicate flag: --${name}`);
    if (equals >= 0) {
      flags[name] = raw.slice(equals + 1);
      continue;
    }
    const next = argv[index + 1];
    if (['out', 'project'].includes(name)) {
      if (!next || next.startsWith('--')) throw new Error(`Flag --${name} requires a value.`);
      flags[name] = next;
      index++;
    } else {
      flags[name] = true;
    }
  }
  if (flags._.length) throw new Error(`Unexpected dashboard argument: ${flags._[0]}`);
  return flags;
}

function enabled(value) {
  return value === true || String(value || '').toLowerCase() === 'true' || value === '1';
}

function redactText(value) {
  let text = String(value ?? '');
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    text = text.replace(pattern, '[REDACTED_SECRET]');
  }
  return text;
}

function sanitize(value, key = '') {
  if (SENSITIVE_KEY.test(key)) return '[REDACTED_SECRET]';
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map((item) => sanitize(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, sanitize(childValue, childKey)]));
  }
  return value;
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function readJsonDirectory(dir) {
  if (!exists(dir)) return [];
  return fs.readdirSync(dir).sort()
    .filter((name) => name.endsWith('.json'))
    .map((name) => readJson(path.join(dir, name), null))
    .filter(Boolean);
}

function memoryRecords() {
  if (!exists(paths().memories)) return [];
  const records = [];
  for (const name of fs.readdirSync(paths().memories).sort()) {
    if (!name.endsWith('.json')) continue;
    const bucket = name.slice(0, -5);
    const values = readJson(path.join(paths().memories, name), []);
    if (!Array.isArray(values)) continue;
    for (const value of values) records.push({ ...sanitize(value), bucket });
  }
  return records;
}

function proposalRecord(value) {
  const item = sanitize(value || {});
  return {
    id: String(item.id || ''),
    type: String(item.type || 'proposal'),
    status: String(item.status || 'pending'),
    scope: String(item.scope || ''),
    level: String(item.level || ''),
    text: String(item.text || item.summary || item.title || ''),
    reason: String(item.reason || ''),
    targets: Array.isArray(item.targets) ? item.targets.map(String) : [],
    tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
    agentId: String(item.source?.proposedBy || item.source?.agentId || item.agentId || ''),
    createdAt: String(item.createdAt || ''),
    validActionId: SAFE_ID.test(String(item.id || ''))
  };
}

function snapshot() {
  const pending = readJsonDirectory(paths().pending).map(proposalRecord);
  const memories = memoryRecords();
  const rules = memories.filter((item) => item.type === 'rule');
  const sections = [];
  if (pending.length) sections.push({ id: 'pending', title: 'Pending review', records: pending, kind: 'pending' });
  if (memories.length) sections.push({ id: 'memories', title: 'Durable memories', records: memories, kind: 'memory' });
  if (rules.length) sections.push({ id: 'rules', title: 'Rules', records: rules, kind: 'memory' });
  return sanitize({
    generatedAt: nowIso(),
    kernelVersion: VERSION,
    homeLabel: process.env.AGENT_KERNEL_HOME ? 'AGENT_KERNEL_HOME' : '~/.agent-kernel',
    metrics: {
      pending: pending.length,
      memories: memories.length,
      rules: rules.length
    },
    sections
  });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));
}

function metadata(record) {
  const entries = [
    ['ID', record.id],
    ['Type', record.type],
    ['Status', record.status],
    ['Scope', record.scope],
    ['Level', record.level],
    ['Agent', record.agentId],
    ['Targets', (record.targets || []).join(', ')],
    ['Tags', (record.tags || []).join(', ')],
    ['Created', record.createdAt],
    ['Bucket', record.bucket]
  ].filter(([, value]) => value !== undefined && value !== null && String(value).length > 0);
  return `<dl>${entries.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>`;
}

function pendingActions(record) {
  if (!record.validActionId) return '<p class="invalid">Invalid action ID</p>';
  const id = record.id;
  const controls = [
    ['Copy ID', id],
    ['Open inbox', 'agent-kernel inbox'],
    ['Approve + publish', `agent-kernel approve ${id} --publish`],
    ['Reject', `agent-kernel reject ${id}`]
  ];
  return `<div class="actions">${controls.map(([label, command]) => `<button type="button" data-copy="${escapeHtml(command)}">${escapeHtml(label)}</button>`).join('')}</div>`;
}

function recordCard(record, kind) {
  const searchable = [record.id, record.type, record.status, record.scope, record.level, record.text, record.reason, ...(record.tags || []), ...(record.targets || [])].filter(Boolean).join(' ');
  return `<article class="record" data-search="${escapeHtml(searchable.toLowerCase())}">
    <div class="record-head"><span class="pill">${escapeHtml(record.status || record.type || kind)}</span><code>${escapeHtml(record.id || record.type || 'record')}</code></div>
    ${record.text ? `<p>${escapeHtml(record.text)}</p>` : ''}
    ${record.reason ? `<p class="muted">${escapeHtml(record.reason)}</p>` : ''}
    <details><summary>Metadata</summary>${metadata(record)}</details>
    ${kind === 'pending' ? pendingActions(record) : ''}
  </article>`;
}

function renderDashboard(data) {
  const navigation = data.sections.map((section) => `<a href="#${escapeHtml(section.id)}">${escapeHtml(section.title)} <span>${section.records.length}</span></a>`).join('');
  const sections = data.sections.map((section) => `<section id="${escapeHtml(section.id)}"><div class="section-title"><h2>${escapeHtml(section.title)}</h2><span>${section.records.length}</span></div><div class="records">${section.records.map((record) => recordCard(record, section.kind)).join('')}</div></section>`).join('');
  const metrics = Object.entries(data.metrics).map(([name, value]) => `<div class="metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(name)}</span></div>`).join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Agent Kernel Memory Dashboard</title><style>
:root{color-scheme:dark;--bg:#050505;--panel:#0B0B0B;--border:#2A2A2A;--text:#F4F4F1;--muted:#8E8E88;--accent:#F8F46A}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--text);font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:14px;line-height:1.55}header{position:sticky;top:0;z-index:5;background:rgba(5,5,5,.96);border-bottom:1px solid var(--border)}.top{max-width:1440px;margin:auto;padding:18px 28px;display:flex;gap:18px;align-items:center;justify-content:space-between}.brand h1{font-size:18px;margin:0}.brand p{margin:3px 0 0;color:var(--muted);font-size:12px}.search{width:min(420px,45vw);background:var(--panel);border:1px solid var(--border);color:var(--text);padding:10px 12px;border-radius:8px}main{max-width:1440px;margin:auto;padding:28px;display:grid;grid-template-columns:220px minmax(0,1fr);gap:24px}aside{position:sticky;top:100px;align-self:start;border:1px solid var(--border);background:var(--panel);padding:10px;border-radius:10px}aside a{display:flex;justify-content:space-between;color:var(--muted);text-decoration:none;padding:9px;border-radius:6px}aside a:hover{background:#151515;color:var(--text)}.content{min-width:0}.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:24px}.metric,section,.record{border:1px solid var(--border);background:var(--panel);border-radius:10px}.metric{padding:16px}.metric strong{display:block;font-size:26px;color:var(--accent)}.metric span{color:var(--muted);text-transform:capitalize}.section-title{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid var(--border)}h2{font-size:16px;margin:0}.records{padding:14px;display:grid;gap:12px}.record{padding:16px;background:#090909}.record-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.pill{border:1px solid var(--border);border-radius:999px;padding:3px 8px;color:var(--accent);font-size:11px}.muted,summary,dt{color:var(--muted)}details{margin-top:12px}dl{display:grid;gap:6px;margin:10px 0 0}dl div{display:grid;grid-template-columns:100px 1fr;gap:10px}dt,dd{margin:0}.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}button{appearance:none;border:1px solid var(--accent);background:transparent;color:var(--accent);padding:8px 10px;border-radius:6px;font:inherit;cursor:pointer}button:hover,button.copied{background:var(--accent);color:#050505}.invalid{color:#ff9c9c}.empty-search{display:none;color:var(--muted);padding:20px;text-align:center}.hidden{display:none!important}footer{color:var(--muted);font-size:12px;margin-top:22px;padding:16px 0;border-top:1px solid var(--border)}@media(max-width:820px){.top{align-items:flex-start;flex-direction:column}.search{width:100%}main{grid-template-columns:1fr;padding:18px}aside{position:static;display:flex;overflow:auto}aside a{white-space:nowrap;gap:8px}.record-head{align-items:flex-start;flex-direction:column}}
</style></head><body>
<header><div class="top"><div class="brand"><h1>Agent Kernel Memory Dashboard</h1><p>Read-only local snapshot · Kernel ${escapeHtml(data.kernelVersion)} · ${escapeHtml(data.homeLabel)} · ${escapeHtml(data.generatedAt)}</p></div><input id="dashboard-search" class="search" type="search" placeholder="Filter records" autocomplete="off"></div></header>
<main><aside aria-label="Dashboard sections">${navigation || '<span class="muted">No stored sections</span>'}</aside><div class="content"><div class="metrics">${metrics}</div>${sections}<p id="empty-search" class="empty-search">No matching records.</p><footer>Static local file. No external assets or network requests. Copy buttons never execute commands.</footer></div></main>
<script>
(function(){
  const search=document.getElementById('dashboard-search');
  const records=[...document.querySelectorAll('.record')];
  const empty=document.getElementById('empty-search');
  search.addEventListener('input',function(){const query=search.value.trim().toLowerCase();let visible=0;for(const record of records){const show=!query||record.dataset.search.includes(query);record.classList.toggle('hidden',!show);if(show)visible++;}empty.style.display=records.length&&visible===0?'block':'none';});
  async function copyText(text){if(navigator.clipboard&&navigator.clipboard.writeText){await navigator.clipboard.writeText(text);return;}const area=document.createElement('textarea');area.value=text;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();document.execCommand('copy');area.remove();}
  document.addEventListener('click',async function(event){const button=event.target.closest('[data-copy]');if(!button)return;const original=button.textContent;try{await copyText(button.dataset.copy);button.textContent='Copied';button.classList.add('copied');}catch{button.textContent='Copy failed';}setTimeout(function(){button.textContent=original;button.classList.remove('copied');},1200);});
})();
</script></body></html>`;
}

function ensureSafeTarget(target) {
  const resolved = path.resolve(target);
  if (exists(resolved)) {
    const stat = fs.lstatSync(resolved);
    if (stat.isSymbolicLink()) throw new Error(`Dashboard output cannot be a symbolic link: ${resolved}`);
    if (!stat.isFile()) throw new Error(`Dashboard output must be a regular file: ${resolved}`);
  }
  let current = path.dirname(resolved);
  const missing = [];
  while (!exists(current)) {
    missing.push(current);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  while (current && current !== path.dirname(current)) {
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error(`Dashboard output parent cannot be symbolic: ${current}`);
    current = path.dirname(current);
  }
  for (const dir of missing.reverse()) fs.mkdirSync(dir);
  return resolved;
}

function writeAtomic(target, content) {
  const temporary = `${target}.tmp-${process.pid}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  try {
    fs.writeFileSync(temporary, content, 'utf8');
    fs.renameSync(temporary, target);
  } catch (error) {
    try {
      fs.rmSync(temporary, { force: true });
    } catch {}
    throw error;
  }
}

function browserPrefix() {
  if (!process.env.AGENT_KERNEL_BROWSER_ARGS_JSON) return [];
  let parsed;
  try {
    parsed = JSON.parse(process.env.AGENT_KERNEL_BROWSER_ARGS_JSON);
  } catch {
    throw new Error('AGENT_KERNEL_BROWSER_ARGS_JSON must contain a JSON array.');
  }
  if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== 'string' || value.length > 1000)) {
    throw new Error('AGENT_KERNEL_BROWSER_ARGS_JSON must contain a bounded string array.');
  }
  return parsed;
}

function browserInvocation(filePath) {
  if (process.env.AGENT_KERNEL_BROWSER_BIN) {
    return { command: process.env.AGENT_KERNEL_BROWSER_BIN, args: [...browserPrefix(), filePath], label: 'configured' };
  }
  if (process.platform === 'darwin') return { command: 'open', args: [filePath], label: 'open' };
  if (process.platform === 'win32') return { command: 'rundll32.exe', args: ['url.dll,FileProtocolHandler', pathToFileURL(filePath).href], label: 'rundll32' };
  return { command: 'xdg-open', args: [filePath], label: 'xdg-open' };
}

function openDashboard(filePath) {
  const invocation = browserInvocation(filePath);
  const result = childProcess.spawnSync(invocation.command, invocation.args, {
    cwd: process.cwd(),
    env: process.env,
    shell: false,
    stdio: 'ignore',
    timeout: 5000
  });
  if (result.error) {
    const category = result.error.code === 'ENOENT' ? 'browser-not-found' : result.error.code === 'ETIMEDOUT' ? 'browser-timeout' : 'browser-error';
    return { opened: false, browser: invocation.label, error: category };
  }
  if (result.status !== 0) return { opened: false, browser: invocation.label, error: 'browser-exit' };
  return { opened: true, browser: invocation.label, error: null };
}

function audit(result) {
  fs.mkdirSync(path.dirname(paths().audit), { recursive: true });
  const record = sanitize({
    id: `audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    timestamp: nowIso(),
    actor: 'user',
    operation: 'dashboard.generate',
    targetType: 'dashboard',
    targetId: path.basename(result.path),
    summary: 'Generated read-only static memory dashboard',
    metadata: { opened: result.opened, browser: result.browser, browserError: result.browserError, sections: result.sections.length }
  });
  fs.appendFileSync(paths().audit, JSON.stringify(record) + '\n');
}

function printJson(value) {
  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}

function usage() {
  process.stdout.write(`agent-kernel dashboard ${VERSION}\n\nUsage:\n  agent-kernel dashboard [--out file.html] [--project path] [--no-open|--open] [--json]\n`);
}

function main() {
  const flags = parseFlags(process.argv.slice(2));
  if (enabled(flags.help)) return usage();
  if (enabled(flags.open) && enabled(flags['no-open'])) throw new Error('Flags --open and --no-open cannot be used together.');
  const output = ensureSafeTarget(flags.out || path.join(paths().reports, 'dashboard.html'));
  const data = snapshot();
  const html = redactText(renderDashboard(data));
  writeAtomic(output, html);
  const shouldOpen = enabled(flags.open) || (!enabled(flags.json) && !enabled(flags['no-open']));
  const opened = shouldOpen ? openDashboard(output) : { opened: false, browser: null, error: null };
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
  audit(result);
  if (enabled(flags.json)) return printJson(result);
  process.stdout.write(`Generated static dashboard: ${output}\n`);
  if (result.opened) process.stdout.write(`Opened in browser: ${result.browser}\n`);
  else if (result.browserError) process.stdout.write(`Browser did not open: ${result.browserError}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error?.message || String(error)}\n`);
  process.exitCode = 1;
}
