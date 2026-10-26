// Performance measurements for the QA harness (WP-16). Three pieces, wired by runner.mjs:
//   perfInit      init script (after checks.initScript): records the H1's first layout box and the frame it appeared in,
//                 the largest-contentful-paint entry and the cumulative layout shift (PerformanceObserver, buffered).
//   perfRequest   per local response of the first load: request count, raw script bytes, font files, Three.js.
//   perfState     page.evaluate after the idle window: the H1 box now (CLS proxy = its move since first paint), the
//                 first-contentful-paint entry, every @font-face with its file and its status in document.fonts, the
//                 preloaded font files. CLS is gated on the first load only (clsLoad, snapshotted by runner.mjs before
//                 its scroll pass): the rooms that open while scrolling (the radar steps) shift on purpose; the whole-run
//                 value stays reported. perfRecord() folds the request log in and names the fonts that were requested
//                 but never used for text (a preload nobody needs, or a face whose weight no rule asks for).
//   perfIssues    raw issues against the budget: Three.js on the phone or lite route, unused font files, the H1 moving,
//                 CLS, the H1 paint time (phone and lite only; desktop and tablet are reported), requests and raw JS
//                 bytes over the measured ceiling (+10 %), like the raw bytes of WP-15.
//   checkAssets   static: og.png under 150 kB, every docs/assets/img/straat/*.jpg under 60 kB and 800x500, every font
//                 preloaded by a built page (docs/**/*.html, the {{preloads}} of build.py) present on disk, and every
//                 file in docs/assets/fonts referenced by at least one stylesheet or page under docs/ (no dead fonts).
//                 `node scripts/qa/perf.mjs --selftest` proves the preload gate fires on a bogus preload.
import { readFileSync, readdirSync, existsSync, statSync, mkdirSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import { tmpdir } from 'node:os';

/** Init script: the H1 at its first painted frame, LCP and CLS. Polls with requestAnimationFrame until the H1 has a
 *  width (at most 600 frames); the poll ends long before the 3 s idle window, so the rAF gate is untouched. */
export function perfInit() {
  const P = { h1First: null, h1FirstMs: null, lcp: null, cls: 0, shifts: 0, polls: 0 };
  window.__perf = P;
  const box = (el) => { let x = 0, y = 0; for (let n = el; n; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; } return { x, y, w: el.offsetWidth, h: el.offsetHeight }; };
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) P.lcp = { ms: Math.round(e.startTime), el: e.element ? e.element.tagName.toLowerCase() + (e.element.id ? '#' + e.element.id : '') : null }; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch (e) { /* no LCP in this Chromium */ }
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { P.cls += e.value; P.shifts++; } }).observe({ type: 'layout-shift', buffered: true }); } catch (e) { /* no layout-shift entries */ }
  const raf = window.requestAnimationFrame.bind(window);
  (function poll() {
    P.polls++;
    const h = document.querySelector('h1');
    if (h && h.offsetWidth > 0) { P.h1First = box(h); P.h1FirstMs = Math.round(performance.now()); return; }
    if (P.polls < 600) raf(poll);
  })();
}

