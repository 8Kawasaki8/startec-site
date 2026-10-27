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
<td class="mono">${r.externalRequests.length}</td><td class="mono">${r.consoleErrors.length}</td><td class="mono">${r.overflow ? r.overflow.scrollWidth - r.overflow.innerWidth > 1 ? 'ja' : 'nee' : ''}</td><td class="mono">${kB(r.bytes && r.bytes.total)}</td><td class="mono">${kB(r.bytes && r.bytes.jsGzip)}</td><td class="mono">${r.scene && r.scene.calls != null ? r.scene.calls : ''}</td><td class="mono">${r.scene && r.scene.longTasks != null ? r.scene.longTasks : ''}</td>
<td class="mono">${r.perf ? r.perf.requests : ''}</td><td class="mono">${r.perf && r.perf.h1 && r.perf.h1.firstMs != null ? r.perf.h1.firstMs : ''}</td><td class="mono">${r.perf && r.perf.h1 && r.perf.h1.shift != null ? r.perf.h1.shift : ''}</td><td class="mono">${r.perf ? (r.perf.clsLoad ?? r.perf.cls) : ''}</td></tr>`).join('\n');
  // WP-16: verzoeken, H1 ms (first frame with the H1), H1 px (its move since), CLS
  return `<div class="scroller"><table><thead><tr><th>pagina</th><th>profiel</th><th>modus</th><th>variant</th><th>status</th><th>laad ms</th><th>rAF 3 s</th><th>intervals</th><th>scene</th><th>WebGL</th><th>extern</th><th>console</th><th>overflow</th><th>bytes</th><th>JS gzip</th><th>calls</th><th>lange taken</th><th>verzoeken</th><th>H1 ms</th><th>H1 px</th><th>CLS</th></tr></thead><tbody>${rows}</tbody></table></div>`;
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

/** WP-15: the measured budget behind the hard gates, and what is reported only. */
function budgetSection(rep) {
  const b = rep.budgetInfo;
  if (!b || !b.measuredOn) return `<p>Geen gemeten budget: ${esc(rep.budget || '')}. Alleen de harde grenzen gelden (telefoon 450 kB ruw, lite 90 kB JS gzip-equivalent).</p>`;
  const rows = (b.rows || []).map(r => `<tr><td class="mono">${esc(r.page)}</td><td class="mono">${esc(r.what)}</td><td class="mono">${r.unit ? kB(r.measured) : r.measured}</td><td class="mono">${r.unit ? kB(r.max) : r.max}</td><td>${r.gated ? '<span class="ok">poort</span>' : '<span class="notitie">gemeld</span>'}</td></tr>`).join('');
  const gates = Object.entries(b.gates || {}).map(([k, v]) => `${esc(k)} ${v ? 'aan' : 'uit'}`).join(', ');
  return `<p>Gemeten op commit <code>${esc(b.measuredOn.slice(0, 10))}</code> (${esc(b.measuredAt || '')}${b.workingTreeDirty ? ', werkmap met wijzigingen' : ''}); plafond = meting + ${Math.round((b.marginBytes || 0) * 100)} % voor bytes en + ${Math.round((b.marginCalls || 0) * 100)} % voor draw calls, nooit boven ${kB(b.phoneRawBytesMax)} ruw op de telefoon of ${kB(b.jsGzipLiteMax)} JS in lite. Poorten: ${gates}. Gemeld en niet bewaakt: het desktop- en tabletgewicht met Three.js en het aantal lange taken onder SwiftShader (kolommen 'bytes' en 'lange taken' in de matrix); de echte GPU-controle is de stap met ?debug=1 in docs/CHECKLIST-SAKI.md.</p>
<details><summary>Plafonds per pagina (${(b.rows || []).length})</summary><div><div class="scroller"><table><thead><tr><th>pagina</th><th>wat</th><th>gemeten</th><th>plafond</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div></details>`;
}

/** WP-19: the accessibility pass (contrast, names, headings, Tab traversal, dialog, zoom, motion) per page x profile. */
function a11ySection(a) {
  if (!a) return '<p>De toegankelijkheidscontrole is in deze run overgeslagen (--no-a11y).</p>';
  const runs = a.runs || [], lim = a.limits || {};
  const rows = runs.map(r => {
    const t = r.tab || {}, z = r.zoom, d = r.dialog, iss = r.issues || [];
    const n = (check) => iss.filter(i => i.check === check).length;
    return `<tr><td class="mono">${esc(r.page)}</td><td class="mono">${esc(r.profile)}</td><td class="${r.fails ? 'fout' : r.notices ? 'bekend' : 'ok'}">${r.fails ? 'fout' : r.notices ? 'notitie' : 'ok'}</td>
