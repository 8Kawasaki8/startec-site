// WP-19: accessibility checker (WCAG 2.1 AA), hand-written because @axe-core/playwright is not installable
// offline here. Runs after the matrix in qa.mjs (every STS page on desktop 1440x900 and phone 390x844,
// mode gl) and standalone:
//   node scripts/qa/a11y.mjs [--pages a.html,b.html] [--profile desktop|phone] [--port 8790] [--verbose]
//   node scripts/qa/a11y.mjs --selftest   (fixtures/a11y-broken.html must fail on exactly its four planted defects)
// Per page x profile: contrast of every visible text node (computed styles, composited backgrounds),
// accessible names, heading order, landmarks and the skip link, forms (labels, legends, error association,
// honeypot), live regions, the sign (#scene aria-hidden, #sign-sr polite), simulations (charts with a text
// alternative, buttons with states), language (nl-BE, English marked lang=en), a full Tab traversal (every
// tabbable element reached, visible focus ring, no trap), the edit sheet as a dialog (focus trapped, Escape
// closes, focus returns), reduced motion (nothing longer than 200 ms) and 200 % zoom on desktop (no
// horizontal scroll, no clipped text). Severity: 'fail' only for contrast and missing names; everything
// else is a notice, listed in the console and in .qa/report.json under `a11y`.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import { PROFILES, PAGES_BASE, contextOptions, isDemoPage } from './profiles.mjs';
import { initScript } from './checks.mjs';
import * as A from './a11y-dom.mjs';

export const A11Y_PROFILES = ['desktop', 'phone'];
export const MOTION_LIMIT_MS = 200;
export const ZOOM_VIEWPORT = { width: 720, height: 450 };   // 1440x900 at 200 %: CSS pixels halve
const TAB_LIMIT = 900;                                      // presses before we call it a trap (time inputs take 2-3 each)
const short = (s, n = 220) => String(s).replace(/\s+/g, ' ').slice(0, n);

/** Skips: fictional demo sites (not STS voice, own markup), the harness's own report, redirect stubs. */
export function a11yPages(pages) {
  const skip = [], run = [];
  for (const p of pages) {
    if (isDemoPage(p)) skip.push(`${p}: fictieve demosite, niet in de toegankelijkheidscontrole`);
    else if (p === 'qa-report.html') skip.push(`${p}: rapport van de harnas zelf, niet gecontroleerd`);
    else if (p === 'demos.html') skip.push(`${p}: doorverwijzing (meta refresh), niet gecontroleerd`);
    else run.push(p);
  }
  return { run, skip };
}

/** Only the local server answers; 404.html carries a <base> to the Pages host, so those requests are served locally too. */
async function routeLocal(route, env) {
  const url = route.request().url();
  let u; try { u = new URL(url); } catch { return route.abort('blockedbyclient'); }
  if (/^(127\.0\.0\.1|localhost)$/.test(u.hostname)) return route.continue();
  if (url.startsWith(PAGES_BASE)) { try { const r = await route.fetch({ url: env.base + url.slice(PAGES_BASE.length) }); return route.fulfill({ response: r }); } catch { return route.abort(); } }
  return route.abort('blockedbyclient');
}

/** Tab through the whole page: every listed element reached once, each with a visible ring, and the loop ends at the body. */
async function tabTraverse(tab) {
  const expected = await tab.evaluate(A.tabbables);
  const seen = new Set(), noRing = [], notVisible = [];
  let presses = 0, last = -2, same = 0, trap = false, stray = 0;
  await tab.evaluate(() => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); window.scrollTo(0, 0); });
  while (presses < TAB_LIMIT) {
    await tab.keyboard.press('Tab'); presses++;
    const f = await tab.evaluate(A.focusState);
    if (f.body) break;                                       // left the document: the traversal is complete
    if (f.index === last) { same++; if (same > 4) { trap = true; break; } continue; }   // time inputs keep focus over their segments
    same = 0; last = f.index;
    if (f.index < 0) { stray++; if (stray > 40) { trap = true; break; } continue; }     // an element we did not list (e.g. inside a scroller)
    if (seen.has(f.index)) { trap = true; break; }           // back at an earlier element without passing the body: a loop
    seen.add(f.index);
    if (!f.ring) noRing.push(expected[f.index]);
    if (!f.focusVisible) notVisible.push(expected[f.index]);
  }
  const missed = expected.map((s, i) => seen.has(i) ? null : s).filter(Boolean);
  return { expected: expected.length, reached: seen.size, presses, missed, noRing, notVisible, trap, stray };
}

