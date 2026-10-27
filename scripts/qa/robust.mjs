// WP-26: robustness scenarios, headless. Runs after the accessibility pass in `npm run qa` and standalone:
//   node scripts/qa/robust.mjs [--pages a.html,b.html] [--scenario nojs,modules,fonts,links,base,print,audit]
//                              [--port 8795] [--out .qa] [--verbose] [--audit] (--audit prints the feature table)
// Scenarios (per STS page unless named):
//   nojs     JavaScript off (desktop and phone): a visible H1, text in <main>, the no-JS line, the doors as plain
//            links, the SVG skyline with its unlit board on the scene pages, no canvas, nothing hidden by reveal.
//   modules  every script of the page blocked one at a time (index, simulatie, gereedschap, werkwijze, a wijk page,
//            404, dev/bericht on desktop; index also on the phone; the scene modules and three.js on the GL route):
//            no uncaught error, a visible H1, text; on index with contact.js dead the form still goes to mailto.
//   fonts    every assets/fonts/ request blocked (index, gereedschap, juridisch): no error, no overflow, the H1 and the
//            page keep their height within the margin (metric-matched fallbacks), the scene draws 0 frames in rest.
//   links    every same-site #anchor on every page, desktop and phone: the target exists and lands under the fixed
//            and sticky bars (scroll-padding, scroll-margin); plus 404.html served for a deep path keeps its assets
//            through <base> ('base').
//   print    the A6 QR card, the toog card, the ?print one-pager and the plain page of gereedschap.html under print
//            media, with a PDF each (robust-print.mjs).
//   audit    static: features newer than Safari 15.4 / Chrome 100 and their fallbacks (robust-audit.mjs).
// Severity: 'fail' for an uncaught error or a blank page (no H1, no text); everything else is a notice.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import { PROFILES, PAGES_BASE, PAGES_HOST, contextOptions, isDemoPage } from './profiles.mjs';
import { initScript } from './checks.mjs';
import * as R from './robust-dom.mjs';
import { printScenario } from './robust-print.mjs';
import { auditFeatures, auditTable } from './robust-audit.mjs';

export const SCENARIOS = ['nojs', 'modules', 'fonts', 'links', 'base', 'print', 'audit'];
export const MODULE_PAGES = ['index.html', 'simulatie.html', 'gereedschap.html', 'werkwijze.html', '404.html', 'dev/bericht.html'];
export const FONT_PAGES = ['index.html', 'gereedschap.html', 'juridisch.html'];
export const FONT_MARGIN = { h1Px: 6, pagePct: 4 };
const short = (s, n = 240) => String(s).replace(/\s+/g, ' ').slice(0, n);

export function robustPages(pages) {
  const skip = [], run = [];
  for (const p of pages) {
    if (isDemoPage(p)) skip.push(`${p}: fictieve demosite, niet in de robuustheidscontrole`);
    else if (p === 'qa-report.html' || p === 'demos.html') skip.push(`${p}: ${p === 'demos.html' ? 'doorverwijzing' : 'rapport van de harnas'}, niet gecontroleerd`);
    else run.push(p);
  }
  return { run, skip };
}

/** Only the local server answers; the Pages host (404.html's <base>) is served locally too. */
function makeRouteLocal(env) {
  return async (route) => {
    const url = route.request().url();
    let u; try { u = new URL(url); } catch { return route.abort('blockedbyclient'); }
    if (/^(127\.0\.0\.1|localhost)$/.test(u.hostname)) return route.continue();
    if (url.startsWith(PAGES_BASE)) { try { const r = await route.fetch({ url: env.base + url.slice(PAGES_BASE.length) }); return route.fulfill({ response: r }); } catch { return route.abort(); } }
    return route.abort('blockedbyclient');
  };
}

async function open(browser, profile, { js = true, variant = 'default' } = {}) {
  const ctx = await browser.newContext({ ...contextOptions(profile, variant), javaScriptEnabled: js });
  if (js) await ctx.addInitScript(initScript, { hardwareConcurrency: PROFILES[profile].hardwareConcurrency, intro: false });
  const tab = await ctx.newPage();
  const errors = [], console_ = [];
  tab.on('pageerror', e => errors.push(short(e.message || e)));
  tab.on('console', m => { if (m.type() === 'error') console_.push(short(m.text(), 200)); });
  return { ctx, tab, errors, console: console_ };
}

