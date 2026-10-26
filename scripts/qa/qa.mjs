// Headless QA gate for the static site in docs/.
// Usage: node scripts/qa/qa.mjs [--pages a.html,b.html] [--out DIR] [--port 8765]
// Checks per page x viewport: console errors, page errors, failed requests,
// requests to foreign hosts, horizontal overflow, reduced-motion load, basic html hygiene.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readdirSync, statSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const req = createRequire(import.meta.url);
function loadPlaywright() { for (const c of ['playwright', '/usr/lib/node_modules/playwright', '/usr/local/lib/node_modules/playwright']) { try { return req(c); } catch {} } throw new Error('playwright not found: npm i playwright'); }
const { chromium } = loadPlaywright();
const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true] : []).filter(x => x.length));
const ROOT = process.cwd();
const DOCS = join(ROOT, 'docs');
const PORT = Number(args.port || 8765);
const OUT = args.out || join(ROOT, '.qa');
const BASE = `http://127.0.0.1:${PORT}/`;
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, isMobile: false },
  { name: 'phone', width: 390, height: 844, isMobile: true, deviceScaleFactor: 2, hasTouch: true },
];

function listPages(dir) {
  const out = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { if (f !== 'assets') out.push(...listPages(p)); }
    else if (f.endsWith('.html')) out.push(relative(DOCS, p).split('\\').join('/'));
  }
  return out.sort();
}

const pages = args.pages ? String(args.pages).split(',') : listPages(DOCS);
mkdirSync(OUT, { recursive: true });

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', DOCS], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));

const browser = await chromium.launch();
const results = [];
let failures = 0;

async function runPage(page, vp, reduced) {
  const issues = [];
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: !!vp.hasTouch,
    deviceScaleFactor: vp.deviceScaleFactor || 1, reducedMotion: reduced ? 'reduce' : 'no-preference', locale: 'nl-BE',
  });
  const tab = await ctx.newPage();
  if (page === '404.html') await tab.route(/8kawasaki8\.github\.io/, r => r.abort());
  tab.on('console', m => { if (m.type() === 'error' && !(allowLive && /Failed to load resource/.test(m.text()))) issues.push(`console.error: ${m.text().slice(0, 300)}`); });
  tab.on('pageerror', e => issues.push(`pageerror: ${String(e.message || e).slice(0, 300)}`));
  tab.on('requestfailed', r => { if (allowLive && r.url().includes('8kawasaki8.github.io')) return; if (!r.failure()?.errorText.includes('ERR_ABORTED')) issues.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
  const allowLive = page === '404.html';
  tab.on('request', r => { const u = new URL(r.url()); if (allowLive && u.hostname === '8kawasaki8.github.io') return; if (!['127.0.0.1', 'localhost'].includes(u.hostname) && u.protocol.startsWith('http')) issues.push(`external request: ${r.url()}`); });
  tab.on('response', r => { if (r.status() >= 400) issues.push(`http ${r.status()}: ${r.url()}`); });
  let timing = 0;
  try {
    const t0 = Date.now();
    await tab.goto(BASE + page, { waitUntil: 'load', timeout: 30000 });
    timing = Date.now() - t0;
    await tab.waitForTimeout(reduced ? 1200 : 2500);
    // scroll through the page to trigger lazy work
    await tab.evaluate(async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += 700) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } window.scrollTo(0, 0); });
    await tab.waitForTimeout(500);
    const info = await tab.evaluate(() => {
      const de = document.documentElement;
      const sw = Math.max(de.scrollWidth, document.body ? document.body.scrollWidth : 0);
      const wide = [];
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1) && getComputedStyle(el).position !== 'fixed' && getComputedStyle(el).overflow !== 'hidden') {
          const anc = el.closest('[style*="overflow"], .scroller, pre, canvas'); if (!anc) wide.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''} right=${Math.round(r.right)}`);
        }
        if (wide.length > 5) break;
      }
      return {
        scrollWidth: sw, innerWidth: window.innerWidth, wide,
        lang: de.getAttribute('lang'), title: document.title,
        hasViewport: !!document.querySelector('meta[name=viewport]'),
        hasDesc: !!document.querySelector('meta[name=description]'),
        undefinedText: /\bundefined\b|\[object Object\]|NaN\b/.test(document.body.innerText),
        emoji: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(document.body.innerText),
        euro: /€\s?\d|\d\s?€|\beuro\b/i.test(document.body.innerText),
        h1: document.querySelectorAll('h1').length,
        imgsNoAlt: [...document.images].filter(i => !i.hasAttribute('alt')).length,
        canvases: document.querySelectorAll('canvas').length,
      };
    });
    if (info.scrollWidth > info.innerWidth + 1) issues.push(`horizontal overflow: scrollWidth ${info.scrollWidth} > ${info.innerWidth} (${info.wide.join('; ')})`);
    if (!info.lang || !info.lang.startsWith('nl')) issues.push(`lang is ${info.lang}`);
    if (!info.title) issues.push('missing <title>');
    if (!info.hasViewport) issues.push('missing viewport meta');
    if (!info.hasDesc) issues.push('missing meta description');
    if (info.undefinedText) issues.push('literal undefined/NaN/[object Object] visible in text');
    if (info.emoji) issues.push('emoji found in visible text');
    if (info.euro && !page.startsWith('demo/') && page !== 'voorwaarden.html') issues.push('possible price (euro) in visible text');
    if (info.h1 !== 1) issues.push(`h1 count ${info.h1}`);
    if (info.imgsNoAlt) issues.push(`${info.imgsNoAlt} <img> without alt`);
    if (!reduced) await tab.screenshot({ path: join(OUT, `${page.replace(/[\/]/g, '_')}.${vp.name}.png`), fullPage: vp.name === 'phone' });
  } catch (e) { issues.push(`navigation: ${String(e.message || e).slice(0, 200)}`); }
  await ctx.close();
  return { page, viewport: vp.name, reducedMotion: reduced, loadMs: timing, issues };
}

for (const page of pages) {
  for (const vp of VIEWPORTS) {
    for (const reduced of [false, true]) {
      if (reduced && vp.name === 'desktop') continue; // reduced motion is checked on phone; desktop normal + phone both
      const r = await runPage(page, vp, reduced);
      results.push(r);
      if (r.issues.length) { failures++; console.log(`FAIL ${page} [${vp.name}${reduced ? ' reduced' : ''}]\n  - ${r.issues.join('\n  - ')}`); }
      else console.log(`ok   ${page} [${vp.name}${reduced ? ' reduced' : ''}] ${r.loadMs}ms`);
    }
  }
}

await browser.close();
server.kill();
writeFileSync(join(OUT, 'qa-report.json'), JSON.stringify({ pages: pages.length, failures, results }, null, 2));
console.log(`\n${failures ? 'QA FAILED' : 'QA PASSED'}: ${pages.length} pages, ${results.length} runs, ${failures} failing runs. Report: ${join(OUT, 'qa-report.json')}`);
process.exit(failures ? 1 : 0);
