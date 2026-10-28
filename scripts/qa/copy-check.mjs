// WP-12 copy check: the acceptance criteria of the copy pass, measured on the built site in docs/.
// Usage: node scripts/qa/copy-check.mjs [--pages a.html,b.html] [--shots] [--port 8793] [--out .qa] [--json]
// Static part (on the HTML files): the slogan exactly twice on index.html and once on every other page, no euro sign
// and no 'AI-systemen' / 'automatisering voor' outside the four legal pages (OG tags included), 'ons team' and
// 'een medewerker' nowhere, 'Snymis' nowhere (the founder stays anonymous), og.png 1200x630 under 300 kB.
// Rendered part (Playwright, desktop 1440x900 and phone 390x844, intro skipped): no element with computed colour
// #36E8FF carries more than one line of text (text height, without tap-target padding, <= 1.6 x font-size and one
// client rect, so an inline link may not straddle a line break either), 'jullie' only inside data-voice=visitor,
// data-voice=customer or a FAQ question (details > summary). --shots writes full-page screenshots to <out>/shots/
// for the founder's read-through. Exit 1 on any failure. Serves docs/ itself on a private port.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PROFILES, GL_MODES, contextOptions, isLegalPage } from './profiles.mjs';

const ROOT = process.cwd();
const DOCS = join(ROOT, 'docs');
const SLOGAN = 'Where imagination can reach up to the';
const CYAN = 'rgb(54, 232, 255)';
const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def; };
const PORT = Number(opt('--port', '8793'));
const OUT = join(ROOT, opt('--out', '.qa'));
const SHOTS = argv.includes('--shots');

function listPages() {
  const out = [];
  const add = (dir, prefix) => { if (!existsSync(dir)) return; for (const f of readdirSync(dir)) if (f.endsWith('.html')) out.push(prefix + f); };
  add(DOCS, ''); add(join(DOCS, 'wijk'), 'wijk/'); add(join(DOCS, 'dev'), 'dev/');
  return out.filter(p => p !== 'qa-report.html').filter(p => !/http-equiv="refresh"/.test(readFileSync(join(DOCS, p), 'utf8'))).sort();
}
const selected = opt('--pages', '');
const pages = selected ? selected.split(',').map(s => s.trim()).filter(Boolean) : listPages();

const fails = [], notes = [];
const fail = (page, check, text) => fails.push({ page, check, text });

/* ── static checks on the built HTML ─────────────────────────────────────── */
function count(hay, needle) { return hay.split(needle).length - 1; }
for (const page of pages) {
  const html = readFileSync(join(DOCS, page), 'utf8');
  const legal = isLegalPage(page);
  const n = count(html, SLOGAN), want = page === 'index.html' ? 2 : 1;
  if (n !== want) fail(page, 'slogan', `de leus staat ${n} keer in de HTML, verwacht ${want}`);
  if (!legal && /€|&euro;|&#8364;/.test(html)) fail(page, 'euro', 'euroteken buiten de juridische pagina\'s');
  if (!legal) for (const w of ['AI-systemen', 'automatisering voor']) if (html.includes(w)) fail(page, 'dienst', `'${w}' staat in de HTML (ook OG-tags tellen)`);
  for (const w of ['ons team', 'een medewerker']) if (new RegExp('\\b' + w + '\\b', 'i').test(html)) fail(page, 'persona', `'${w}' staat in de HTML`);
  if (html.includes('data-room') && /Snymis/.test(html)) fail(page, 'snymis', 'de naam Snymis staat op de site (oprichter blijft anoniem)');
}
const og = join(DOCS, 'assets', 'img', 'og.png');
if (!existsSync(og)) fail('assets/img/og.png', 'og', 'ontbreekt');
else {
  const buf = readFileSync(og), w = buf.readUInt32BE(16), h = buf.readUInt32BE(20), bytes = statSync(og).size;
  if (w !== 1200 || h !== 630) fail('assets/img/og.png', 'og', `maat ${w}x${h}, verwacht 1200x630`);
  if (bytes >= 300 * 1024) fail('assets/img/og.png', 'og', `${bytes} bytes, de grens is 300 kB`);
  notes.push(`og.png: ${w}x${h}, ${(bytes / 1024).toFixed(1)} kB`);
}

/* ── rendered checks ─────────────────────────────────────────────────────── */
function serve() {
  return new Promise((resolve, reject) => {
    const srv = spawn('python3', ['-m', 'http.server', String(PORT), '-d', DOCS, '--bind', '127.0.0.1'], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    srv.stderr.on('data', d => { err += d; });
    srv.on('exit', code => reject(new Error(`server stopte (${code}): ${err}`)));
    const tryOnce = (left) => fetch(`http://127.0.0.1:${PORT}/`).then(() => resolve(srv)).catch(() => left ? setTimeout(() => tryOnce(left - 1), 150) : reject(new Error('server kwam niet op')));
    setTimeout(() => tryOnce(40), 150);
  });
}

/** Runs in the page: cyan text on one line, and every 'jullie' outside the allowed voices. */
function measure() {
  const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !el.closest('[hidden], script, style, template'); };
  const path = (el) => { const parts = []; for (let n = el, d = 0; n && n !== document.body && d < 4; n = n.parentElement, d++) parts.unshift(n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (typeof n.className === 'string' && n.className ? '.' + n.className.split(' ')[0] : '')); return parts.join(' > '); };
  const cyan = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (!vis(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.color !== 'rgb(54, 232, 255)' || cs.display === 'none') continue;
    const own = [...el.childNodes].filter(n => n.nodeType === 3 && n.nodeValue.trim()).map(n => n.nodeValue.trim()).join(' ');
    if (!own) continue;
    // text height = box height minus the vertical padding (the 44 px tap targets on coarse pointers pad inline links)
    const r = el.getBoundingClientRect(), fs = parseFloat(cs.fontSize), pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const h = r.height - pad, lines = el.getClientRects().length;
    if (h > 1.6 * fs || lines > 1) cyan.push({ where: path(el), text: own.slice(0, 60), height: Math.round(h), fontSize: fs, lines });
  }
  const jullie = [];
  const ok = (el) => !!(el.closest('[data-voice="visitor"], [data-voice="customer"]') || el.closest('details > summary'));
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    if (!/\bjullie\b/i.test(n.nodeValue)) continue;
    const el = n.parentElement;
    if (el && el.closest('script, style, template')) continue;
    if (!el || !ok(el)) jullie.push({ where: el ? path(el) : '?', text: n.nodeValue.trim().slice(0, 80) });
  }
  for (const el of document.querySelectorAll('input, textarea')) {
    const v = [el.value, el.placeholder, el.getAttribute('aria-label')].filter(Boolean).join(' ');
    if (/\bjullie\b/i.test(v) && !ok(el)) jullie.push({ where: path(el), text: v.slice(0, 80) });
  }
  return { cyan, jullie, title: document.title };
}