/** nojs: one page x profile with scripts off. */
async function nojsOne(browser, page, profile, env, issue) {
  const { ctx, tab } = await open(browser, profile, { js: false });
  await tab.route('**/*', env.routeLocal);
  let st = null;
  try {
    await tab.goto(env.base + page, { waitUntil: 'load', timeout: 30000 });
    await tab.waitForTimeout(400);
    st = await tab.evaluate(R.aliveState);
    if (!st.h1 || !st.h1.visible) issue('nojs-blank', `${page} [${profile}] zonder JavaScript: geen zichtbare H1`, 'fail');
    if (st.textLength < 120) issue('nojs-blank', `${page} [${profile}] zonder JavaScript: ${st.textLength} tekens tekst in <main> (lege pagina)`, 'fail');
    if (!st.nojsVisible) issue('nojs', `${page} [${profile}]: de <noscript>-regel is niet zichtbaar`);
    else if (!/JavaScript/.test(st.nojsText)) issue('nojs', `${page} [${profile}]: de <noscript>-regel noemt JavaScript niet`);
    if (st.doors.length < 5) issue('nojs', `${page} [${profile}]: ${st.doors.length} deuren in het uithangbord, verwacht 5`);
    for (const d of st.doors) if (!d.href || !d.visible) issue('nojs', `${page} [${profile}]: deur '${d.label}' is zonder JavaScript geen zichtbare link (${d.href})`);
    if (st.svg.present) {
      if (!st.svg.visible) issue('nojs', `${page} [${profile}]: de SVG-skyline blijft verborgen zonder JavaScript`);
      if (!st.svg.board) issue('nojs', `${page} [${profile}]: het bord (#landmark-bord) ontbreekt in de SVG`);
      if (st.canvasVisible) issue('nojs', `${page} [${profile}]: de lege canvas staat zichtbaar zonder JavaScript`);
    }
    if (page === 'index.html' && st.arrival.length < 2) issue('nojs', `index.html [${profile}]: de aankomstregels zijn niet zichtbaar (${st.arrival.length} gevonden)`);
    if (st.hiddenReveal) issue('nojs', `${page} [${profile}]: ${st.hiddenReveal} elementen blijven op opacity 0 (reveal zonder JavaScript)`);
    if (st.chipVisible) issue('nojs', `${page} [${profile}]: de naamchip (dode knop) blijft zichtbaar zonder JavaScript`);
    if (st.scrollWidth > st.clientWidth + 1) issue('nojs', `${page} [${profile}]: horizontale overflow zonder JavaScript (${st.scrollWidth} > ${st.clientWidth})`);
  } catch (e) { issue('nojs', `${page} [${profile}]: ${short(e.message || e)}`, 'fail'); }
  await ctx.close();
  return st;
}

/** The scripts a built page loads, in order, plus the modules the loader inserts. */
async function scriptsOf(page, env, profile) {
  const html = await (await fetch(env.base + page)).text();
  const list = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1].replace(/^(\.\.\/)+/, ''));
  if (/id="scene"/.test(html)) {
    if (profile === 'phone') list.push('assets/js/scene/plattegrond.js');
    else list.push('assets/js/scene.js', 'assets/js/scene/plattegrond.js', 'assets/vendor/three.module.min.js');
  }
  return list;
}