/** The edit sheet of the Uithangbord: role=dialog, aria-modal, focus inside, Tab wraps, Escape closes, focus returns. */
async function dialogCheck(tab) {
  const has = await tab.evaluate(() => !!document.querySelector('[data-ub-chip]') && !!document.getElementById('ub-sheet'));
  if (!has) return null;
  const out = { issues: [] };
  await tab.locator('[data-ub-chip]').first().click({ timeout: 4000 }).catch(e => out.issues.push(`naamchip niet klikbaar: ${e.message}`));
  await tab.waitForTimeout(150);
  const st = () => tab.evaluate(() => {
    const s = document.getElementById('ub-sheet'), a = document.activeElement;
    const tabs = [...s.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')].filter(el => el.tabIndex >= 0 && !el.disabled && !el.closest('[hidden]') && getComputedStyle(el).display !== 'none');
    const radios = (el) => [...s.querySelectorAll(`input[type="radio"][name="${el.name}"]`)];
    const order = tabs.filter(el => el.tagName !== 'INPUT' || el.type !== 'radio' || el === (radios(el).find(r => r.checked) || radios(el)[0]));
    return { hidden: s.hidden, role: s.getAttribute('role'), modal: s.getAttribute('aria-modal'), labelled: !!(s.getAttribute('aria-labelledby') && document.getElementById(s.getAttribute('aria-labelledby'))), inside: s.contains(a), first: order[0] === a, last: order[order.length - 1] === a, chipHasFocus: a === document.querySelector('[data-ub-chip]'), n: order.length };
  });
  let s = await st();
  if (s.hidden) { out.issues.push('het bewerkblad opent niet na een klik op de naamchip'); return out; }
  if (s.role !== 'dialog') out.issues.push(`#ub-sheet heeft role=${s.role}, verwacht dialog`);
  if (s.modal !== 'true') out.issues.push(`#ub-sheet heeft aria-modal=${s.modal}, verwacht true`);
  if (!s.labelled) out.issues.push('#ub-sheet heeft geen werkend aria-labelledby');
  if (!s.inside) out.issues.push('de focus staat niet in het bewerkblad na het openen');
  // wrap forward: from the last element Tab lands on the first
  await tab.evaluate(() => { const s = document.getElementById('ub-sheet'); const t = [...s.querySelectorAll('button, input, select, textarea')].filter(el => el.tabIndex >= 0 && !el.disabled); t[t.length - 1].focus(); });
  await tab.keyboard.press('Tab'); s = await st();
  if (!s.inside || !s.first) out.issues.push('Tab vanaf het laatste element verlaat het bewerkblad (geen focusval)');
  await tab.keyboard.press('Shift+Tab'); s = await st();
  if (!s.inside || !s.last) out.issues.push('Shift+Tab vanaf het eerste element verlaat het bewerkblad (geen focusval)');
  await tab.keyboard.press('Escape'); await tab.waitForTimeout(100); s = await st();
  if (!s.hidden) out.issues.push('Escape sluit het bewerkblad niet');
  if (!s.chipHasFocus) out.issues.push('na Escape keert de focus niet terug naar de naamchip');
  return out;
}

/** One page x profile. Returns the a11y record with classified issues. */
export async function a11yOne(browser, page, profile, env) {
  const ctx = await browser.newContext(contextOptions(profile, 'default'));
  await ctx.addInitScript(initScript, { hardwareConcurrency: PROFILES[profile].hardwareConcurrency, intro: false });
  const tab = await ctx.newPage();
  const errors = [];
  tab.on('pageerror', e => errors.push(short(e.message || e)));
  await tab.route('**/*', r => routeLocal(r, env));
  const rec = { page, profile, url: env.base + page, issues: [], audit: null, tab: null, dialog: null, zoom: null, motion: null };
  const issue = (check, text, severity = 'notice') => rec.issues.push({ check, text: short(text), severity, page, profile });
  try {
    await tab.goto(rec.url, { waitUntil: 'load', timeout: 30000 });
    const hasScene = await tab.evaluate(() => !!document.getElementById('scene'));
    if (hasScene) await tab.waitForFunction(() => window.__sts && window.__sts.events.length > 0, null, { timeout: 8000 }).catch(() => {});
    await tab.waitForTimeout(800);
    // the static audit at the top of the page, then once more after a scroll pass so revealed text is measured too
    await tab.evaluate(async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += 700) { scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); } scrollTo(0, 0); });
    await tab.waitForTimeout(900);
    const a = await tab.evaluate(A.domAudit, { phone: profile === 'phone' });
    rec.audit = { textNodes: a.textNodes, pairs: a.pairs, headings: a.headings, liveCount: a.liveCount, contrastFails: a.contrast.length };
    for (const c of a.contrast) issue('contrast', `${c.ratio}:1 (${c.need} nodig${c.large ? ', grote tekst' : ''}) ${c.fg} op ${c.bg}${c.image ? ' (over een verloop, geschat)' : ''}, ${c.size}px/${c.weight}, ${c.count}x, bv. '${c.text}' in ${c.where}`, 'fail');
    for (const n of a.names) issue('name', `${n.what}: ${n.where}${n.name ? ` ('${n.name}')` : ''}`, n.severity);
    for (const h of a.headingIssues) issue('headings', h);
    for (const l of a.landmarks) issue('landmarks', l);
    for (const f of a.forms) issue('forms', f);
    for (const l of a.live) issue('live', l);
    for (const s of a.sim) issue('sim', s);
    for (const l of a.lang) issue('lang', l);
    // keyboard
    rec.tab = await tabTraverse(tab);
    if (rec.tab.trap) issue('keyboard', `toetsenbordval of lus na ${rec.tab.presses} keer Tab (${rec.tab.reached} van ${rec.tab.expected} bereikt)`);
    for (const m of rec.tab.missed) issue('keyboard', `niet bereikt met Tab: ${m}`);
    for (const m of rec.tab.noRing) issue('focus', `geen zichtbare focusring: ${m}`);
    for (const m of rec.tab.notVisible) issue('focus', `focus zonder :focus-visible: ${m}`);
    if (rec.tab.stray) issue('keyboard', `${rec.tab.stray} keer focus op een element buiten de lijst van tabbare elementen`);
    // the sheet as a dialog
    rec.dialog = await dialogCheck(tab);
    if (rec.dialog) for (const d of rec.dialog.issues) issue('dialog', d);
    // 200 % zoom on desktop: the viewport halves in CSS pixels
    if (profile === 'desktop') {
      await tab.setViewportSize(ZOOM_VIEWPORT); await tab.waitForTimeout(600);
      rec.zoom = await tab.evaluate(A.zoomScan);
      if (rec.zoom.overflow) issue('zoom', `horizontale scroll op 200 % zoom (${ZOOM_VIEWPORT.width} px): scrollWidth ${rec.zoom.sw} > ${rec.zoom.vw}`);
      for (const c of rec.zoom.clipped) issue('zoom', `tekst afgesneden op 200 % zoom: ${c}`);
      await tab.setViewportSize(PROFILES[profile].viewport);
    }
  } catch (e) { issue('navigation', `a11y: ${short(e.message || e)}`, 'fail'); }
  for (const e of errors) issue('console', `paginafout tijdens de toegankelijkheidscontrole: ${e}`);
  await ctx.close();
  // reduced motion, in its own context: nothing declared or running longer than the limit
  if (profile === 'desktop') {
    const rctx = await browser.newContext(contextOptions(profile, 'reduced'));
    await rctx.addInitScript(initScript, { hardwareConcurrency: PROFILES[profile].hardwareConcurrency, intro: false });
    const rt = await rctx.newPage();
    await rt.route('**/*', r => routeLocal(r, env));
    try {
      await rt.goto(rec.url, { waitUntil: 'load', timeout: 30000 }); await rt.waitForTimeout(1200);
      rec.motion = await rt.evaluate(A.motionScan, MOTION_LIMIT_MS);
      for (const m of rec.motion) issue('motion', `minder beweging: ${m} (grens ${MOTION_LIMIT_MS} ms)`);
    } catch (e) { issue('motion', `minder beweging niet gemeten: ${short(e.message || e)}`); }
    await rctx.close();
  }
  rec.fails = rec.issues.filter(i => i.severity === 'fail').length;
  rec.notices = rec.issues.length - rec.fails;
  return rec;
}

