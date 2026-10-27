// Budgets, gates and the list of known violations of the current site.
// classify() turns a raw issue into 'fail', 'known' (named WP fixes it) or 'notice'.
//
// WP-15: the budget is measured, then enforced. `node scripts/qa/budget.mjs --measure` reads a full .qa/report.json
// (raw transfer bytes per page x profile x variant through python3 http.server, gzip-equivalent JS bytes computed
// locally with zlib, draw calls of the landed frame from STSScene.debug.info()) and writes scripts/qa/budget.json:
// every ceiling is the measurement plus the margin (10 % for bytes, 20 % for draw calls), never above the absolute
// caps (phone first load 450 kB raw, 90 kB gzip-equivalent JS in lite), stamped with the commit it was measured on.
// Hard gates (fail): phone raw bytes per page, lite JS per page, draw calls per page on desktop and tablet, rAF rest,
// timers, first viewport, backdrop-filter, strict line limits, the SVG skyline and the placed sign without WebGL.
// Reported, not gated: the desktop and tablet totals with Three.js, long tasks under SwiftShader.
// WP-16 adds, measured by perf.mjs: requests and raw JS bytes per page (ceiling = measured + 10 %, phone and lite),
// Three.js never on the phone or lite route, no font file requested that no text uses, the H1 box still where it was
// painted first (CLS proxy, 1 px) and CLS under 0.1, the H1 in view within h1PaintMaxMs on the routes without Three.js
// (a fixed ceiling: CI timing noise is wider than 10 %; desktop and tablet are reported), og.png and the straat images.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';

/** Measured-then-enforced budgets. budget.json (WP-15) overrides these values and flips gates on. */
export const DEFAULT_BUDGET = {
  rafIdleMax: 0,              // rAF callbacks during 3 s idle (desktop/tablet); phone must have no loop at all
  activeIntervalsMax: 0,      // setInterval without clearInterval after idle
  pendingTimeoutsMax: 2,      // setTimeout still pending after 3 s idle
  phoneRawBytesMax: 450_000,  // phone first load, raw bytes, without Three.js: the absolute cap
  jsGzipLiteMax: 90_000,      // JS per page, gzip-equivalent, in the lite route: the absolute cap
  sceneEventMs: 6000,         // sts:scene-ready or sts:scene-failed must fire within this
  marginBytes: 0.10,          // ceiling = measured raw or gzip bytes + 10 % (also requests and raw JS, WP-16)
  marginCalls: 0.20,          // ceiling = measured draw calls + 20 %
  h1ShiftMaxPx: 1,            // WP-16: the H1's layout box may not move between its first frame and the idle window
  clsMax: 0.1,                // WP-16: cumulative layout shift of the first load (layout-shift entries without input)
  h1PaintMaxMs: 1000,         // WP-16: the H1 has a width within this on the phone and lite routes (fixed ceiling)
  assets: { ogMaxBytes: 150_000, straatMaxBytes: 60_000, straatSize: [800, 500] },   // WP-16: static image gates
  firstViewportWords: { 'index.html': ['Antwerpen', 'voorbeeld', 'onderzoek', 'verkenner', 'Snymis'] },   // the arrival lines (copy-regels.md ch. 11, WP-18)
  // Per-page ceilings, filled by --measure: pages[page][profile + '/' + variant] = { raw, rawMax, jsGzip, jsGzipMax, gated }
  // and pages[page].calls[profile] = { calls, callsMax }. Absent page: only the absolute caps apply, with a notice.
  pages: {},
  measuredOn: null,
  // Gates start off: the numbers are reported and listed as 'known' until the WP that makes them true lands.
  gates: { rafIdle: false, timers: false, bytes: false, firstViewport: false, backdropFilter: false, lineLimitsStrict: false, calls: false, nogl: false,
    requests: false, fonts: false, three: false, cls: false, h1Paint: false, assets: false },
};

/** Pages whose weight is reported but never gated: the harness's own report changes size with every run. */
export const UNGATED_PAGES = new Set(['qa-report.html']);

export function loadBudget(root = process.cwd()) {
  const file = join(root, 'scripts', 'qa', 'budget.json');
  if (!existsSync(file)) return { ...DEFAULT_BUDGET, source: 'standaardwaarden (geen scripts/qa/budget.json: meet met node scripts/qa/budget.mjs --measure)' };
  const data = JSON.parse(readFileSync(file, 'utf8'));
  return { ...DEFAULT_BUDGET, ...data, gates: { ...DEFAULT_BUDGET.gates, ...(data.gates || {}) }, source: 'scripts/qa/budget.json' };
}

