// Executes one run (page x profile x mode x variant) in a fresh browser context.
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { PROFILES, VARIANTS, INTRO_MAX_MS, contextOptions, isDemoPage, isLegalPage } from './profiles.mjs';
import { budgetIssues, classify, statusOf, pageCeiling } from './budget.mjs';
import * as P from './perf.mjs';   // WP-16: requests, fonts, H1 paint and shift, CLS
import { HEAVY_PROPS } from './lint-css.mjs';
import * as C from './checks.mjs';

const short = (s, n = 240) => String(s).replace(/\s+/g, ' ').slice(0, n);

/**
 * env: { base, pagesBase, budget, rules, root, out, shots }
 * Returns the run record that goes into .qa/report.json.
 */
export async function runOne(browser, run, env) {
  const profile = PROFILES[run.profile], variant = VARIANTS[run.variant];
  const demo = isDemoPage(run.page), legal = isLegalPage(run.page);
  const raw = [];          // raw issues, classified at the end
  const issue = (check, text, extra = {}) => raw.push({ check, text: short(text), page: run.page, ...extra });
  const notice = (check, text) => raw.push({ check, text: short(text), page: run.page, severity: 'notice' });
  const external = [], consoleErrors = [];
  const bytes = { total: 0, jsGzip: 0, byType: {} };
  const perf = P.perfLog();   // WP-16
  let counting = true;      // the conversion check reloads the page per key; those bytes are not the first load
  let muted = false;        // the dead-module check blocks a local script on purpose: its console line is not a site error
  const url = env.base + run.page + variant.query;
  const ctx = await browser.newContext(contextOptions(run.profile, run.variant));
  await ctx.addInitScript(C.initScript, { hardwareConcurrency: profile.hardwareConcurrency, intro: !!variant.intro });
  await ctx.addInitScript(P.perfInit);   // WP-16: after the counters, so its rAF poll is counted but ends before the idle window
  const tab = await ctx.newPage();
  const is404 = run.page === '404.html';

  // Every request type passes here: documents, modules, fetch, images, fonts, navigations.
  await tab.route('**/*', async (route) => {
    const req = route.request();
    const kind = C.hostKind(req.url());
    if (kind === 'local') return route.continue();
    if (kind === 'pages' && is404) { // <base href> on the 404 page points at the Pages host: serve it locally
      const local = env.base + req.url().slice(env.pagesBase.length);
      try { const r = await route.fetch({ url: local }); return route.fulfill({ response: r }); } catch (e) { return route.abort(); }
    }
    external.push(`${req.resourceType()} ${req.url().slice(0, 160)}`);
    return route.abort('blockedbyclient');
  });
  tab.on('console', m => { if (m.type() === 'error' && !muted) consoleErrors.push(short(m.text(), 300)); });
  tab.on('pageerror', e => consoleErrors.push('pageerror: ' + short(e.message || e, 300)));
  tab.on('requestfailed', r => { const t = r.failure()?.errorText || ''; if (!/ERR_ABORTED|BLOCKED_BY_CLIENT/.test(t) && C.hostKind(r.url()) === 'local') issue('request-failed', `${r.url()} ${t}`); });
  tab.on('response', async (r) => {
    if (r.status() >= 400) issue('http', `http ${r.status()}: ${r.url()}`);
    if (C.hostKind(r.url()) !== 'local' && !is404) return;
    if (!counting) return;
    try { const body = await r.body(); C.measure(bytes, r.request().resourceType(), body); P.perfRequest(perf, r.url(), r.request().resourceType(), body ? body.length : 0); } catch (e) { /* body gone (navigation) */ }
  });

  const rec = { ...run, url, loadMs: 0, webgl: null, scene: null, rafCount: null, sceneFrames: null, timerCount: null, externalRequests: external,
    overflow: null, consoleErrors, forbiddenText: [], storageKeys: null, animations: null, bytes, firstViewport: null, intro: null, fallbackResize: null, conversion: null, info: null,
    dock: null, longName: null, deadModule: null, shot: null, perf: null };
  try {
    const t0 = Date.now();
    await tab.goto(url, { waitUntil: 'load', timeout: 30000 });
    rec.loadMs = Date.now() - t0;

    // scene: wait for sts:scene-ready / sts:scene-failed up to the budget ceiling
    const hasCanvas = await tab.evaluate(() => !!document.getElementById('scene'));
    if (hasCanvas && run.mode !== 'nogl') {
      await tab.waitForFunction(() => window.__sts && window.__sts.events.length > 0, null, { timeout: env.budget.sceneEventMs }).catch(() => {});
    }
    // intro variant: sts:intro-done within the budget after the first scene event, then no overlay left
    if (variant.intro && hasCanvas) {
      await tab.waitForFunction(() => window.__sts && window.__sts.events.some(e => e.ev === 'sts:intro-done'), null, { timeout: env.budget.sceneEventMs + INTRO_MAX_MS }).catch(() => {});
      const ev = await tab.evaluate(() => window.__sts.events);
      const first = ev.find(e => e.ev !== 'sts:intro-done'), done = ev.find(e => e.ev === 'sts:intro-done');
      await tab.waitForTimeout(2000);
      const st = await tab.evaluate(C.sceneFrames);
      const pre = await tab.evaluate(() => { try { return sessionStorage.getItem('sts-pre'); } catch (e) { return 'geblokkeerd'; } });
      rec.intro = { firstEventMs: first ? first.ms : null, introDoneMs: done ? done.ms : null, overlay: st.overlay, pre };
      if (!done) issue('intro', `geen sts:intro-done binnen ${env.budget.sceneEventMs + INTRO_MAX_MS} ms (sts-pre afwezig)`);
      else if (first && done.ms - first.ms > INTRO_MAX_MS) issue('intro', `sts:intro-done ${done.ms - first.ms} ms na het eerste scene-event (budget ${INTRO_MAX_MS} ms)`);
      if (st.overlay) issue('intro', '#intro staat 2 s na sts:intro-done nog in de DOM');
      if (done && pre !== '1') issue('intro', `sessionStorage sts-pre is niet geschreven na de intro (${pre})`);
    }
    // first viewport words, before any scrolling
    const words = env.budget.firstViewportWords[run.page];
    if (words && !demo) {
      const fv = await tab.evaluate(C.firstViewport, words);
      rec.firstViewport = fv;
      for (const w of fv) if (!w.ok) issue('first-viewport', `'${w.word}' niet zichtbaar in het eerste scherm zonder scrollen (${w.top === null ? 'niet gevonden' : 'top ' + w.top + 'px'})`);
    }
    // 2 s after load: running/declared transitions on heavy properties
    await tab.waitForTimeout(2000);
    rec.animations = await tab.evaluate(C.animationScan, HEAVY_PROPS);
    if (!demo) {
      for (const a of rec.animations.running) issue('animation', `lopende animatie op zware eigenschap: ${a}`);
      for (const a of rec.animations.declared) issue('animation', `transition op zware eigenschap gedeclareerd: ${a}`);
    }
    // scroll through the page to trigger lazy work, then back to the top
    await tab.evaluate(() => { if (window.__perf) window.__perf.clsLoad = window.__perf.cls; });   // WP-16: CLS of the first load, before the scroll pass
    await tab.evaluate(async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += 700) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } scrollTo(0, 0); });
    await tab.waitForTimeout(600);
    // idle budget: counters 3 s apart; the scene's own frame counter is a separate, never-known gate (rust = 0 frames)
    const c0 = await tab.evaluate(C.readCounters), f0 = await tab.evaluate(C.sceneFrames);
    await tab.waitForTimeout(3000);
    const c1 = await tab.evaluate(C.readCounters), f1 = await tab.evaluate(C.sceneFrames);
    rec.rafCount = c1.raf - c0.raf;
    if (f0.frames !== null && f1.frames !== null) {
      rec.sceneFrames = { before: f0.frames, after: f1.frames, delta: f1.frames - f0.frames, lite: f1.lite, state: f1.state, route: f1.route };
      if (run.profile === 'phone' && !f1.lite) issue('raf-scene', `telefoon draait de Three.js-route (STSScene.lite is false, route ${f1.route})`);
      if (run.profile === 'phone' && f1.frames !== 0) issue('raf-scene', `telefoon heeft ${f1.frames} scene-frames getekend; de SVG-route tekent er geen`);
      if (run.profile !== 'phone' && f1.frames - f0.frames > 0) issue('raf-scene', `de scene tekende ${f1.frames - f0.frames} frames in 3 s rust (staat ${f1.state}); rust moet 0 frames zijn`);
    }
    rec.timerCount = { intervalsCreated: c1.intervalsCreated, intervalsActive: c1.intervalsActive, timeoutsCreated: c1.timeoutsCreated, timeoutsPending: c1.timeoutsPending };
    rec.perf = P.perfRecord(await tab.evaluate(P.perfState), perf);   // WP-16: after the idle window, before any reload

    rec.scene = await tab.evaluate(C.sceneState);
    rec.webgl = rec.scene.webgl;
    const info = await tab.evaluate(C.pageInfo, { localHosts: ['127.0.0.1', 'localhost'], pagesHost: new URL(env.pagesBase).hostname, phone: run.profile === 'phone' });
    rec.info = { lang: info.lang, title: info.title, h1: info.h1, pointer: info.pointer, reduced: info.reduced, hardwareConcurrency: info.hardwareConcurrency, smallTargets: info.smallTargets };
    rec.overflow = { scrollWidth: info.scrollWidth, innerWidth: info.innerWidth, viewportWidth: info.viewportWidth, visualWidth: info.visualWidth, wide: info.wide };
    rec.storageKeys = info.storage;
    if (info.scrollWidth > info.viewportWidth + 1) issue('overflow', `horizontale overflow: scrollWidth ${info.scrollWidth} > ${info.viewportWidth} (${info.wide.join('; ')})`);
    if (!info.lang || !info.lang.startsWith('nl')) issue('lang', `lang is ${info.lang}`);
    if (!info.title) issue('title', 'geen <title>');
    if (!info.hasViewport) issue('viewport', 'geen viewport-meta');
    if (!info.hasDesc) issue('description', 'geen meta description');
    if (info.undefinedText) issue('undefined', 'letterlijk undefined/NaN/[object Object] in de tekst');
    if (info.emoji) issue('emoji', 'emoji in zichtbare tekst');
    if (info.h1 !== 1) issue('h1', `aantal h1: ${info.h1}`);
    if (info.imgsNoAlt) issue('img-alt', `${info.imgsNoAlt} <img> zonder alt`);
    for (const e of info.externalMarkup) issue('external', `verwijzing naar andere host in de opmaak: ${e}`);
    if (!demo) for (const k of C.storageViolations(info.storage)) issue('storage', `opslagsleutel buiten de afspraak: ${k}`);
    if (run.page.startsWith('index') && !info.pointer) issue('profile', 'pointer-media niet leesbaar');

    const scan = await tab.evaluate(C.textScan, { rules: env.rules, cfg: { demo, legal, wijk: run.page.startsWith('wijk/') } });
    rec.forbiddenText = scan.forbidden;
    for (const f of scan.forbidden) issue('copy', `'${f.match}' in ${f.where} (${f.note})`, { rule: f.rule, where: f.where });
    for (const s of scan.simMissing) issue('sim-required', `[data-sim] ${s} bevat 'gesimuleerd' noch 'fictief'`);
    for (const s of scan.stars) issue('stars', `vijf gevulde sterren zonder 'voorbeeld' in ${s}`);

    // phone SVG route: a 100 px shorter viewport (the browser toolbar) must not move or rescale the landmark board
    if (run.profile === 'phone' && hasCanvas) {
      const r0 = await tab.evaluate(C.landmarkRect);
      if (r0) {
        const vp = PROFILES.phone.viewport;
        await tab.setViewportSize({ width: vp.width, height: vp.height - 100 });
        await tab.waitForTimeout(500);
        const r1 = await tab.evaluate(C.landmarkRect);
        await tab.setViewportSize(vp);
        await tab.waitForTimeout(300);
        rec.fallbackResize = { before: r0, after: r1 };
        const moved = !r1 || Math.abs(r0.x - r1.x) > 1 || Math.abs(r0.y - r1.y) > 1 || Math.abs(r0.w - r1.w) > 1 || Math.abs(r0.h - r1.h) > 1;
        if (moved) issue('fallback-resize', `#landmark-bord verschuift bij een 100 px lagere viewport: ${JSON.stringify(r0)} -> ${JSON.stringify(r1)} (de werkbalk van een telefoon herschaalt de skyline)`);
      }
    }
    // the phone dock: four doors and the page's own door fully visible, the action pill in view
    if (run.profile === 'phone' && !demo) {
      const dk = await tab.evaluate(C.dockState);
      rec.dock = dk;
      if (dk.doors.length) {
        const shown = dk.doors.filter(d => d.visible).length, cur = dk.doors.find(d => d.current);
        // five short labels do not fit 390 px: four show at rest; a page's own door scrolls into view with its two neighbours
        if (shown < Math.min(cur ? 3 : 4, dk.doors.length)) issue('dock', `dock toont ${shown} van ${dk.doors.length} deuren volledig op ${dk.vw} px (${dk.doors.map(d => `${d.label} ${d.left}-${d.right}`).join(', ')})`);
        if (cur && !cur.visible) issue('dock', `de deur van deze pagina (${cur.label}, ${cur.left}-${cur.right}) staat buiten beeld in het dock`);
        for (const d of dk.doors) if (d.w < 44 || d.h < 44) issue('dock', `deur ${d.label} is ${d.w}x${d.h} px (minstens 44x44)`);
        if (!dk.pill || !dk.pill.visible) issue('dock', `de actie van het dock staat niet in beeld (${dk.pill ? dk.pill.left + '-' + dk.pill.right : 'ontbreekt'})`);
      }
    }
    counting = false;
    // a 22-character first word on the sign (phone, index): no overflow, the sign inside the viewport, no word cut in two
    if (run.profile === 'phone' && run.page === 'index.html' && run.variant === 'default' && run.mode === 'gl') {
      const naam = 'Kinesitherapiepraktijk Vanderstraeten';
      await tab.goto(env.base + 'index.html?zaak=' + encodeURIComponent(naam) + '&sector=praktijk&gemeente=Deurne', { waitUntil: 'load', timeout: 30000 });
      await tab.waitForTimeout(1500);
      const sg = await tab.evaluate(C.signState);
      rec.longName = sg;
      if (sg.scrollWidth > sg.clientWidth + 1) issue('long-name', `'${naam}': horizontale overflow, scrollWidth ${sg.scrollWidth} > ${sg.clientWidth}`);
      if (!sg.sign || !sg.sign.placed) issue('long-name', `'${naam}': #sign-dom is niet geplaatst`);
      else if (sg.sign.left < -1 || sg.sign.right > sg.innerWidth + 1) issue('long-name', `'${naam}': het bord (${sg.sign.left}-${sg.sign.right}) valt buiten de viewport van ${sg.innerWidth} px`);
      if (sg.lines.join(' ') !== naam) issue('long-name', `'${naam}' staat als ${JSON.stringify(sg.lines)} op het bord (een woord mag nooit gebroken worden)`);
      if (sg.sr !== 'Uithangbord: ' + naam) issue('long-name', `#sign-sr zegt ${JSON.stringify(sg.sr)}, verwacht 'Uithangbord: ${naam}'`);
    }
    // the WP-17 limit case on the pages that print the name in a heading, a chip or a derived host (fixronde golf 5):
    // a 40-character two-word name and a 30-character gemeente, no horizontal overflow anywhere on the page
    if (run.profile === 'phone' && (run.page === 'index.html' || run.page === 'gereedschap.html') && run.variant === 'default' && run.mode === 'gl') {
      const lang = 'Aaaaaaaaaaaaaaaaaaaa Bbbbbbbbbbbbbbbbbbb', gem = 'Berendrecht-Zandvliet-Lillo-Xy';
      await tab.goto(env.base + run.page + '?zaak=' + encodeURIComponent(lang) + '&sector=horeca&gemeente=' + encodeURIComponent(gem), { waitUntil: 'load', timeout: 30000 });
      await tab.waitForTimeout(1500);
      const sg = await tab.evaluate(C.signState);
      rec.longName = Object.assign(rec.longName || {}, { lang: { scrollWidth: sg.scrollWidth, clientWidth: sg.clientWidth } });
      if (sg.scrollWidth > sg.clientWidth + 1) issue('long-name', `'${lang}' met gemeente '${gem}': horizontale overflow op ${run.page}, scrollWidth ${sg.scrollWidth} > ${sg.clientWidth}`);
    }
    // a dead scene module (blocked on purpose, intro variant): the overlay must not survive, the fallback must show
    if (variant.intro && hasCanvas) {
      await tab.evaluate(() => { try { sessionStorage.removeItem('sts-pre'); } catch (e) { /* blocked */ } });
      const dead = async (route) => route.abort('blockedbyclient');
      await tab.route('**/assets/js/scene.js', dead); await tab.route('**/assets/js/scene/plattegrond.js', dead);
      muted = true;
      await tab.goto(url, { waitUntil: 'load', timeout: 30000 });
      await tab.waitForTimeout(1000);
      const dm = await tab.evaluate(() => ({ overlay: !!document.getElementById('intro'), fallback: (() => { const f = document.getElementById('scene-fallback'); return !!f && !f.hidden; })(), failed: !!(window.__sts && window.__sts.events.some(e => e.ev === 'sts:scene-failed')), h1: (() => { const h = document.querySelector('h1'); const r = h && h.getBoundingClientRect(); return !!r && r.width > 0 && r.bottom > 0; })() }));
      rec.deadModule = dm;
      if (dm.overlay) issue('dead-module', '#intro blijft de pagina bedekken als de scene-module niet laadt');
      if (!dm.fallback) issue('dead-module', '#scene-fallback blijft verborgen als de scene-module niet laadt');
      if (!dm.failed) issue('dead-module', 'geen sts:scene-failed als de scene-module niet laadt');
      if (!dm.h1) issue('dead-module', 'de H1 is niet zichtbaar als de scene-module niet laadt');
      await tab.unroute('**/assets/js/scene.js'); await tab.unroute('**/assets/js/scene/plattegrond.js');
      muted = false;
    }
    rec.conversion = await conversionCheck(tab, run, env, issue, notice);
    // WP-15: --shots writes a set per page for gl and gl-swift (desktop and phone) to .qa/shots/; the report lists them
    if (env.shots && (run.mode === 'gl' || run.mode === 'gl-swift') && run.variant === 'default' && run.profile !== 'tablet') {
      mkdirSync(join(env.out, 'shots'), { recursive: true });
      const shot = `shots/${run.page.replace(/\//g, '_')}.${run.profile}${run.mode === 'gl' ? '' : '.' + run.mode}.png`;
      await tab.screenshot({ path: join(env.out, shot), fullPage: run.profile === 'phone' }).then(() => { rec.shot = shot; }).catch(() => {});
    }
  } catch (e) {
    issue('navigation', `navigatie: ${short(e.message || e)}`);
  }
  for (const e of external) issue('external', `extern verzoek geblokkeerd: ${e}`);
  const counted = new Map();
  for (const e of consoleErrors) counted.set(e, (counted.get(e) || 0) + 1);
  for (const [e, n] of counted) issue('console', n > 1 ? `${e} (${n}x)` : e);
  // touch targets >= 44 px is a hard rule on STS pages (checks.mjs measures radios and checkboxes by their label and skips
  // aria-hidden and tabindex -1); the fictional demo sites keep the notice
  if (rec.info && rec.info.smallTargets) (/^demo\//.test(run.page) ? notice : issue)('targets', `${rec.info.smallTargets} klikdoelen kleiner dan 44 px op de telefoon`);
  if (rec.scene) for (const b of budgetIssues(rec, env.budget)) raw.push({ ...b, page: run.page });
  if (rec.perf) for (const b of P.perfIssues(rec, env.budget, pageCeiling(env.budget, rec))) raw.push({ ...b, page: run.page });   // WP-16
  await ctx.close();
  rec.issues = raw.map(i => classify(i, { root: env.root, budget: env.budget, page: run.page }));
  rec.status = statusOf(rec.issues);
  return rec;
}