/** The whole pass: every page x A11Y_PROFILES. env: { base, log } */
export async function a11yPass(browser, pages, env, { profiles = A11Y_PROFILES, log = console.log } = {}) {
  const { run, skip } = a11yPages(pages);
  const runs = [];
  for (const page of run) for (const profile of profiles) {
    const t0 = Date.now();
    const rec = await a11yOne(browser, page, profile, env);
    rec.ms = Date.now() - t0; runs.push(rec);
    const tag = rec.fails ? 'FOUT  ' : rec.notices ? 'NOTA  ' : 'ok    ';
    log(`${tag} a11y ${page} [${profile}] ${rec.ms}ms contrast=${rec.audit ? rec.audit.contrastFails : '-'} tab=${rec.tab ? rec.tab.reached + '/' + rec.tab.expected : '-'} ${rec.fails ? `fouten=${rec.fails} ` : ''}${rec.notices ? `notities=${rec.notices}` : ''}`);
    for (const i of rec.issues) if (i.severity === 'fail' || env.verbose) log(`   - ${i.severity === 'fail' ? 'FOUT ' : 'nota '}${i.check}: ${i.text}`);
  }
  return { runs, skipped: skip, fails: runs.reduce((n, r) => n + r.fails, 0), notices: runs.reduce((n, r) => n + r.notices, 0), limits: { motionMs: MOTION_LIMIT_MS, zoom: ZOOM_VIEWPORT } };
}