/** page.evaluate after the idle window. */
export function perfState() {
  const P = window.__perf || {};
  const box = (el) => { let x = 0, y = 0; for (let n = el; n; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; } return { x, y, w: el.offsetWidth, h: el.offsetHeight }; };
  const h = document.querySelector('h1'), now = h ? box(h) : null, first = P.h1First || null;
  const shift = first && now ? Math.max(Math.abs(now.x - first.x), Math.abs(now.y - first.y)) : null;
  const grow = first && now ? Math.abs(now.h - first.h) : null;
  const fcp = performance.getEntriesByName('first-contentful-paint')[0];
  const faces = [];
  for (const ss of document.styleSheets) {
    let rules; try { rules = ss.cssRules; } catch (e) { continue; }
    for (const r of rules) {
      if (!(r instanceof CSSFontFaceRule)) continue;
      const src = r.style.getPropertyValue('src'), m = /url\(["']?([^"')]+)/.exec(src);
      faces.push({ family: r.style.getPropertyValue('font-family').replace(/["']/g, ''), weight: r.style.getPropertyValue('font-weight') || '400', file: m ? m[1].split('/').pop() : null });
    }
  }
  const status = {}, statuses = [];
  for (const f of document.fonts) { const fam = f.family.replace(/["']/g, ''); status[fam + '|' + f.weight] = f.status; statuses.push({ family: fam, weight: f.weight, status: f.status }); }
  for (const f of faces) f.status = status[f.family + '|' + f.weight] || status[f.family + '|' + f.weight.split(' ')[0]] || null;
  return {
    h1: { first, now, firstMs: P.h1FirstMs ?? null, shift, grow }, fcp: fcp ? Math.round(fcp.startTime) : null, lcp: P.lcp || null,
    cls: +(P.cls || 0).toFixed(4), clsLoad: +(P.clsLoad ?? P.cls ?? 0).toFixed(4), shifts: P.shifts || 0, faces, statuses, fontsReady: document.fonts.status,
    preloads: [...document.querySelectorAll('link[rel=preload][as=font]')].map(l => (l.getAttribute('href') || '').split('/').pop()),
  };
}

/** A fresh request log for one run; perfRequest() feeds it from the response handler during the first load. */
export const perfLog = () => ({ requests: 0, jsRaw: 0, fonts: [], three: false });
export function perfRequest(log, url, type, n) {
  log.requests++;
  if (type === 'script') log.jsRaw += n;
  if (type === 'font') log.fonts.push(url.split('?')[0].split('/').pop());
  if (/three\.module|three-addons\//.test(url)) log.three = true;
}

/** The run record's perf block: state plus log, with the requested-but-unused font files named. A face is found by its
 *  file in the readable @font-face rules, or (404.html: fonts.css comes through <base> from the Pages host, so its rules
 *  are cross-origin and unreadable) by the file name '<family>-normal-<weight>.woff2' against document.fonts. */
export function perfRecord(state, log) {
  const byFile = new Map((state.faces || []).filter(f => f.file).map(f => [f.file, f]));
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const range = (w) => { const p = String(w).split(' ').map(Number); return [p[0], p[1] ?? p[0]]; };
  const byName = (file) => {
    const m = /^(.+?)-normal-(\d{3})(?:_\d{3})?\.woff2$/.exec(file); if (!m) return null;
    return (state.statuses || []).find(f => { const [a, b] = range(f.weight); return slug(f.family) === slug(m[1]) && +m[2] >= a && +m[2] <= b; }) || null;
  };
  const fontsUnused = [...new Set(log.fonts)].filter(file => { const f = byFile.get(file) || byName(file); return f && f.status !== 'loaded'; });
  return { ...state, requests: log.requests, jsRaw: log.jsRaw, fonts: [...new Set(log.fonts)], fontsUnused, three: log.three };
}

/** Raw issues of one run against the budget (classified by budget.classify). ceiling: pageCeiling(budget, run). */
export function perfIssues(run, budget, ceiling) {
  const p = run.perf, out = [];
  if (!p || /^demo\//.test(run.page)) return out;
  const noThree = run.profile === 'phone' || run.variant === 'lite';
  if (noThree && p.three) out.push({ check: 'three', text: `Three.js werd geladen op ${run.profile} ${run.variant}: die route is SVG en vraagt three.module nooit op` });
  for (const f of p.fontsUnused) out.push({ check: 'font', text: `lettertype ${f} is opgevraagd maar door geen tekst gebruikt (preload of overbodige @font-face)` });
  if (p.h1.shift != null && p.h1.shift > budget.h1ShiftMaxPx) out.push({ check: 'cls', text: `de H1 verschoof ${p.h1.shift} px tussen het eerste frame en de rust (${JSON.stringify(p.h1.first)} -> ${JSON.stringify(p.h1.now)}); budget ${budget.h1ShiftMaxPx} px` });
  if (p.clsLoad > budget.clsMax) out.push({ check: 'cls', text: `cumulatieve layoutverschuiving ${p.clsLoad} bij de eerste lading (voor de scrollpas; ${p.cls} over de hele run); budget ${budget.clsMax}` });
  if (p.h1.firstMs == null) out.push({ check: 'h1-paint', severity: 'notice', text: 'geen H1 met breedte gezien in de eerste 600 frames' });
  else if (noThree && p.h1.firstMs > budget.h1PaintMaxMs) out.push({ check: 'h1-paint', text: `de H1 stond pas na ${p.h1.firstMs} ms in beeld (budget ${budget.h1PaintMaxMs} ms op de route zonder Three.js)` });
  if (ceiling && ceiling.gated && budget.measuredOn) {
    if (ceiling.requestsMax && p.requests > ceiling.requestsMax) out.push({ check: 'requests', text: `${p.requests} verzoeken bij de eerste lading, gemeten ${ceiling.requests} (plafond ${ceiling.requestsMax} = gemeten + ${Math.round(budget.marginBytes * 100)} %)` });
    if (ceiling.jsRawMax && p.jsRaw > ceiling.jsRawMax) out.push({ check: 'bytes', text: `${Math.round(p.jsRaw / 1024)} kB JS ruw, gemeten ${Math.round(ceiling.jsRaw / 1024)} kB (plafond ${Math.round(ceiling.jsRawMax / 1024)} kB)` });
  }
  return out;
}

/** Static asset gates: image weights, the preloaded fonts on disk. Returns lint-style issues. */
export function checkAssets(root = process.cwd(), budget = {}) {
  const a = { ogMaxBytes: 150_000, straatMaxBytes: 60_000, straatSize: [800, 500], ...(budget.assets || {}) };
  const out = [], img = join(root, 'docs', 'assets', 'img');
  const fail = (file, text) => out.push({ check: 'assets', file, text, severity: 'fail' });
  const og = join(img, 'og.png');
  if (!existsSync(og)) fail('docs/assets/img/og.png', 'og.png ontbreekt');
  else if (statSync(og).size >= a.ogMaxBytes) fail('docs/assets/img/og.png', `og.png weegt ${Math.round(statSync(og).size / 1024)} kB (grens ${Math.round(a.ogMaxBytes / 1024)} kB; python3 scripts/img-shrink.py)`);
  const straat = join(img, 'straat');
  for (const f of existsSync(straat) ? readdirSync(straat).filter(f => f.endsWith('.jpg')) : []) {
    const file = `docs/assets/img/straat/${f}`, buf = readFileSync(join(straat, f));
    if (buf.length >= a.straatMaxBytes) fail(file, `${f} weegt ${Math.round(buf.length / 1024)} kB (grens ${Math.round(a.straatMaxBytes / 1024)} kB; python3 scripts/img-shrink.py)`);
    const dim = jpegSize(buf);
    if (dim && (dim[0] !== a.straatSize[0] || dim[1] !== a.straatSize[1])) fail(file, `${f} is ${dim[0]}x${dim[1]}, verwacht ${a.straatSize.join('x')} (width/height in builddata.py)`);
  }
  // preloads live in the built pages since WP-16 ({{preloads}}: PRELOAD_DEFAULT in build.py plus the 'preload:' front
  // matter); read them there, so a typo in either source fails here and not as a 404 in the matrix
  const docs = join(root, 'docs'), fontsDir = join(docs, 'assets', 'fonts');
  const used = new Set();
  for (const file of listFiles(docs, (f) => /\.(html|css)$/.test(f))) {
    const rel = relative(root, file).split('\\').join('/'), text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/[\w.-]+\.woff2?/g)) used.add(m[0]);
    if (!file.endsWith('.html') || rel.startsWith('docs/demo/')) continue;
    for (const m of text.matchAll(/<link\b[^>]*rel="preload"[^>]*>/g)) {
      const href = /href="([^"]+)"/.exec(m[0]); if (!href || !/assets\/fonts\//.test(href[1])) continue;
      const name = href[1].split('/').pop();
      if (!existsSync(join(fontsDir, name))) fail(rel, `preload van ${name}: bestand ontbreekt in docs/assets/fonts (PRELOAD_DEFAULT in scripts/build.py of 'preload:' in de front matter)`);
    }
  }
  for (const f of existsSync(fontsDir) ? readdirSync(fontsDir).filter(f => /\.woff2?$/.test(f)) : []) {
    if (!used.has(f)) fail(`docs/assets/fonts/${f}`, `${f} wordt door geen stylesheet of pagina onder docs/ genoemd: dood bestand, verwijder het of verwijs ernaar`);
  }
  return out;
}

function listFiles(dir, keep) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) out.push(...listFiles(p, keep)); else if (keep(f)) out.push(p); }
  return out;
}

/** --selftest: a throwaway root with one page that preloads a font that does not exist must fail on exactly that. */
export function selftestAssets(root = process.cwd()) {
  const tmp = join(tmpdir(), `sts-perf-selftest-${process.pid}`);
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(join(tmp, 'docs', 'assets', 'img'), { recursive: true }); mkdirSync(join(tmp, 'docs', 'assets', 'fonts'), { recursive: true });
  const og = join(root, 'docs', 'assets', 'img', 'og.png'); if (existsSync(og)) copyFileSync(og, join(tmp, 'docs', 'assets', 'img', 'og.png'));
  writeFileSync(join(tmp, 'docs', 'index.html'), '<!doctype html><link rel="preload" href="assets/fonts/panchang-normal-700.woff2" as="font" type="font/woff2" crossorigin>\n<link rel="preload" href="assets/fonts/nergens-normal-900.woff2" as="font" type="font/woff2" crossorigin>\n');
  writeFileSync(join(tmp, 'docs', 'assets', 'fonts', 'panchang-normal-700.woff2'), '');
  const issues = checkAssets(tmp, {});
  rmSync(tmp, { recursive: true, force: true });
  const hits = issues.filter(i => /nergens-normal-900/.test(i.text));
  return { ok: hits.length === 1 && issues.length === 1, issues };
}

if (process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))) {
  if (process.argv.includes('--selftest')) {
    const r = selftestAssets(process.cwd());
    for (const i of r.issues) console.log(`${i.severity} ${i.file}: ${i.text}`);
    console.log(r.ok ? 'zelftest perf: de valse preload valt precies een keer' : 'zelftest perf MISLUKT: de valse preload wordt niet (of niet alleen) gezien');
    process.exit(r.ok ? 0 : 1);
  }
  const issues = checkAssets(process.cwd(), {});
  for (const i of issues) console.log(`${i.severity} ${i.file}: ${i.text}`);
  console.log(issues.length ? `${issues.length} bevinding(en)` : 'assets in orde');
  process.exit(issues.length ? 1 : 0);
}

/** Width and height of a baseline or progressive JPEG from its SOF marker; null when not found. */
export function jpegSize(buf) {
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xFF) return null;
    const marker = buf[i + 1], len = buf.readUInt16BE(i + 2);
    if ((marker >= 0xC0 && marker <= 0xC3) || (marker >= 0xC5 && marker <= 0xC7) || (marker >= 0xC9 && marker <= 0xCB) || (marker >= 0xCD && marker <= 0xCF)) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
    i += 2 + len;
  }
  return null;
}
