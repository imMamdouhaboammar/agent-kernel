function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

function displayValue(value) {
  if (Array.isArray(value)) return value.join(', ');
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value ?? '');
}

function metadata(record) {
  const standard = {
    ID: record.id,
    Type: record.type,
    Status: record.status,
    Scope: record.scope,
    Level: record.level,
    Agent: record.agentId,
    Targets: record.targets,
    Tags: record.tags,
    Created: record.createdAt,
    Updated: record.updatedAt,
    Bucket: record.bucket
  };
  const entries = [...Object.entries(standard), ...Object.entries(record.details || {})]
    .filter(([, value]) => value !== undefined && value !== null && displayValue(value).length > 0);
  return `<dl>${entries.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(displayValue(value))}</dd></div>`).join('')}</dl>`;
}

function pendingActions(record) {
  if (!record.validActionId) return '<p class="invalid">Invalid action ID</p>';
  const controls = [
    ['Copy ID', record.id],
    ['Open inbox', 'agent-kernel inbox'],
    ['Approve + publish', `agent-kernel approve ${record.id} --publish`],
    ['Reject', `agent-kernel reject ${record.id}`]
  ];
  return `<div class="actions">${controls.map(([label, command]) => `<button type="button" data-copy="${escapeHtml(command)}">${escapeHtml(label)}</button>`).join('')}</div>`;
}

function recordCard(record, kind) {
  const searchable = [
    record.id, record.type, record.status, record.scope, record.level,
    record.text, record.reason, record.agentId,
    ...(record.tags || []), ...(record.targets || []),
    ...Object.values(record.details || {})
  ].filter(Boolean).map(displayValue).join(' ');
  return `<article class="record" data-search="${escapeHtml(searchable.toLowerCase())}">
    <div class="record-head"><span class="pill">${escapeHtml(record.status || record.type || kind)}</span><code>${escapeHtml(record.id || record.type || 'record')}</code></div>
    ${record.text ? `<p>${escapeHtml(record.text)}</p>` : ''}
    ${record.reason ? `<p class="muted">${escapeHtml(record.reason)}</p>` : ''}
    <details><summary>Metadata</summary>${metadata(record)}</details>
    ${kind === 'pending' ? pendingActions(record) : ''}
  </article>`;
}

export function renderDashboard(data) {
  const navigation = data.sections.map((section) => `<a href="#${escapeHtml(section.id)}">${escapeHtml(section.title)} <span>${section.records.length}</span></a>`).join('');
  const sections = data.sections.map((section) => `<section id="${escapeHtml(section.id)}"><div class="section-title"><h2>${escapeHtml(section.title)}</h2><span>${section.records.length}</span></div><div class="records">${section.records.map((record) => recordCard(record, section.kind)).join('')}</div></section>`).join('');
  const metrics = Object.entries(data.metrics).map(([name, value]) => `<div class="metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(name)}</span></div>`).join('');
  const diagnostic = data.diagnostics.skippedMalformed
    ? `<div class="diagnostic">Skipped malformed local records: ${escapeHtml(data.diagnostics.skippedMalformed)}</div>`
    : '';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<title>Agent Kernel Memory Dashboard</title><style>
:root{color-scheme:dark;--bg:#050505;--panel:#0B0B0B;--border:#2A2A2A;--text:#F4F4F1;--muted:#8E8E88;--accent:#F8F46A}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--text);font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:14px;line-height:1.55}header{position:sticky;top:0;z-index:5;background:rgba(5,5,5,.96);border-bottom:1px solid var(--border)}.top{max-width:1440px;margin:auto;padding:18px 28px;display:flex;gap:18px;align-items:center;justify-content:space-between}.brand h1{font-size:18px;margin:0}.brand p{margin:3px 0 0;color:var(--muted);font-size:12px}.search{width:min(420px,45vw);background:var(--panel);border:1px solid var(--border);color:var(--text);padding:10px 12px;border-radius:8px}main{max-width:1440px;margin:auto;padding:28px;display:grid;grid-template-columns:220px minmax(0,1fr);gap:24px}aside{position:sticky;top:100px;align-self:start;border:1px solid var(--border);background:var(--panel);padding:10px;border-radius:10px}aside a{display:flex;justify-content:space-between;color:var(--muted);text-decoration:none;padding:9px;border-radius:6px}aside a:hover{background:#151515;color:var(--text)}.content{min-width:0}.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:16px}.metric,section,.record,.diagnostic{border:1px solid var(--border);background:var(--panel);border-radius:10px}.metric{padding:16px}.metric strong{display:block;font-size:26px;color:var(--accent)}.metric span{color:var(--muted);text-transform:capitalize}.diagnostic{padding:12px 16px;margin-bottom:18px;color:#ffd18a}.section-title{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid var(--border)}h2{font-size:16px;margin:0}.records{padding:14px;display:grid;gap:12px}.record{padding:16px;background:#090909}.record-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.pill{border:1px solid var(--border);border-radius:999px;padding:3px 8px;color:var(--accent);font-size:11px}.muted,summary,dt{color:var(--muted)}details{margin-top:12px}dl{display:grid;gap:6px;margin:10px 0 0}dl div{display:grid;grid-template-columns:130px 1fr;gap:10px}dt,dd{margin:0;overflow-wrap:anywhere}.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}button{appearance:none;border:1px solid var(--accent);background:transparent;color:var(--accent);padding:8px 10px;border-radius:6px;font:inherit;cursor:pointer}button:hover,button.copied{background:var(--accent);color:#050505}.invalid{color:#ff9c9c}.empty-search{display:none;color:var(--muted);padding:20px;text-align:center}.hidden{display:none!important}footer{color:var(--muted);font-size:12px;margin-top:22px;padding:16px 0;border-top:1px solid var(--border)}section+section{margin-top:18px}@media(max-width:820px){.top{align-items:flex-start;flex-direction:column}.search{width:100%}main{grid-template-columns:1fr;padding:18px}aside{position:static;display:flex;overflow:auto}aside a{white-space:nowrap;gap:8px}.record-head{align-items:flex-start;flex-direction:column}}
</style></head><body>
<header><div class="top"><div class="brand"><h1>Agent Kernel Memory Dashboard</h1><p>Read-only local snapshot · Kernel ${escapeHtml(data.kernelVersion)} · ${escapeHtml(data.homeLabel)}${data.projectName ? ` · ${escapeHtml(data.projectName)}` : ''} · ${escapeHtml(data.generatedAt)}</p></div><input id="dashboard-search" class="search" type="search" placeholder="Filter records" autocomplete="off"></div></header>
<main><aside aria-label="Dashboard sections">${navigation || '<span class="muted">No stored sections</span>'}</aside><div class="content"><div class="metrics">${metrics}</div>${diagnostic}${sections}<p id="empty-search" class="empty-search">No matching records.</p><footer>Static local file. No external assets or network requests. Copy buttons never execute commands.</footer></div></main>
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