/**
 * Known violations of the site as committed today. Each names the work package that removes it.
 * `when(issue, ctx)` decides whether an issue is this known case. Keep entries specific:
 * the broken fixture and new work must still fail. WP-04 removed its own entries (style.css split,
 * backdrop-filter, the motion.js rAF loop, timers, index bytes, 'Data & leads', first viewport,
 * index overflow), WP-02 (the conversion check without STSBericht), WP-11 ('jullie' in the FAQ
 * question, now <details><summary>) and WP-15 (the strict line limits, now a gate) theirs:
 * those checks fail for real from now on. The list is empty on purpose; a new entry needs a work package.
 */
export const KNOWN = [];

/**
 * Decides the severity of an issue.
 * ctx: { root, budget, page }. Gates that are on turn the matching known cases back into failures.
 */
export function classify(issue, ctx) {
  const g = ctx.budget.gates;
  const gated = (issue.check === 'raf' && g.rafIdle) || (issue.check === 'timer' && g.timers) || (issue.check === 'bytes' && g.bytes)
    || (issue.check === 'first-viewport' && g.firstViewport) || (issue.check === 'backdrop-filter' && g.backdropFilter)
    || (issue.check === 'lines-strict' && g.lineLimitsStrict) || (issue.check === 'calls' && g.calls) || (issue.check === 'nogl' && g.nogl)
    || (issue.check === 'requests' && g.requests) || (issue.check === 'font' && g.fonts) || (issue.check === 'three' && g.three)
    || (issue.check === 'cls' && g.cls) || (issue.check === 'h1-paint' && g.h1Paint) || (issue.check === 'assets' && g.assets);
  if (issue.severity === 'notice') return { ...issue, severity: 'notice' };
  if (!gated) {
    for (const k of KNOWN) {
      let hit = false;
      try { hit = k.when(issue, ctx); } catch { hit = false; }
      if (hit) return { ...issue, severity: 'known', wp: k.wp, note: k.note };
    }
  }
  return { ...issue, severity: 'fail' };
}

const kB = (n) => `${Math.round(n / 1024)} kB`;
export const pageKey = (run) => `${run.profile}/${run.variant}`;

/** The measured ceiling for one run, or null when budget.json has none for this page x profile x variant. */
export function pageCeiling(budget, run) {
  const p = budget.pages && budget.pages[run.page];
  if (!p) return null;
  const e = p[pageKey(run)];
  return e ? { ...e, calls: p.calls && p.calls[run.profile] ? p.calls[run.profile] : null } : null;
}