<td class="mono">${r.audit ? `${r.audit.contrastFails}/${r.audit.pairs}` : '-'}</td><td class="mono">${n('name')}</td><td class="mono">${r.audit ? r.audit.headings.length : '-'}</td><td class="mono">${t.expected != null ? `${t.reached}/${t.expected}${t.trap ? ' val' : ''}` : '-'}</td><td class="mono">${n('focus')}</td>
<td class="mono">${d ? (d.issues && d.issues.length ? `${d.issues.length} punt(en)` : 'ok') : '-'}</td><td class="mono">${z ? (z.overflow ? `overflow ${z.sw}>${z.vw}` : z.clipped && z.clipped.length ? `${z.clipped.length} afgesneden` : 'ok') : '-'}</td><td class="mono">${r.motion ? r.motion.length : '-'}</td><td class="mono">${r.fails}</td><td class="mono">${r.notices}</td></tr>`;
  }).join('\n');
  const list = runs.filter(r => (r.issues || []).length).map(r => `<details${r.fails ? ' open' : ''}><summary><span class="${r.fails ? 'fout' : 'bekend'}">${r.fails ? 'fout' : 'notitie'}</span> <code>a11y ${esc(r.page)} [${esc(r.profile)}]</code></summary><div><ul>${r.issues.map(i => `<li><span class="${sev[i.severity]}">${sev[i.severity]}</span> <code>${esc(i.check)}</code> ${esc(i.text)}</li>`).join('')}</ul></div></details>`).join('\n');
  return `<p>${runs.length} runs (elke STS-pagina op desktop en telefoon, modus gl, na een scrollpas): ${a.fails} fout(en), ${a.notices} notitie(s). Alleen contrast (4,5:1, of 3:1 voor grote tekst, over de samengestelde achtergrond) en een ontbrekende toegankelijke naam zijn een fout; koppen, landmarks, formulieren, live-gebieden, de Tab-doorloop (elk tabbaar element bereikt, met ring), het blad als dialoog (focusval, Escape, focus terug), ${lim.zoom ? `200 % zoom (${lim.zoom.width}x${lim.zoom.height} px, geen horizontale scroll)` : 'zoom'} en minder beweging (niets boven ${lim.motionMs || 200} ms) zijn notities.${a.skipped && a.skipped.length ? ` Overgeslagen: ${esc(a.skipped.join('; '))}.` : ''}</p>
<div class="scroller"><table><thead><tr><th>pagina</th><th>profiel</th><th>status</th><th>contrast fout/paren</th><th>namen</th><th>koppen</th><th>Tab bereikt</th><th>ring</th><th>dialoog</th><th>zoom 200 %</th><th>beweging</th><th>fouten</th><th>notities</th></tr></thead><tbody>${rows}</tbody></table></div>
${list}`;
}

/** WP-26: the robustness pass (no-JS, dead modules, fonts, deep links, 404 under <base>, print, feature audit); append-only. */
function robustSection(r) {
  if (!r) return '<p>De robuustheidscontrole is in deze run overgeslagen (--no-robust).</p>';
  const iss = r.issues || [], fails = iss.filter(i => i.severity === 'fail');
  const counts = {};
  for (const i of iss) counts[i.check] = (counts[i.check] || 0) + 1;
  const prints = r.print && r.print.cases ? Object.entries(r.print.cases).map(([k, c]) => `<li><code>${esc(k)}</code>: ${c.pdf ? `${c.pdf.pages} pagina('s) ${c.pdf.boxes.map(b => `${Math.round(b.w / 72 * 25.4)}x${Math.round(b.h / 72 * 25.4)} mm`).join(', ')}` : 'geen PDF'}; <code>.qa/${esc(c.shot)}</code>, <code>.qa/${esc(c.pdfFile)}</code></li>`).join('') : '';
  return `<p>${(r.nojs || []).length} runs zonder JavaScript, ${(r.modules || []).length} runs met één geblokkeerd script, ${(r.fonts || []).length} runs zonder lettertypen, ${r.links ? r.links.targets : 0} ankers op desktop en telefoon, 404.html op een diep pad en ${r.print && r.print.cases ? Object.keys(r.print.cases).length : 0} afdrukken van gereedschap.html: ${fails.length} fout(en), ${iss.length - fails.length} notitie(s). Alleen een onopgevangen fout of een lege pagina (geen H1, geen tekst) is een fout; de rest is een notitie.${Object.keys(counts).length ? ` Per controle: ${esc(Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', '))}.` : ''}</p>