/* standalone: serves docs/ on a private port and runs the pass */
if (process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))) {
  const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true] : []).filter(x => x.length));
  const ROOT = process.cwd(), DOCS = args.selftest ? join(ROOT, 'scripts', 'qa', 'fixtures') : join(ROOT, 'docs');
  const req = createRequire(import.meta.url);
  const { chromium } = req('playwright');
  if (args.selftest) { args.pages = 'a11y-broken.html'; args.profile = 'desktop'; args.verbose = true; }
  const list = (dir) => { const out = []; for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) { if (f !== 'assets') out.push(...list(p)); } else if (f.endsWith('.html')) out.push(relative(DOCS, p).split('\\').join('/')); } return out.sort(); };
  const pages = args.pages ? String(args.pages).split(',').map(s => s.trim()).filter(Boolean) : list(DOCS);
  for (const p of pages) if (!existsSync(join(DOCS, p))) { console.error(`pagina ontbreekt in docs/: ${p}`); process.exit(2); }
  const port = Number(args.port || 8790);
  const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', DOCS], { stdio: 'ignore' });
  for (let i = 0; i < 30; i++) { await new Promise(r => setTimeout(r, 100)); try { const r = await fetch(`http://127.0.0.1:${port}/${pages[0]}`, { method: 'HEAD' }); if (r.ok) break; } catch { /* not yet */ } }
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
  const res = await a11yPass(browser, pages, { base: `http://127.0.0.1:${port}/`, verbose: !!args.verbose }, { profiles: args.profile ? String(args.profile).split(',') : A11Y_PROFILES });
  await browser.close(); server.kill();
  for (const s of res.skipped) console.log(`notitie: ${s}`);
  console.log(`\na11y: ${res.runs.length} runs, ${res.fails} fout(en), ${res.notices} notitie(s)`);
  if (args.selftest) {   // the broken fixture: one contrast pair, three missing names; a heading jump, no landmarks and a ring-less link as notices
    const iss = res.runs[0].issues, n = (check, sev) => iss.filter(i => i.check === check && i.severity === sev).length;
    const ok = n('contrast', 'fail') === 1 && n('name', 'fail') === 3 && n('headings', 'notice') >= 1 && n('landmarks', 'notice') >= 1 && n('focus', 'notice') >= 1 && n('lang', 'notice') >= 1;
    console.log(ok ? 'zelftest a11y: de kapotte fixture faalt op precies vier fouten (1 contrast, 3 namen) en de verwachte notities' : 'zelftest a11y MISLUKT: de kapotte fixture geeft niet de verwachte bevindingen');
    process.exit(ok ? 0 : 1);
  }
  process.exit(res.fails ? 1 : 0);
}