/** Evaluates the measured numbers of one run against the budget; returns raw issues. */
export function budgetIssues(run, budget) {
  const out = [];
  const demo = /^demo\//.test(run.page);
  const ungated = UNGATED_PAGES.has(run.page);
  const ceiling = pageCeiling(budget, run);
  const measured = !!(budget.measuredOn && budget.pages && Object.keys(budget.pages).length);
  if (!demo) {
    if (run.rafCount > budget.rafIdleMax) out.push({ check: 'raf', text: `rAF draait nog: ${run.rafCount} callbacks in 3 s rust (budget ${budget.rafIdleMax})` });
    if (run.timerCount && run.timerCount.intervalsActive > budget.activeIntervalsMax) out.push({ check: 'timer', text: `${run.timerCount.intervalsActive} setInterval zonder clearInterval na rust` });
    if (run.timerCount && run.timerCount.timeoutsPending > budget.pendingTimeoutsMax) out.push({ check: 'timer', text: `${run.timerCount.timeoutsPending} setTimeout nog hangend 3 s na rust (budget ${budget.pendingTimeoutsMax})` });
    if (run.bytes && !ungated) {
      // the absolute caps: phone first load (never Three.js) and JS in the lite route
      if (run.profile === 'phone' && run.bytes.total > budget.phoneRawBytesMax) out.push({ check: 'bytes', text: `telefoon laadt ${kB(run.bytes.total)} ruw (harde grens ${kB(budget.phoneRawBytesMax)})` });
      if (run.variant === 'lite' && run.bytes.jsGzip > budget.jsGzipLiteMax) out.push({ check: 'bytes', text: `lite laadt ${kB(run.bytes.jsGzip)} JS (gzip-equivalent, harde grens ${kB(budget.jsGzipLiteMax)})` });
      // the measured ceilings (+10 %): phone raw bytes in every mode and variant, the lite route everywhere
      if (ceiling && ceiling.gated) {
        if (run.bytes.total > ceiling.rawMax) out.push({ check: 'bytes', text: `${run.profile} ${run.variant}: ${kB(run.bytes.total)} ruw, gemeten ${kB(ceiling.raw)} op ${(budget.measuredOn || '').slice(0, 10)} (plafond ${kB(ceiling.rawMax)} = gemeten + ${Math.round(budget.marginBytes * 100)} %)` });
        if (run.bytes.jsGzip > ceiling.jsGzipMax) out.push({ check: 'bytes', text: `${run.profile} ${run.variant}: ${kB(run.bytes.jsGzip)} JS gzip-equivalent, gemeten ${kB(ceiling.jsGzip)} (plafond ${kB(ceiling.jsGzipMax)})` });
      } else if (measured && !ceiling && (run.profile === 'phone' || run.variant === 'lite')) {
        out.push({ check: 'bytes', severity: 'notice', text: `geen gemeten budget voor ${run.page} ${pageKey(run)}; alleen de harde grenzen gelden (meet opnieuw: node scripts/qa/budget.mjs --measure)` });
      }
    }
    // draw calls of the landed frame, desktop and tablet on the Three.js route: measured + 20 %
    if (run.scene && typeof run.scene.calls === 'number' && run.mode === 'gl' && run.variant === 'default' && run.profile !== 'phone') {
      const c = ceiling && ceiling.calls;
      if (c && run.scene.calls > c.callsMax) out.push({ check: 'calls', text: `${run.scene.calls} draw calls na het landen, gemeten ${c.calls} (plafond ${c.callsMax} = gemeten + ${Math.round(budget.marginCalls * 100)} %)` });
      else if (measured && !c) out.push({ check: 'calls', severity: 'notice', text: `geen gemeten draw calls voor ${run.page} op ${run.profile} (${run.scene.calls} nu); meet opnieuw` });
    }
  }
  if (run.scene && run.scene.hasCanvas && run.mode !== 'nogl' && run.scene.event === 'none') out.push({ check: 'scene', text: `geen sts:scene-ready of sts:scene-failed binnen ${budget.sceneEventMs} ms` });
  if (run.scene && run.scene.hasCanvas && run.mode === 'nogl') {
    if (!run.scene.fallbackVisible) out.push({ check: 'scene', text: '#scene-fallback blijft verborgen zonder WebGL' });
    if (!run.scene.skyline) out.push({ check: 'nogl', text: 'de SVG-skyline in #scene-fallback heeft geen afmetingen zonder WebGL' });
    if (!run.scene.signPlaced) out.push({ check: 'nogl', text: '#sign-dom is niet geplaatst (is-placed) zonder WebGL' });
  }
  if (run.mode !== 'nogl' && run.webgl && run.webgl.available === false && run.page === 'index.html') out.push({ check: 'webgl', text: `WebGL2 ontbreekt in modus ${run.mode}` });
  return out;
}

/** Summarises a classified issue list into a run status. */
export function statusOf(issues) {
  if (issues.some(i => i.severity === 'fail')) return 'fail';
  if (issues.some(i => i.severity === 'known')) return 'known';
  return 'pass';
}