/** modules: one page x profile with one script blocked. */
async function moduleOne(browser, page, profile, script, env, issue) {
  const { ctx, tab, errors, console: cons } = await open(browser, profile);
  const tail = script.split('/').pop();
  await tab.route('**/*', (route) => route.request().url().endsWith('/' + script) ? route.abort('blockedbyclient') : env.routeLocal(route));
  const rec = { page, profile, script, errors: [], console: [], h1: null, text: 0, form: null };
  try {
    await tab.goto(env.base + page, { waitUntil: 'load', timeout: 30000 });
    const hasScene = await tab.evaluate(() => !!document.getElementById('scene'));
    if (hasScene) await tab.waitForFunction(() => window.__sts && window.__sts.events.length > 0, null, { timeout: 6000 }).catch(() => {});
    await tab.waitForTimeout(800);
    const st = await tab.evaluate(R.aliveState);
    rec.h1 = st.h1; rec.text = st.textLength;
    if (!st.h1 || !st.h1.visible) issue('module-blank', `${page} [${profile}] zonder ${tail}: geen zichtbare H1`, 'fail');
    if (st.textLength < 120) issue('module-blank', `${page} [${profile}] zonder ${tail}: ${st.textLength} tekens tekst (lege pagina)`, 'fail');
    // the form without contact.js: hydrate.js gave it a mailto action, so a native submit opens the mail app
    if (page === 'index.html' && (tail === 'contact.js' || tail === 'hydrate.js' || tail === 'state.js') && await tab.evaluate(() => !!document.getElementById('contact-form'))) {
      await tab.fill('#contact-form [name=name]', 'Proef'); await tab.fill('#contact-form [name=reach]', 'proef@example.be'); await tab.fill('#contact-form [name=message]', 'Proefbericht van de robuustheidscontrole.');
      await tab.click('#contact-form button[type=submit]').catch(() => {});
      await tab.waitForTimeout(600);
      rec.form = await tab.evaluate(R.formState);
      if (rec.form && /[?&]name=/.test(rec.form.url)) issue('module', `index.html zonder ${tail}: het formulier laadt de pagina opnieuw met de velden in de URL in plaats van mailto`, 'fail');
      if (rec.form && tail !== 'hydrate.js' && !/^mailto:/.test(rec.form.action)) issue('module', `index.html zonder ${tail}: het formulier heeft geen mailto-action (${rec.form.action || 'leeg'})`);
    }
  } catch (e) { issue('module', `${page} [${profile}] zonder ${tail}: ${short(e.message || e)}`, 'fail'); }
  rec.errors = errors.slice(); rec.console = cons.filter(c => !c.includes(tail) && !/ERR_BLOCKED_BY_CLIENT|Failed to load resource/.test(c));
  for (const e of errors) issue('module-error', `${page} [${profile}] zonder ${tail}: onopgevangen fout: ${e}`, 'fail');
  for (const c of rec.console) issue('module', `${page} [${profile}] zonder ${tail}: consolefout: ${c}`);
  await ctx.close();
  return rec;
}

