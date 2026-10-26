// Renders src/og.html to docs/assets/img/og.png (1200x630, the link-preview image), with Playwright's Chromium.
// Usage: node scripts/og-render.mjs            (from the repository root; needs `npm ci` and the Chromium of
//                                               `npx playwright install chromium` or PLAYWRIGHT_BROWSERS_PATH)
// The page is opened from disk (file://), so fonts and the SVG skyline come through the relative paths in og.html;
// no server is involved. Exit 1 when the PNG is not 1200x630 or weighs 300 kB or more (WP-12 acceptance).
import { chromium } from 'playwright';
import { statSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const SRC = resolve(ROOT, 'src', 'og.html');
const OUT = resolve(ROOT, 'docs', 'assets', 'img', 'og.png');
const MAX_BYTES = 300 * 1024;

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, colorScheme: 'dark' });
  await page.goto(pathToFileURL(SRC).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);   // the SVG <img> paints after load; one short beat is enough
  const fonts = await page.evaluate(() => [['Panchang', '700'], ['Switzer', '400'], ['JetBrains Mono', '500']].map(([f, w]) => `${f}: ${document.fonts.check(`${w} 16px "${f}"`) ? 'ok' : 'ONTBREEKT'}`));
  await page.screenshot({ path: OUT, type: 'png', clip: { x: 0, y: 0, width: 1200, height: 630 } });
  const png = readFileSync(OUT);
  const w = png.readUInt32BE(16), h = png.readUInt32BE(20), bytes = statSync(OUT).size;
  console.log(`og.png: ${w}x${h}, ${(bytes / 1024).toFixed(1)} kB; fonts: ${fonts.join(', ')}`);
  if (w !== 1200 || h !== 630) { console.error('og.png heeft niet de maat 1200x630'); process.exitCode = 1; }
  if (bytes >= MAX_BYTES) { console.error(`og.png weegt ${bytes} bytes, de grens is ${MAX_BYTES}`); process.exitCode = 1; }
  if (fonts.some(f => f.includes('ONTBREEKT'))) { console.error('een font laadde niet; controleer de paden in src/og.html'); process.exitCode = 1; }
} finally {
  await browser.close();
}