function git(cmd, root) { try { return execSync(`git ${cmd}`, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } }

/**
 * Builds the budget.json content from a full report: per page x profile x variant the largest raw and gzip JS
 * measurement over the GL modes, per page x profile the draw calls of the gl/default run. Demo pages are not
 * STS pages (their own rAF and weight are not gated); qa-report.html is listed but never gated.
 */
export function measureBudget(report, { root = process.cwd(), base = DEFAULT_BUDGET } = {}) {
  if (!report || !Array.isArray(report.runs)) throw new Error('rapport zonder runs');
  if (report.matrix && (report.matrix.quick || report.matrix.partial)) throw new Error('een budget wordt alleen uit een volledige run gemeten (geen --quick, --pages, --profile, --mode of --variant)');
  const pages = {};
  const up = (n) => Math.ceil(n * (1 + base.marginBytes));
  for (const r of report.runs) {
    if (/^demo\//.test(r.page) || !r.bytes) continue;
    const p = pages[r.page] = pages[r.page] || { calls: {} };
    const k = pageKey(r), e = p[k] || { raw: 0, jsGzip: 0 };
    e.raw = Math.max(e.raw, r.bytes.total); e.jsGzip = Math.max(e.jsGzip, r.bytes.jsGzip);
    if (r.perf) {   // WP-16: requests and raw JS of the first load (gated like raw bytes), the H1's first frame (reported)
      e.requests = Math.max(e.requests || 0, r.perf.requests); e.jsRaw = Math.max(e.jsRaw || 0, r.perf.jsRaw);
      if (r.perf.h1 && r.perf.h1.firstMs != null) e.h1Ms = Math.max(e.h1Ms || 0, r.perf.h1.firstMs);
    }
    p[k] = e;
    if (r.scene && typeof r.scene.calls === 'number' && r.mode === 'gl' && r.variant === 'default' && r.profile !== 'phone') {
      const c = p.calls[r.profile] || { calls: 0 };
      c.calls = Math.max(c.calls, r.scene.calls); p.calls[r.profile] = c;
    }
  }
  for (const [page, p] of Object.entries(pages)) {
    for (const [k, e] of Object.entries(p)) {
      // floor, not ceil: 16 measured -> 19 allowed (measured + 3, WP-21), never a free extra call from rounding up
      if (k === 'calls') { for (const c of Object.values(e)) c.callsMax = Math.floor(c.calls * (1 + base.marginCalls)); continue; }
      const [profile, variant] = k.split('/');
      e.rawMax = Math.min(up(e.raw), profile === 'phone' ? base.phoneRawBytesMax : Infinity);
      e.jsGzipMax = Math.min(up(e.jsGzip), variant === 'lite' ? base.jsGzipLiteMax : Infinity);
      if (!Number.isFinite(e.rawMax)) e.rawMax = up(e.raw);
      if (!Number.isFinite(e.jsGzipMax)) e.jsGzipMax = up(e.jsGzip);
      if (e.requests != null) e.requestsMax = up(e.requests);
      if (e.jsRaw != null) e.jsRawMax = up(e.jsRaw);
      // gated: the phone (no Three.js) in every variant and the lite route on every profile; the desktop and
      // tablet totals with Three.js are reported only
      e.gated = !UNGATED_PAGES.has(page) && (profile === 'phone' || variant === 'lite');
    }
  }
  const head = git('rev-parse HEAD', root) || report.commit || null;
  const dirty = git('status --porcelain -- src docs/assets scripts', root) !== '';
  return {
    measuredOn: head, measuredAt: new Date().toISOString(), measuredFrom: { commit: report.commit || null, generated: report.generated || null, runs: report.runs.length },
    workingTreeDirty: dirty,
    // a dirty tree: the commit alone does not name what was measured; the hash of the diff against it does
    workingTree: dirty ? workingTreeHash(root) : null,
    note: 'Gemeten door node scripts/qa/budget.mjs --measure uit een volledige npm run qa; plafond = meting + marge, nooit boven de harde grenzen. Nieuw meten na elke bewuste gewichtswijziging.',
    marginBytes: base.marginBytes, marginCalls: base.marginCalls, phoneRawBytesMax: base.phoneRawBytesMax, jsGzipLiteMax: base.jsGzipLiteMax,
    rafIdleMax: base.rafIdleMax, activeIntervalsMax: base.activeIntervalsMax, pendingTimeoutsMax: base.pendingTimeoutsMax, sceneEventMs: base.sceneEventMs,
    h1ShiftMaxPx: base.h1ShiftMaxPx, clsMax: base.clsMax, h1PaintMaxMs: base.h1PaintMaxMs, assets: base.assets,
    gates: { rafIdle: true, timers: true, bytes: true, firstViewport: true, backdropFilter: true, lineLimitsStrict: true, calls: true, nogl: true,
      requests: true, fonts: true, three: true, cls: true, h1Paint: true, assets: true },
    pages,
  };
}

/** sha1 of `git diff HEAD` over src, docs and scripts plus the untracked file names: identifies a dirty tree. */
export function workingTreeHash(root) {
  try {
    const diff = execSync('git diff HEAD -- src docs scripts', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 28 });
    const untracked = git('ls-files --others --exclude-standard -- src docs scripts', root);
    return createHash('sha1').update(diff).update(untracked).digest('hex');
  } catch { return null; }
}

/** budget.json: readable header, one line per page (the file counts for the 500-line rule like every source file). */
export function formatBudget(data) {
  const { pages, ...head } = data;
  const lines = JSON.stringify(head, null, 2).replace(/\n}$/, ',\n  "pages": {\n');
  const body = Object.entries(pages).map(([page, p]) => `    ${JSON.stringify(page)}: ${JSON.stringify(p)}`).join(',\n');
  return lines + body + '\n  }\n}\n';
}

