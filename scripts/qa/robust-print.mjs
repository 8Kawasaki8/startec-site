// WP-26: print scenarios of gereedschap.html under emulated print media, plus a real PDF per print (headless Chromium,
// preferCSSPageSize so the @page sizes of print.css decide). Screenshots and PDFs land in <out>/robust/.
// window.print() is stubbed (it is a no-op or a hang in headless): the stub counts calls, so STSTools.printBlock runs
// its real path (move the block to <body>, set the html class) and the harness fires afterprint itself afterwards.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { PROFILES, contextOptions } from './profiles.mjs';
import { initScript } from './checks.mjs';
import { printScan } from './robust-dom.mjs';

const MM = 72 / 25.4;                      // PDF points per millimetre
const A6 = { w: 105 * MM, h: 148 * MM }, A4 = { w: 210 * MM, h: 297 * MM };
const PX = 96 / 25.4;                      // CSS px per millimetre

/** MediaBoxes of a PDF, read from the raw bytes (enough for Chromium's output; no library). */
export function pdfPages(buf) {
  const text = buf.toString('latin1');
  const boxes = [];
  const re = /\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g;
  let m;
  while ((m = re.exec(text))) boxes.push({ w: +m[3] - +m[1], h: +m[4] - +m[2] });
  const pages = (text.match(/\/Type\s*\/Page[^s]/g) || []).length;
  return { pages: pages || boxes.length, boxes };
}

function near(a, b, tol = 3) { return Math.abs(a - b) <= tol; }