/** Clicks every [data-bericht] and checks the Bericht textarea. Skipped with a notice until WP-02 ships STSBericht. */
async function conversionCheck(tab, run, env, issue, notice) {
  const t = await tab.evaluate(C.conversionTargets).catch(() => null);
  if (!t) return null;
  if (!t.count) { if (!t.api) notice('conversion', 'conversiecheck nog niet actief: geen [data-bericht] en geen STSBericht.prefill (komt met WP-02)'); return { count: 0, api: t.api, checked: 0 }; }
  if (!t.api) { notice('conversion', `${t.count} [data-bericht] gevonden maar STSBericht.prefill ontbreekt: check overgeslagen (WP-02)`); return { count: t.count, api: false, checked: 0 }; }
  const zaak = { naam: 'Proefzaak QA', sector: 'horeca', gemeente: 'Berchem', bron: 'typed' };
  let checked = 0;
  for (let i = 0; i < Math.min(t.count, 12); i++) {
    await tab.goto(env.base + run.page, { waitUntil: 'load', timeout: 30000 });   // WP-02: a run has no .url; the address is base + page (surfaced once [data-bericht] existed)
    await tab.evaluate((z) => { try { sessionStorage.setItem('sts-zaak', JSON.stringify(z)); } catch (e) { /* blocked */ } }, zaak);
    const key = t.keys[i];
    const el = tab.locator('[data-bericht]').nth(i);
    await el.scrollIntoViewIfNeeded().catch(() => {});
    await el.click({ timeout: 5000 }).catch(e => issue('conversion', `[data-bericht=${key}] niet klikbaar: ${e.message}`));
    const ta = tab.locator('#bericht textarea, form#bericht textarea, textarea[name=bericht]').first();
    try {
      await ta.waitFor({ state: 'visible', timeout: 8000 });
      const value = await ta.inputValue();
      const phrase = await tab.evaluate((k) => { const B = window.STSBericht; return (B && typeof B.phrase === 'function') ? B.phrase(k) : null; }, key);
      if (!value.includes(zaak.naam)) issue('conversion', `[data-bericht=${key}]: de tekst bevat de zaaknaam '${zaak.naam}' niet`);
      if (phrase && !value.includes(phrase)) issue('conversion', `[data-bericht=${key}]: de tekst bevat de sleutelzin '${phrase}' niet`);
      if (!phrase && !tab.url().includes(`onderwerp=${encodeURIComponent(key)}`) && !value) issue('conversion', `[data-bericht=${key}]: geen onderwerp in de URL en lege tekst`);
      checked++;
    } catch (e) { issue('conversion', `[data-bericht=${key}]: geen Bericht-tekstvak gevonden na de klik (${tab.url()})`); }
  }
  return { count: t.count, api: true, checked };
}
