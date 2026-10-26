// Doorlichting data check: every number in the findings, callouts and log lines of the four
// fictional businesses must follow from the arrays in docs/assets/js/sim-data.js and sim-data-2.js,
// and every wat-als switch (sim-whatif.js) must derive a counter from the same arrays.
// Usage: node scripts/qa/sim-check.mjs [--json]    exit 1 on the first business that does not add up.
// Conventions (also in the sim-data.js header):
//   calls    missed in the focus hours / (answered + missed) there, rounded to a whole percent
//   search   whole hours h < open[0] or h >= open[1] are 'buiten de uren'; peak = first maximum
//   reviews  unanswered and total from the focus month; score first -> last; the year total
//   web      mobile share of all visits (rounded), total visits, load times and the richtwaarde
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const ROOT = process.cwd();
const JS = (f) => readFileSync(join(ROOT, 'docs', 'assets', 'js', f), 'utf8');
const json = process.argv.includes('--json');

function load() {
  const win = {}; const doc = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} };
  win.document = doc; win.addEventListener = () => {}; win.matchMedia = () => ({ matches: false });
  const ctx = vm.createContext({ window: win, document: doc, console });
  for (const f of ['sim-data.js', 'sim-data-2.js', 'sim-charts.js', 'sim-whatif.js']) vm.runInContext(JS(f), ctx, { filename: f });
  if (!win.SIM_DATA || !win.SIM_WHATIF || !win.SIM_CHARTS) throw new Error('SIM_DATA, SIM_CHARTS of SIM_WHATIF ontbreekt na het laden');
  return win;
}
const sum = (a, from = 0, to = a.length) => a.slice(from, to).reduce((s, v) => s + v, 0);
const nl = (n) => { const s = String(n).split('.'); s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.'); return s.join(','); };
const pct = (part, whole) => Math.round(100 * part / whole);
const norm = (t) => String(t).replace(/[\u00a0\u202f]/g, ' ');   // the copy sets a no-break space before %
const has = (text, needle) => norm(text).includes(norm(needle));
const same = (a, b) => norm(a) === norm(b);

/** Derivable numbers per chart, then the assertions against the copy. */
function checkBusiness(key, b, D, W) {
  const errs = [], ok = (cond, msg) => { if (!cond) errs.push(msg); };
  const F = b.findings || [], L = b.log || {};
  ok(F.length === 4, `${F.length} bevindingen, 4 verwacht`);
  ok((b.advice || []).length === 3, `${(b.advice || []).length} adviezen, 3 verwacht`);
  // chart 1: calls
  const c = b.calls, [a0, a1] = c.focus, missedF = sum(c.missed, a0, a1 + 1), ansF = sum(c.answered, a0, a1 + 1), totF = missedF + ansF;
  const callsPct = pct(missedF, totF), callsAll = sum(c.answered) + sum(c.missed), missedAll = sum(c.missed);
  ok(c.answered.length === c.missed.length, 'calls: answered en missed verschillen in lengte');
  ok(F[0] && same(F[0].value, `${callsPct} %`), `calls: bevinding zegt '${F[0] && F[0].value}', arrays geven ${callsPct} % (${missedF} van ${totF})`);
  ok(same(c.callout.v, `${callsPct} %`), `calls: callout '${c.callout.v}' is niet ${callsPct} %`);
  ok(F[0] && has(F[0].proof, `${missedF} van ${totF}`), `calls: bewijs '${F[0] && F[0].proof}' noemt '${missedF} van ${totF}' niet`);
  ok(has(L.calls[0][1], String(callsAll)) && has(L.calls[0][1], String(missedAll)), `calls: logregel noemt ${callsAll} oproepen en ${missedAll} gemist niet`);
  ok(has(L.calls[1][1], `${callsPct} %`) && has(L.calls[1][1], `${missedF} van ${totF}`), `calls: tweede logregel klopt niet met ${callsPct} % / ${missedF} van ${totF}`);
  ok(has(F[0].title, `${c.from + a0} en ${c.from + a1 + 1} u`) || has(c.callout.t, `${c.from + a0} en ${c.from + a1 + 1} u`), `calls: de focusuren ${c.from + a0}-${c.from + a1 + 1} u staan niet in titel of callout`);
  // chart 2: search
  const s = b.search, outside = s.values.reduce((t, v, h) => t + ((h < s.open[0] || h >= s.open[1]) ? v : 0), 0), total = sum(s.values);
  const searchPct = pct(outside, total), outsideVals = s.values.map((v, h) => (h < s.open[0] || h >= s.open[1]) ? v : -1), peak = outsideVals.indexOf(Math.max(...outsideVals));   // the peak the copy names is the one outside the band
  ok(s.values.length === 24, 'search: geen 24 uren');
  ok(F[1] && same(F[1].value, `${searchPct} %`), `search: bevinding zegt '${F[1] && F[1].value}', arrays geven ${searchPct} % (${outside} van ${total})`);
  ok(same(s.callout.v, `${searchPct} %`), `search: callout '${s.callout.v}' is niet ${searchPct} %`);
  ok(has(s.callout.t, `om ${peak} u`), `search: callout noemt de piek om ${peak} u niet`);
  ok(has(L.search[0][1], nl(total)), `search: logregel noemt ${nl(total)} zoekopdrachten niet`);
  ok(has(L.search[1][1], `${searchPct} %`) && has(L.search[1][1], `om ${peak} u`), `search: tweede logregel klopt niet met ${searchPct} % / piek om ${peak} u`);
  const m2 = F[1] && /(\d+) van (\d+)/.exec(F[1].proof); if (m2) ok(+m2[1] === outside && +m2[2] === total, `search: bewijs '${m2[0]}' is niet ${outside} van ${total}`);
  // chart 3: reviews
  const r = b.reviews, from = r.focus[0], unSince = sum(r.unanswered, from), totSince = sum(r.total, from), year = sum(r.total), first = r.score[0], last = r.score[11];
  ok(r.total.length === 12 && r.unanswered.length === 12 && r.score.length === 12, 'reviews: geen 12 maanden');
  ok(r.total.every((t, i) => t >= r.unanswered[i]), 'reviews: meer onbeantwoord dan reviews in een maand');
  ok(has(L.reviews[0][1], String(year)), `reviews: logregel noemt het jaartotaal ${year} niet`);
  const text3 = `${F[2].title} ${F[2].value} ${F[2].proof} ${r.callout.v} ${r.callout.t} ${L.reviews[1][1]}`;
  for (const m of norm(text3).matchAll(/(\d+) van (?:de )?(\d+)/g)) ok(+m[1] === unSince && +m[2] === totSince, `reviews: '${m[0]}' is niet ${unSince} van de ${totSince}`);
  for (const m of norm(text3).matchAll(/van (\d+) naar (\d+)/g)) ok(+m[1] === r.total[0] && +m[2] === r.total[11], `reviews: '${m[0]}' is niet van ${r.total[0]} naar ${r.total[11]}`);
  for (const m of norm(text3).matchAll(/(\d,\d) → (\d,\d)/g)) ok(m[1] === nl(first) && m[2] === nl(last), `reviews: '${m[0]}' is niet ${nl(first)} → ${nl(last)}`);
  for (const m of norm(text3).matchAll(/(\d+) per maand/g)) ok(+m[1] === r.total[11] || +m[1] === r.total[0], `reviews: '${m[0]}' is noch ${r.total[0]} noch ${r.total[11]}`);
  ok(/\d/.test(F[2].value), 'reviews: lege bevindingswaarde');
  for (const d of F[2].value.match(/\d,\d/g) || []) ok(d === nl(first) || d === nl(last), `reviews: waarde '${d}' is noch de eerste (${nl(first)}) noch de laatste score (${nl(last)})`);
  // chart 4: web
  const w = b.web, mob = sum(w.mobile), desk = sum(w.desktop), visits = mob + desk, share = pct(mob, visits);
  ok(w.mobile.length === 8 && w.desktop.length === 8, 'web: geen 8 weken');
  ok(same(F[3].value, `${nl(w.load.mobile)} s`) || same(F[3].value, `${share} %`), `web: bevinding zegt '${F[3].value}', laadtijd is ${nl(w.load.mobile)} s en het mobiele aandeel ${share} %`);
  ok(w.callout.v === `${nl(w.load.mobile)} s` && has(w.callout.t, `${nl(w.load.ref)} s`), `web: callout klopt niet met ${nl(w.load.mobile)} s / richtwaarde ${nl(w.load.ref)} s`);
  const text4 = `${F[3].title} ${F[3].proof}`;
  for (const m of norm(text4).matchAll(/(\d+) %/g)) ok(+m[1] === share || +m[1] === 100 - share, `web: '${m[0]}' is niet het mobiele aandeel ${share} %`);
  for (const m of text4.matchAll(/([\d.]+) bezoeken/g)) ok(m[1] === nl(visits), `web: '${m[0]}' is niet ${nl(visits)} bezoeken`);
  for (const m of text4.matchAll(/richtwaarde (\d,\d) s/g)) ok(m[1] === nl(w.load.ref), `web: '${m[0]}' is niet ${nl(w.load.ref)} s`);
  ok(has(L.web[0][1], nl(visits)), `web: logregel noemt ${nl(visits)} bezoeken niet`);
  ok(has(L.web[1][1], `${share} %`) && has(L.web[1][1], `${nl(w.load.mobile)} s`) && has(L.web[1][1], `${nl(w.load.desktop)} s`), `web: tweede logregel klopt niet met ${share} % / ${nl(w.load.mobile)} s / ${nl(w.load.desktop)} s`);
  // wat-als: three switches, one rule each, counters from the arrays
  const specs = (D.whatif || {})[key] || [], header = JS('sim-whatif.js').split('(function')[0];
  ok(specs.length === 3, `wat-als: ${specs.length} schakelaars, 3 verwacht`);
  const counters = specs.map((sp, i) => {
    const out = W.derive(b, sp);
    ok(out, `wat-als ${i + 1}: regel '${sp.rule}' onbekend`);
    if (!out) return null;
    ok(new RegExp(`^\\s*${sp.rule}\\b`, 'm').test(header), `wat-als ${i + 1}: regel '${sp.rule}' staat niet in de kop van sim-whatif.js`);
    ok(['calls', 'search', 'reviews'].includes(out.chart), `wat-als ${i + 1}: grafiek '${out.chart}' onbekend`);
    ok(Number.isInteger(out.a) && Number.isInteger(out.b) && out.a >= 0 && out.b >= 0, `wat-als ${i + 1}: teller ${out.a} -> ${out.b} is geen geheel getal`);
    if (i === 0) ok(out.b < out.a, `wat-als 1: ${out.a} -> ${out.b} daalt niet`);
    if (out.chart === 'calls') ok(out.alt.answered.length === c.answered.length && sum(out.alt.answered) + sum(out.alt.missed) === callsAll, 'wat-als: calls_shift verandert het totaal aantal oproepen');
    if (out.alt.values) ok(out.alt.values.length === 24 && out.alt.values.every((v, h) => (h < s.open[0] || h >= s.open[1]) || v === s.values[h]), 'wat-als: search_catch raakt uren binnen de band');
    if (out.alt.unanswered) ok(out.alt.unanswered.every((u, m) => u <= out.alt.total[m]), 'wat-als: meer onbeantwoord dan reviews');
    return `${out.a} -> ${out.b} ${out.what}`;
  });
  // borrowed authority and the old claim never appear in the data
  const blob = JSON.stringify(b);
  ok(!/\b(studies?|rapport(en)?|onderzoek toont)\b/i.test(blob), 'data: studie/rapport/onderzoek toont in een simulatie');
  ok(!/jouw echte oproepen/i.test(blob), "data: 'jouw echte oproepen'");
  return { key, name: b.name, calls: `${callsPct} % (${missedF}/${totF})`, search: `${searchPct} % (${outside}/${total}), piek ${peak} u`, reviews: `${unSince}/${totSince} sinds focus, score ${nl(first)} -> ${nl(last)}`, web: `${share} % mobiel, ${nl(visits)} bezoeken`, counters, errs };
}

const win = load(), D = win.SIM_DATA, W = win.SIM_WHATIF, keys = Object.keys(D.businesses);
const rows = keys.map(k => checkBusiness(k, D.businesses[k], D, W));
const mapErrs = Object.entries(D.sectorMap || {}).filter(([, v]) => !D.businesses[v]).map(([k, v]) => `sectorMap: ${k} -> ${v} bestaat niet`);
const fail = rows.some(r => r.errs.length) || mapErrs.length || keys.length < 4;
if (json) console.log(JSON.stringify({ ok: !fail, rows, mapErrs }, null, 2));
else {
  for (const r of rows) {
    console.log(`${r.errs.length ? 'FOUT ' : 'ok   '}${r.name} (${r.key}): oproepen ${r.calls}; zoek ${r.search}; reviews ${r.reviews}; web ${r.web}`);
    for (const ct of r.counters) console.log(`       wat-als: ${ct}`);
    for (const e of r.errs) console.log(`       - ${e}`);
  }
  for (const e of mapErrs) console.log(`FOUT   ${e}`);
  if (keys.length < 4) console.log(`FOUT   ${keys.length} zaken, 4 verwacht`);
  console.log(fail ? 'SIM-CHECK ROOD' : `SIM-CHECK GROEN: ${keys.length} verzonnen zaken, elke bevinding volgt uit de arrays`);
}
process.exit(fail ? 1 : 0);