/** fonts: a normal load and a load with every font file blocked, compared. */
async function fontsOne(browser, page, profile, env, issue) {
  const load = async (block) => {
    const o = await open(browser, profile);
    await o.tab.route('**/*', (route) => block && /\/assets\/fonts\//.test(route.request().url()) ? route.abort('blockedbyclient') : env.routeLocal(route));
    await o.tab.goto(env.base + page, { waitUntil: 'load', timeout: 30000 });
    const hasScene = await o.tab.evaluate(() => !!document.getElementById('scene'));
    if (hasScene) await o.tab.waitForFunction(() => window.__sts && window.__sts.events.length > 0, null, { timeout: 6000 }).catch(() => {});
    await o.tab.waitForTimeout(1200);
    const a = await o.tab.evaluate(R.fontState);
    await o.tab.waitForTimeout(2000);
    const b = await o.tab.evaluate(R.fontState);
    await o.ctx.close();
    return { ...b, framesDelta: a.frames != null && b.frames != null ? b.frames - a.frames : null, errors: o.errors, console: o.console.filter(c => !/fonts\/|ERR_BLOCKED_BY_CLIENT|Failed to load resource/.test(c)) };
  };
  const rec = { page, profile, normal: null, blocked: null };
  try {
    rec.normal = await load(false); rec.blocked = await load(true);
    const n = rec.normal, b = rec.blocked;
    for (const e of b.errors) issue('fonts', `${page} [${profile}] zonder lettertypen: onopgevangen fout: ${e}`, 'fail');
    for (const c of b.console) issue('fonts', `${page} [${profile}] zonder lettertypen: consolefout: ${c}`);
    if (!b.h1) issue('fonts', `${page} [${profile}] zonder lettertypen: geen H1`, 'fail');
    if (b.loaded) issue('fonts', `${page} [${profile}]: ${b.loaded} lettertypen staan toch op 'loaded' terwijl elk bestand geblokkeerd is`);
    if (n.h1 && b.h1 && Math.abs(n.h1.height - b.h1.height) > FONT_MARGIN.h1Px) issue('fonts', `${page} [${profile}]: de H1 is ${b.h1.height} px hoog zonder lettertypen tegenover ${n.h1.height} px ermee (marge ${FONT_MARGIN.h1Px} px; terugvalfont niet metrisch gelijk)`);
    if (n.scrollHeight && Math.abs(n.scrollHeight - b.scrollHeight) / n.scrollHeight * 100 > FONT_MARGIN.pagePct) issue('fonts', `${page} [${profile}]: de pagina is ${b.scrollHeight} px hoog zonder lettertypen tegenover ${n.scrollHeight} px ermee (marge ${FONT_MARGIN.pagePct} %)`);
    if (b.scrollWidth > b.clientWidth + 1) issue('fonts', `${page} [${profile}] zonder lettertypen: horizontale overflow (${b.scrollWidth} > ${b.clientWidth})`);
    if (!/Fallback|system-ui|sans-serif/.test(b.h1Family)) issue('fonts', `${page} [${profile}]: de H1 noemt geen terugvalfont (${b.h1Family})`);
    if (b.framesDelta) issue('fonts', `${page} [${profile}] zonder lettertypen: de scène tekende ${b.framesDelta} frames in 2 s rust (verwacht 0)`);
  } catch (e) { issue('fonts', `${page} [${profile}]: ${short(e.message || e)}`, 'fail'); }
  return rec;
}

/** links: every #anchor collected from every page, checked on desktop and phone. */
async function linksScenario(browser, pages, env, issue) {
  const targets = new Map();
  const { ctx, tab } = await open(browser, 'desktop');
  await tab.route('**/*', env.routeLocal);
  for (const page of pages) {
    try {
      await tab.goto(env.base + page, { waitUntil: 'load', timeout: 30000 });
      for (const l of await tab.evaluate(R.anchorLinks, new URL(env.base).origin)) { const k = `${l.page}#${l.id}`; if (!targets.has(k)) targets.set(k, l); }
    } catch (e) { issue('links', `${page}: ankers niet verzameld: ${short(e.message || e)}`); }
  }
  await ctx.close();
  const rec = { targets: targets.size, checked: [] };
  for (const profile of ['desktop', 'phone']) {
    const o = await open(browser, profile);
    await o.tab.route('**/*', env.routeLocal);
    for (const t of targets.values()) {
      if (!pages.includes(t.page)) continue;
      try {
        await o.tab.goto(env.base + t.page + '#' + encodeURIComponent(t.id), { waitUntil: 'load', timeout: 30000 });
        await o.tab.waitForTimeout(900);
        const st = await o.tab.evaluate(R.anchorState, t.id);
        rec.checked.push({ profile, ...t, ...st });
        const mapped = st.hash && st.hash !== '#' + t.id ? ` (herschreven naar ${st.hash})` : '';
        if (!st.found) { if (!mapped) issue('links', `${t.page}#${t.id} [${profile}] (vanaf ${t.from}): geen element met dat id${st.hash !== '#' + t.id ? `, hash nu ${st.hash}` : ''}`); continue; }
        if (st.top < st.cover - 1) issue('links', `${t.page}#${t.id} [${profile}]${mapped}: landt op ${st.top} px, onder een balk tot ${st.cover} px (${st.bars.map(b => b.what).join(', ')})`);
        else if (st.covered) issue('links', `${t.page}#${t.id} [${profile}]${mapped}: de bovenrand wordt gedekt door ${st.probe}`);
        // a target at the top of the document (index: the arrival under the sign) cannot scroll any higher
        if ((st.top > st.innerHeight * 0.6 && st.boxTop > 0) || st.bottom < 0) issue('links', `${t.page}#${t.id} [${profile}]${mapped}: het doel staat niet in beeld (top ${st.top} px van ${st.innerHeight})`);
      } catch (e) { issue('links', `${t.page}#${t.id} [${profile}]: ${short(e.message || e)}`); }
    }
    await o.ctx.close();
  }
  return rec;
}

/** base: 404.html served for a deep, missing path keeps its stylesheets, fonts and links through <base>. */
async function baseScenario(browser, env, issue) {
  const deep = 'wijk/diep/pad/onbekend.html';
  const { ctx, tab, errors } = await open(browser, 'desktop');
  const failed = [];
  tab.on('requestfailed', r => { const t = r.failure()?.errorText || ''; if (!/ERR_ABORTED|BLOCKED_BY_CLIENT/.test(t)) failed.push(`${r.url()} ${t}`); });
  tab.on('response', r => { if (r.status() >= 400 && !r.url().endsWith(deep)) failed.push(`http ${r.status()} ${r.url()}`); });
  await tab.route('**/*', async (route) => {
    if (route.request().url() === env.base + deep) { const r = await route.fetch({ url: env.base + '404.html' }); return route.fulfill({ status: 404, headers: { 'content-type': 'text/html; charset=utf-8' }, body: await r.text() }); }
    return env.routeLocal(route);
  });
  let st = null;
  try {
    await tab.goto(env.base + deep, { waitUntil: 'load', timeout: 30000 });
    await tab.waitForTimeout(800);
    st = await tab.evaluate(R.baseState, PAGES_HOST);
    if (!st.base || !st.base.startsWith(PAGES_BASE)) issue('base', `404.html draagt geen <base> naar ${PAGES_BASE} (${st.base})`, 'fail');
    if (st.sheets < 3 || !st.styled) issue('base', `404.html op een diep pad: ${st.sheets} stylesheets, body ${st.bodyBg} (fonts, base en uithangbord via <base> verwacht)`, 'fail');
    if (!st.h1Visible) issue('base', '404.html op een diep pad: geen zichtbare H1', 'fail');
    if (!/Panchang/.test(st.h1Family)) issue('base', `404.html op een diep pad: de H1 staat niet in Panchang (${st.h1Family})`);
    if (st.linksOnPagesHost !== st.links) issue('base', `404.html op een diep pad: ${st.links - st.linksOnPagesHost} van ${st.links} links wijzen niet naar de Pages-host`);
    for (const f of failed) issue('base', `404.html op een diep pad: verzoek mislukt: ${f}`);
    for (const e of errors) issue('base', `404.html op een diep pad: onopgevangen fout: ${e}`, 'fail');
  } catch (e) { issue('base', `404 op een diep pad: ${short(e.message || e)}`, 'fail'); }
  await ctx.close();
  return { path: deep, ...(st || {}), failed };
}

/** The whole pass. env: { base, out, root, verbose }. Returns { runs, fails, notices, skipped, audit, ... }. */
export async function robustPass(browser, pages, env, { scenarios = SCENARIOS, log = console.log } = {}) {
  const { run, skip } = robustPages(pages);
  const E = { ...env, all: pages, routeLocal: makeRouteLocal(env) };
  mkdirSync(join(env.out, 'robust'), { recursive: true });
  const issues = [], issue = (check, text, severity = 'notice') => issues.push({ check, text: short(text), severity });
  const out = { scenarios, pages: run, skipped: skip, issues, nojs: [], modules: [], fonts: [], links: null, base: null, print: null, audit: null };
  const want = (s) => scenarios.includes(s);
  const t = (f) => { const t0 = Date.now(); return f().then(r => { r.ms = Date.now() - t0; return r; }); };
  if (want('nojs')) for (const page of run) for (const profile of ['desktop', 'phone']) {
    const before = issues.length, st = await nojsOne(browser, page, profile, E, issue);
    out.nojs.push({ page, profile, h1: st && st.h1, text: st && st.textLength, svg: st && st.svg.visible, doors: st ? st.doors.length : 0, issues: issues.length - before });
  }
  if (want('modules')) for (const page of MODULE_PAGES.concat(run.filter(p => p.startsWith('wijk/')).slice(0, 1))) {
    if (!run.includes(page)) continue;
    for (const profile of page === 'index.html' ? ['desktop', 'phone'] : ['desktop']) {
      for (const script of await scriptsOf(page, E, profile)) {
        const before = issues.length, rec = await moduleOne(browser, page, profile, script, E, issue);
        out.modules.push({ ...rec, issues: issues.length - before });
      }
    }
  }
  if (want('fonts')) for (const page of FONT_PAGES.filter(p => run.includes(p))) for (const profile of page === 'index.html' ? ['desktop', 'phone'] : ['desktop']) out.fonts.push(await fontsOne(browser, page, profile, E, issue));
  if (want('links')) out.links = await t(() => linksScenario(browser, run, E, issue));
  if (want('base') && run.includes('404.html')) out.base = await baseScenario(browser, E, issue);
  if (want('print') && run.includes('gereedschap.html')) out.print = await printScenario(browser, E, issue);
  if (want('audit')) { const a = auditFeatures(env.root); out.audit = a.rows; for (const i of a.issues) issues.push(i); }
  out.fails = issues.filter(i => i.severity === 'fail').length; out.notices = issues.length - out.fails;
  const counts = {};
  for (const i of issues) counts[i.check] = (counts[i.check] || 0) + 1;
  log(`robuustheid: ${out.nojs.length} no-JS-runs, ${out.modules.length} geblokkeerde modules, ${out.fonts.length} fontruns, ${out.links ? out.links.targets : 0} ankers, ${out.print ? Object.keys(out.print.cases).length : 0} afdrukken; ${out.fails} fout(en), ${out.notices} notitie(s)${Object.keys(counts).length ? ' (' + Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ') + ')' : ''}`);
  for (const i of issues) if (i.severity === 'fail' || env.verbose) log(`   - ${i.severity === 'fail' ? 'FOUT ' : 'nota '}${i.check}: ${i.text}`);
  return out;
}

/* standalone: serves docs/ on a private port and runs the pass */
if (process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))) {
  const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true] : []).filter(x => x.length));
  const ROOT = process.cwd(), DOCS = join(ROOT, 'docs');
  if (args.audit) { const a = auditFeatures(ROOT); console.log(auditTable(a.rows)); for (const i of a.issues) console.log(`nota: ${i.text}`); process.exit(0); }
  const req = createRequire(import.meta.url);
  const { chromium } = req('playwright');
  const list = (dir) => { const out = []; for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) { if (f !== 'assets') out.push(...list(p)); } else if (f.endsWith('.html')) out.push(relative(DOCS, p).split('\\').join('/')); } return out.sort(); };
  const pages = args.pages ? String(args.pages).split(',').map(s => s.trim()).filter(Boolean) : list(DOCS);
  for (const p of pages) if (!existsSync(join(DOCS, p))) { console.error(`pagina ontbreekt in docs/: ${p}`); process.exit(2); }
  const port = Number(args.port || 8795), out = args.out ? String(args.out) : join(ROOT, '.qa');
  const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', DOCS], { stdio: 'ignore' });
  for (let i = 0; i < 30; i++) { await new Promise(r => setTimeout(r, 100)); try { const r = await fetch(`http://127.0.0.1:${port}/${pages[0]}`, { method: 'HEAD' }); if (r.ok) break; } catch { /* not yet */ } }
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
  const res = await robustPass(browser, pages, { base: `http://127.0.0.1:${port}/`, out, root: ROOT, verbose: !!args.verbose }, { scenarios: args.scenario ? String(args.scenario).split(',') : SCENARIOS });
  await browser.close(); server.kill();
  for (const s of res.skipped) console.log(`notitie: ${s}`);
  console.log(`\nrobuustheid: ${res.fails} fout(en), ${res.notices} notitie(s); schermafbeeldingen en PDF's in ${relative(ROOT, join(out, 'robust'))}/`);
  process.exit(res.fails ? 1 : 0);
}