const srv = await serve();
const browser = await chromium.launch({ args: GL_MODES.gl.args });
try {
  if (SHOTS) mkdirSync(join(OUT, 'shots'), { recursive: true });
  for (const profileName of ['desktop', 'phone']) {
    const ctx = await browser.newContext(contextOptions(profileName, 'default'));
    await ctx.addInitScript(() => { try { sessionStorage.setItem('sts-pre', '1'); } catch (e) { /* storage blocked */ } });
    for (const page of pages) {
      const tab = await ctx.newPage();
      const errors = [];
      tab.on('pageerror', e => errors.push(String(e)));
      await tab.goto(`http://127.0.0.1:${PORT}/${page}`, { waitUntil: 'load' });
      await tab.waitForTimeout(900);   // hydrate, reveal and the room scripts have run; the scene lands or falls back
      const m = await tab.evaluate(measure);
      for (const c of m.cyan) fail(page, `cyan-${profileName}`, `cyaan tekst over meer dan een regel: ${c.where} "${c.text}" (${c.height}px bij ${c.fontSize}px, ${c.lines} regel${c.lines === 1 ? '' : 's'})`);
      for (const j of m.jullie) fail(page, `jullie-${profileName}`, `'jullie' buiten bezoekers- of klantenstem: ${j.where} "${j.text}"`);
      for (const e of errors) fail(page, `js-${profileName}`, e.slice(0, 160));
      if (SHOTS) await tab.screenshot({ path: join(OUT, 'shots', `${page.replace(/[\/.]/g, '-').replace(/-html$/, '')}-${profileName}.png`), fullPage: true });
      await tab.close();
      console.log(`${page} [${profileName}] cyaan ${m.cyan.length}, jullie ${m.jullie.length}${errors.length ? `, js-fouten ${errors.length}` : ''}`);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  srv.kill();
}
for (const n of notes) console.log(n);
if (argv.includes('--json')) console.log(JSON.stringify({ pages, fails, notes }, null, 2));
for (const f of fails) console.log(`FOUT   ${f.page} [${f.check}] ${f.text}`);
console.log(`\ncopy-check: ${fails.length} fout(en) op ${pages.length} pagina's (${PROFILES.desktop.viewport.width}x${PROFILES.desktop.viewport.height} en ${PROFILES.phone.viewport.width}x${PROFILES.phone.viewport.height})${SHOTS ? `; schermafbeeldingen in ${join(OUT, 'shots')}` : ''}`);
process.exit(fails.length ? 1 : 0);
