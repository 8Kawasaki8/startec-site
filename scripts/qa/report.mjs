// Renders .qa/report.json as a static page, docs/qa-report.html. No external resources, no scripts.
import { writeFileSync } from 'node:fs';
import { runLabel } from './profiles.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sev = { pass: 'ok', known: 'bekend', fail: 'fout', notice: 'notitie' };
const kB = (n) => n == null ? '' : `${Math.round(n / 1024)} kB`;

const CSS = `
:root{--bg:#06080F;--bg2:#0B0F1A;--ink:#F2F5FF;--ink2:rgba(242,245,255,.70);--ink3:rgba(242,245,255,.44);--line:rgba(242,245,255,.12);--cyan:#36E8FF;--violet:#8A6BFF;--rood:#FF6B6B;--groen:#5BE39B;--amber:#F5C76B;color-scheme:dark}
*{box-sizing:border-box;margin:0;padding:0}
html{background:var(--bg)}
body{background:var(--bg);color:var(--ink);font:400 16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:24px 16px 64px;max-width:1200px;margin:0 auto;overflow-x:hidden}
h1{font-size:clamp(1.5rem,3vw,2.2rem);line-height:1.15;letter-spacing:-.01em}
h2{font-size:1.15rem;margin:40px 0 12px;color:var(--ink)}
p{max-width:70ch;color:var(--ink2)}
.label{font:500 11px/1.3 ui-monospace,Consolas,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--ink3)}
.status{display:inline-block;margin-top:14px;padding:8px 14px;border:1px solid var(--line);border-radius:999px;font-weight:600}
.status.green{color:var(--groen);border-color:rgba(91,227,155,.4)}
.status.red{color:var(--rood);border-color:rgba(255,107,107,.45)}
.meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-top:22px}
.meta div{padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:var(--bg2)}
.meta strong{display:block;font-size:1.3rem;font-weight:600}
.scroller{overflow:auto;border:1px solid var(--line);border-radius:12px;background:var(--bg2)}
table{border-collapse:collapse;width:100%;min-width:640px;font-size:14px}
th,td{text-align:left;padding:8px 12px;border-bottom:1px solid var(--line);vertical-align:top}
th{font:500 11px/1.3 ui-monospace,Consolas,monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--ink3);white-space:nowrap}
td.mono{font:400 13px ui-monospace,Consolas,monospace;white-space:nowrap}
.ok{color:var(--groen)}.bekend{color:var(--amber)}.fout{color:var(--rood)}.notitie{color:var(--ink3)}
details{border:1px solid var(--line);border-radius:12px;margin-top:8px;background:var(--bg2)}
summary{cursor:pointer;padding:12px 16px;min-height:44px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
summary:focus-visible{outline:2px solid var(--cyan);outline-offset:2px}
details > div{padding:4px 16px 16px;color:var(--ink2);font-size:14px}
details ul{padding-left:18px}
details li{margin:4px 0;overflow-wrap:anywhere}
code{font:400 13px ui-monospace,Consolas,monospace;color:var(--ink);overflow-wrap:anywhere}
.wp{font:500 12px ui-monospace,Consolas,monospace;color:var(--violet);border:1px solid rgba(138,107,255,.4);border-radius:6px;padding:1px 6px;white-space:nowrap}
footer{margin-top:48px;color:var(--ink3);font-size:13px}
`;