async function stubPrint(ctx) {
  await ctx.addInitScript(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
}

/** One print case: returns { scan, pdf, shot } and pushes issues. */
async function capture(tab, env, name, opts, issue) {
  await tab.emulateMedia({ media: 'print' });
  await tab.waitForTimeout(300);
  const scan = await tab.evaluate(printScan, opts.only || null);
  const shot = `robust/print-${name}.png`, pdf = `robust/print-${name}.pdf`;
  await tab.screenshot({ path: join(env.out, shot), fullPage: true }).catch(() => {});
  let pages = null;
  try {
    await tab.pdf({ path: join(env.out, pdf), preferCSSPageSize: true, printBackground: true });
    pages = pdfPages(readFileSync(join(env.out, pdf)));
  } catch (e) { issue('print', `${name}: geen PDF (${e.message})`); }
  await tab.emulateMedia({ media: 'screen' });
  // the page colours: white, dark text, no dark surface outside the canvases
  const white = (c) => /rgba?\(255,\s*255,\s*255/.test(c);
  if (!white(scan.htmlBg) && !white(scan.bodyBg)) issue('print', `${name}: de pagina drukt niet op wit (html ${scan.htmlBg}, body ${scan.bodyBg})`);
  if (scan.scheme !== 'light') issue('print', `${name}: color-scheme is '${scan.scheme}' onder print; Chromium schildert de paginarand dan zwart (print.css zet light)`);
  for (const d of scan.dark) issue('print', `${name}: donker vlak in de afdruk: ${d}`);
  for (const l of scan.light) issue('print', `${name}: lichte tekst in de afdruk: ${l}`);
  if (scan.strip) issue('print', `${name}: de strip (uithangbord) staat in de afdruk`);
  if (scan.foot) issue('print', `${name}: de voet staat in de afdruk`);
  if (scan.canvas) issue('print', `${name}: de scène-canvas staat in de afdruk`);
  for (const o of scan.outside) issue('print', `${name}: zichtbaar buiten het afdrukblok: ${o}`);
  if (pages) {
    if (opts.pages && pages.pages !== opts.pages) issue('print', `${name}: ${pages.pages} PDF-pagina's, verwacht ${opts.pages}`);
    if (opts.size) for (const b of pages.boxes) if (!near(b.w, opts.size.w) || !near(b.h, opts.size.h)) issue('print', `${name}: PDF-pagina ${Math.round(b.w)}x${Math.round(b.h)} pt, verwacht ${Math.round(opts.size.w)}x${Math.round(opts.size.h)} (@page ${opts.page})`);
  }
  return { scan, pdf: pages, shot, pdfFile: pdf };
}

/** The four prints of gereedschap.html on desktop: the A6 QR card, the toog card (two A6 sides), the ?print one-pager
 *  and the plain page. Returns the record for the report. */
export async function printScenario(browser, env, issue) {
  const page = 'gereedschap.html';
  const rec = { page, cases: {} };
  const ctx = await browser.newContext(contextOptions('desktop', 'default'));
  await ctx.addInitScript(initScript, { hardwareConcurrency: PROFILES.desktop.hardwareConcurrency, intro: false });
  await stubPrint(ctx);
  const tab = await ctx.newPage();
  const errors = [];
  tab.on('pageerror', e => errors.push(String(e.message || e)));
  await tab.route('**/*', r => env.routeLocal(r));
  try {
    // 1. the A6 QR card: a number in, the card drawn, 'Druk af op A6' through printBlock
    await tab.goto(env.base + page, { waitUntil: 'load', timeout: 30000 });
    await tab.fill('#wa-num', '0470 12 34 56');
    await tab.waitForFunction(() => { const c = document.getElementById('wa-a6'); return !!c && c.width === 1240; }, null, { timeout: 8000 }).catch(() => issue('print', 'a6: het kaartje is niet getekend (canvas 1240 px breed verwacht)'));
    await tab.waitForTimeout(400);
    await tab.click('#wa-a6-print');
    await tab.waitForTimeout(300);
    const a6 = await capture(tab, env, 'a6', { only: '.a6-wrap', pages: 1, size: A6, page: 'a6' }, issue);
    rec.cases.a6 = a6;
    if (!/\bprint-a6\b/.test(a6.scan.htmlClass)) issue('print', 'a6: html.print-a6 ontbreekt na de klik op Druk af op A6');
    if (a6.scan.printed !== 1) issue('print', `a6: window.print ${a6.scan.printed}x geroepen, verwacht 1`);
    if (!a6.scan.a6) issue('print', 'a6: de kaartcanvas is niet zichtbaar in de afdruk');
    else if (!near(a6.scan.a6.w, 105 * PX, 4) || !near(a6.scan.a6.h, 148 * PX, 4)) issue('print', `a6: de kaart meet ${a6.scan.a6.w}x${a6.scan.a6.h} px, verwacht ${Math.round(105 * PX)}x${Math.round(148 * PX)} (105x148 mm)`);
    // afterprint puts the block back and drops the class
    await tab.evaluate(() => dispatchEvent(new Event('afterprint')));
    const back = await tab.evaluate(() => ({ cls: document.documentElement.className, home: !!document.querySelector('#wa-out .a6-wrap') }));
    if (/\bprint-a6\b/.test(back.cls) || !back.home) issue('print', `a6: na afterprint staat het kaartje niet terug op zijn plaats (class '${back.cls}', terug ${back.home})`);

    // 2. the toog card (?toog=1): front and back, two A6 pages
    await tab.goto(env.base + page + '?toog=1', { waitUntil: 'load', timeout: 30000 });
    const hasToog = await tab.evaluate(() => !!document.querySelector('[data-toog-print]'));
    if (!hasToog) issue('print', 'toog: gereedschap.html?toog=1 toont het kaartje voor aan de toog niet');
    else {
      await tab.fill('#toog [name=zaak]', 'Bakkerij Proef').catch(() => tab.fill('[data-toog-form] [name=zaak]', 'Bakkerij Proef'));
      await tab.waitForTimeout(300);
      await tab.click('[data-toog-print]');
      await tab.waitForTimeout(300);
      const toog = await capture(tab, env, 'toog', { only: '.toog-kaart', pages: 2, size: A6, page: 'a6' }, issue);
      rec.cases.toog = toog;
      if (toog.scan.toog.length !== 2) issue('print', `toog: ${toog.scan.toog.length} zijden zichtbaar, verwacht 2`);
      for (const s of toog.scan.toog) if (!near(s.w, 105 * PX, 4) || !near(s.h, 148 * PX, 4)) issue('print', `toog: een zijde meet ${s.w}x${s.h} px, verwacht ${Math.round(105 * PX)}x${Math.round(148 * PX)}`);
      await tab.evaluate(() => dispatchEvent(new Event('afterprint')));
    }

    // 3. the one-pager (?print): one A4, black on white, the QR drawn
    await tab.goto(env.base + page + '?print', { waitUntil: 'load', timeout: 30000 });
    await tab.waitForTimeout(500);
    const een = await capture(tab, env, 'eenpager', { pages: 1, size: A4, page: 'a4' }, issue);
    rec.cases.eenpager = een;
    if (!/\bis-eenpager\b/.test(een.scan.htmlClass)) issue('print', 'eenpager: html.is-eenpager ontbreekt bij ?print');
    if (!een.scan.eenpager) issue('print', 'eenpager: het blad is niet zichtbaar in de afdruk');
    if (!een.scan.qr || een.scan.qr.w < 80) issue('print', `eenpager: de QR-code ontbreekt of is te klein (${een.scan.qr ? een.scan.qr.w + ' px' : 'geen canvas'})`);
    const lokets = await tab.evaluate(() => [...document.querySelectorAll('.loket')].filter(el => el.getBoundingClientRect().height > 0).length);
    if (lokets) issue('print', `eenpager: ${lokets} loketten blijven zichtbaar naast het blad`);

    // 4. the plain page: whatever the visitor prints from the browser menu
    await tab.goto(env.base + page, { waitUntil: 'load', timeout: 30000 });
    await tab.waitForTimeout(400);
    rec.cases.plain = await capture(tab, env, 'gereedschap', { size: null, page: 'standaard' }, issue);
  } catch (e) { issue('print', `afdrukken niet gemeten: ${e.message}`, 'fail'); }
  for (const e of errors) issue('print', `paginafout tijdens het afdrukken: ${e}`, 'fail');
  await ctx.close();
  return rec;
}