${prints ? `<details><summary>Afdrukken (PDF per afdruk, @page uit print.css)</summary><div><ul>${prints}</ul></div></details>` : ''}
${iss.length ? `<details${fails.length ? ' open' : ''}><summary><span class="${fails.length ? 'fout' : 'bekend'}">${iss.length} bevindingen</span></summary><div><ul>${iss.map(i => `<li><span class="${sev[i.severity]}">${sev[i.severity]}</span> <code>${esc(i.check)}</code> ${esc(i.text)}</li>`).join('')}</ul></div></details>` : '<p>Geen bevindingen.</p>'}
${r.audit ? `<details><summary>Kenmerken nieuwer dan Safari 15.4 / Chrome 100 (${r.audit.length})</summary><div><div class="scroller"><table><thead><tr><th>soort</th><th>kenmerk</th><th>sinds</th><th>waar</th><th>terugval</th></tr></thead><tbody>${r.audit.map(a => `<tr><td class="mono">${esc(a.kind)}</td><td class="mono">${esc(a.id)}</td><td>${esc(a.since)}</td><td>${esc(a.where.join(', ') || 'nergens')}</td><td>${esc(a.how)}</td></tr>`).join('')}</tbody></table></div></div></details>` : ''}`;
}

/** WP-15: the screenshot set of a --shots run (gl and gl-swift, desktop and phone), kept in .qa/shots/. */
function shotsSection(runs) {
  const shots = (runs || []).filter(r => r.shot);
  if (!shots.length) return '<p>Geen schermafbeeldingen in deze run (draai met --shots; ze komen in .qa/shots/ en blijven buiten git).</p>';
  return `<p>${shots.length} schermafbeeldingen in <code>.qa/shots/</code> (niet in git; bekijk ze lokaal na de run):</p><details><summary>Lijst</summary><div><ul>${shots.map(r => `<li><code>${esc(r.shot)}</code> ${esc(runLabel(r))}</li>`).join('')}</ul></div></details>`;
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
<p>Elke pagina in docs/ getest in Chromium zonder GPU, op telefoon, tablet en desktop, plus de toegankelijkheidscontrole op desktop en telefoon. Bekende punten dragen het werkpakket dat ze oplost en blokkeren niet; fouten wel.</p>
<span class="status ${green ? 'green' : 'red'}">${green ? (rep.matrix && (rep.matrix.quick || rep.matrix.partial) ? 'GROEN, maar onvolledig: niet publiceren' : 'GROEN: klaar om te publiceren') : 'ROOD: niet publiceren'}</span>
<div class="meta">
<div><span class="label">runs</span><strong>${s.runs}</strong></div>
<div><span class="label">in orde</span><strong class="ok">${s.pass}</strong></div>
<div><span class="label">met bekende punten</span><strong class="bekend">${s.known}</strong></div>
<div><span class="label">fout</span><strong class="${s.fail ? 'fout' : ''}">${s.fail}</strong></div>
<div><span class="label">lintfouten</span><strong class="${s.lintFails ? 'fout' : ''}">${s.lintFails}</strong></div>
<div><span class="label">toegankelijkheid</span><strong class="${s.a11yFails ? 'fout' : ''}">${s.a11yFails == null ? '-' : `${s.a11yFails} fout, ${s.a11yNotices} notitie`}</strong></div>
<div><span class="label">robuustheid</span><strong class="${s.robustFails ? 'fout' : ''}">${s.robustFails == null ? '-' : `${s.robustFails} fout, ${s.robustNotices} notitie`}</strong></div>
<div><span class="label">duur</span><strong>${Math.round((rep.durationMs || 0) / 1000)} s</strong></div>
</div>
<p style="margin-top:16px;font-size:14px">Gegenereerd ${esc(rep.generated)} · commit <code>${esc((rep.commit || '').slice(0, 10) || 'onbekend')}</code> op <code>${esc(rep.branch || '?')}</code> · Node ${esc(rep.node)} · Playwright ${esc(rep.playwright)} · budget: ${esc(rep.budget)} · woordenlijst: ${esc(rep.woordenlijst)}${rep.dirty ? ` · <strong>werkmap met wijzigingen tegenover die commit (${rep.dirtyFiles || '?'} bestanden): dit rapport beschrijft de werkmap, niet de commit</strong>` : ''}${rep.matrix && rep.matrix.quick ? ' · <strong>quick-run, geen volledige matrix</strong>' : rep.matrix && rep.matrix.partial ? ' · <strong>deelrun, geen volledige matrix</strong>' : ''}</p>
${rep.notices && rep.notices.length ? `<h2>Notities</h2><ul style="padding-left:18px;color:var(--ink2);font-size:14px">${rep.notices.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
<h2>Bekende punten en wie ze oplost</h2>
${rep.known && rep.known.length ? `<div class="scroller"><table><thead><tr><th>werkpakket</th><th>wat</th><th>aantal</th></tr></thead><tbody>${rep.known.map(k => `<tr><td><span class="wp">${esc(k.wp)}</span></td><td>${esc(k.note)}</td><td class="mono">${k.count}</td></tr>`).join('')}</tbody></table></div>` : '<p>Geen bekende punten meer.</p>'}
<h2>Budget</h2>
${budgetSection(rep)}
<h2>Matrix</h2>
${matrixTable(rep.runs || [])}
<h2>Schermafbeeldingen</h2>
${shotsSection(rep.runs)}
<h2>Bevindingen per run</h2>
${runDetails(rep.runs || []) || '<p>Geen bevindingen.</p>'}
<h2>Toegankelijkheid</h2>
${a11ySection(rep.a11y)}
<h2>Robuustheid</h2>
${robustSection(rep.robust)}
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