function matrixTable(runs) {
  const rows = runs.map(r => `<tr><td class="mono">${esc(r.page)}</td><td class="mono">${esc(r.profile)}</td><td class="mono">${esc(r.mode)}</td><td class="mono">${esc(r.variant)}</td>
<td class="${sev[r.status]}">${sev[r.status]}</td><td class="mono">${r.loadMs}</td><td class="mono">${r.rafCount ?? ''}</td><td class="mono">${r.timerCount ? r.timerCount.intervalsActive : ''}</td>
<td class="mono">${r.scene && r.scene.hasCanvas ? esc(r.scene.event) + (r.scene.eventMs != null ? ' ' + r.scene.eventMs + 'ms' : '') : '-'}</td><td class="mono">${r.webgl ? (r.webgl.webgl2 ? 'webgl2' : r.webgl.webgl1 ? 'webgl1' : 'geen') : ''}</td>
<td class="mono">${r.externalRequests.length}</td><td class="mono">${r.consoleErrors.length}</td><td class="mono">${r.overflow ? r.overflow.scrollWidth - r.overflow.innerWidth > 1 ? 'ja' : 'nee' : ''}</td><td class="mono">${kB(r.bytes && r.bytes.total)}</td></tr>`).join('\n');
  return `<div class="scroller"><table><thead><tr><th>pagina</th><th>profiel</th><th>modus</th><th>variant</th><th>status</th><th>laad ms</th><th>rAF 3 s</th><th>intervals</th><th>scene</th><th>WebGL</th><th>extern</th><th>console</th><th>overflow</th><th>bytes</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function runDetails(runs) {
  return runs.filter(r => r.issues.length).map(r => {
    const items = r.issues.map(i => `<li><span class="${sev[i.severity]}">${sev[i.severity]}</span> <code>${esc(i.check)}</code> ${esc(i.text)}${i.wp ? ` <span class="wp">${esc(i.wp)}</span> <span>${esc(i.note)}</span>` : ''}</li>`).join('');
    return `<details${r.status === 'fail' ? ' open' : ''}><summary><span class="${sev[r.status]}">${sev[r.status]}</span> <code>${esc(runLabel(r))}</code></summary><div><ul>${items}</ul>
<p>opslag: sessionStorage [${esc((r.storageKeys && r.storageKeys.session || []).join(', '))}], localStorage [${esc((r.storageKeys && r.storageKeys.local || []).join(', '))}]; timers: ${r.timerCount ? `${r.timerCount.intervalsCreated} intervals aangemaakt, ${r.timerCount.intervalsActive} actief, ${r.timerCount.timeoutsPending} timeouts hangend` : 'niet gemeten'}</p></div></details>`;
  }).join('\n');
}

function lintSection(lint) {
  if (!lint || lint.skipped) return '<p>De statische lints zijn in deze run overgeslagen (--no-lint).</p>';
  const all = [...(lint.css || []), ...(lint.copy || []), ...(lint.lines || []), ...(lint.fixtures || [])];
  if (!all.length) return '<p>Geen bevindingen in lint-css, lint-copy en lint-lines.</p>';
  return `<details${lint.fails ? ' open' : ''}><summary><span class="${lint.fails ? 'fout' : 'bekend'}">${all.length} bevindingen, ${lint.fails} fout(en)</span></summary><div><ul>${all.map(i => `<li><span class="${sev[i.severity]}">${sev[i.severity]}</span> <code>${esc(i.file)}${i.line ? ':' + i.line : ''}</code> ${esc(i.text)}${i.wp ? ` <span class="wp">${esc(i.wp)}</span> ${esc(i.note)}` : ''}</li>`).join('')}</ul></div></details>`;
}

export function renderReport(rep) {
  const s = rep.summary;
  const green = s.status === 'green';
  return `<!doctype html>
<html lang="nl-BE">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>QA-rapport Star.Tec.Solutions</title>
<meta name="description" content="Technisch testrapport van de site: console, externe verzoeken, overflow, animatiebudget, woordenlijst en opslag per pagina, profiel en WebGL-modus.">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#06080F">
<style>${CSS}</style>
</head>
<body data-voice="qa">
<main>
<p class="label">QA-rapport, gegenereerd door scripts/qa/qa.mjs</p>
<h1>Testrapport van de site</h1>
<p>Elke pagina in docs/ getest in Chromium zonder GPU, op telefoon, tablet en desktop. Bekende punten dragen het werkpakket dat ze oplost en blokkeren niet; fouten wel.</p>
<span class="status ${green ? 'green' : 'red'}">${green ? (rep.matrix && (rep.matrix.quick || rep.matrix.partial) ? 'GROEN, maar onvolledig: niet publiceren' : 'GROEN: klaar om te publiceren') : 'ROOD: niet publiceren'}</span>
<div class="meta">
<div><span class="label">runs</span><strong>${s.runs}</strong></div>
<div><span class="label">in orde</span><strong class="ok">${s.pass}</strong></div>
<div><span class="label">met bekende punten</span><strong class="bekend">${s.known}</strong></div>
<div><span class="label">fout</span><strong class="${s.fail ? 'fout' : ''}">${s.fail}</strong></div>
<div><span class="label">lintfouten</span><strong class="${s.lintFails ? 'fout' : ''}">${s.lintFails}</strong></div>
<div><span class="label">duur</span><strong>${Math.round((rep.durationMs || 0) / 1000)} s</strong></div>
</div>
<p style="margin-top:16px;font-size:14px">Gegenereerd ${esc(rep.generated)} · commit <code>${esc((rep.commit || '').slice(0, 10) || 'onbekend')}</code> op <code>${esc(rep.branch || '?')}</code> · Node ${esc(rep.node)} · Playwright ${esc(rep.playwright)} · budget: ${esc(rep.budget)} · woordenlijst: ${esc(rep.woordenlijst)}${rep.matrix && rep.matrix.quick ? ' · <strong>quick-run, geen volledige matrix</strong>' : rep.matrix && rep.matrix.partial ? ' · <strong>deelrun, geen volledige matrix</strong>' : ''}</p>
${rep.notices && rep.notices.length ? `<h2>Notities</h2><ul style="padding-left:18px;color:var(--ink2);font-size:14px">${rep.notices.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
<h2>Bekende punten en wie ze oplost</h2>
${rep.known && rep.known.length ? `<div class="scroller"><table><thead><tr><th>werkpakket</th><th>wat</th><th>aantal</th></tr></thead><tbody>${rep.known.map(k => `<tr><td><span class="wp">${esc(k.wp)}</span></td><td>${esc(k.note)}</td><td class="mono">${k.count}</td></tr>`).join('')}</tbody></table></div>` : '<p>Geen bekende punten meer.</p>'}
<h2>Matrix</h2>
${matrixTable(rep.runs || [])}
<h2>Bevindingen per run</h2>
${runDetails(rep.runs || []) || '<p>Geen bevindingen.</p>'}
<h2>Statische lints</h2>
${lintSection(rep.lint)}
</main>
<footer>Dit rapport bevat geen scripts en laadt niets van buiten. Het wordt bij elke QA-run opnieuw geschreven; de JSON-bron staat in .qa/report.json.</footer>
</body>
</html>
`;
}

export function writeReportHtml(rep, path) {
  writeFileSync(path, renderReport(rep));
}