/** A short table of the hard gates for the console and the report. */
export function budgetSummary(budget) {
  const rows = [];
  for (const [page, p] of Object.entries(budget.pages || {})) {
    for (const [k, e] of Object.entries(p)) {
      if (k === 'calls') { for (const [profile, c] of Object.entries(e)) rows.push({ page, what: `draw calls ${profile}`, measured: c.calls, max: c.callsMax, unit: '', gated: true }); continue; }
      rows.push({ page, what: `${k} ruw`, measured: e.raw, max: e.rawMax, unit: 'kB', gated: e.gated });
      if (k.endsWith('/lite')) rows.push({ page, what: `${k} JS gzip`, measured: e.jsGzip, max: e.jsGzipMax, unit: 'kB', gated: e.gated });
      if (e.requestsMax && e.gated) rows.push({ page, what: `${k} verzoeken`, measured: e.requests, max: e.requestsMax, unit: '', gated: true });
      if (e.jsRawMax && e.gated) rows.push({ page, what: `${k} JS ruw`, measured: e.jsRaw, max: e.jsRawMax, unit: 'kB', gated: true });
    }
  }
  return rows;
}

if (process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))) {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const arg = (name) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null; };
  const file = join(root, 'scripts', 'qa', 'budget.json');
  if (argv.includes('--measure')) {
    const reportPath = arg('--report') || join(root, '.qa', 'report.json');
    if (!existsSync(reportPath)) { console.error(`geen ${reportPath}: draai eerst npm run build && npm run qa`); process.exit(1); }
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    if (report.summary && report.summary.status !== 'green') { console.error('het rapport is rood: een budget wordt alleen uit een groene run gemeten'); process.exit(1); }
    let data;
    try { data = measureBudget(report, { root }); } catch (e) { console.error(e.message); process.exit(1); }
    const rows = budgetSummary(data).filter(r => r.gated);
    for (const r of rows) console.log(`${r.page.padEnd(32)} ${r.what.padEnd(22)} ${String(r.unit ? Math.round(r.measured / 1024) : r.measured).padStart(6)} -> ${String(r.unit ? Math.round(r.max / 1024) : r.max).padStart(6)} ${r.unit}`);
    if (argv.includes('--dry-run')) { console.log(`\n${rows.length} poorten, niet geschreven (--dry-run)`); process.exit(0); }
    writeFileSync(file, formatBudget(data));
    console.log(`\nscripts/qa/budget.json geschreven: ${Object.keys(data.pages).length} pagina's, ${rows.length} poorten, gemeten op ${data.measuredOn}${data.workingTreeDirty ? ` (werkmap met wijzigingen, workingTree ${(data.workingTree || '').slice(0, 10)})` : ''}`);
    if (data.workingTreeDirty) console.log('let op: de werkmap wijkt af van de commit; meet na de release-commit opnieuw op de schone boom (README, Release en QA-poort)');
    process.exit(0);
  }
  const b = loadBudget(root);
  console.log(`budget: ${b.source}${b.measuredOn ? `, gemeten op ${b.measuredOn}` : ''}`);
  console.log(`poorten: ${Object.entries(b.gates).map(([k, v]) => `${k}=${v ? 'aan' : 'uit'}`).join(' ')}`);
  for (const r of budgetSummary(b)) console.log(`${r.gated ? 'poort ' : 'info  '} ${r.page.padEnd(32)} ${r.what.padEnd(22)} ${String(r.unit ? Math.round(r.measured / 1024) : r.measured).padStart(6)} -> ${String(r.unit ? Math.round(r.max / 1024) : r.max).padStart(6)} ${r.unit}`);
}
