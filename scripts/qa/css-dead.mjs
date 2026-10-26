// Dead CSS finder (WP-16): lists every selector in docs/assets/css/*.css that matches no element on any built page.
// Usage: node scripts/qa/css-dead.mjs [--json] [--port 8941] [--all]
// Method: each rule's selector list is split at top-level commas; pseudo-elements and state pseudo-classes (:hover,
// :focus-visible, :checked, :target, ...) are stripped so the structural part can be tested with document.querySelector
// on every STS page in docs/ (Chromium, phone and desktop, after a scroll pass so reveal.js has added its classes).
// An unmatched selector whose classes, ids and attributes all occur in a script, a page, a partial, a room, a build
// script or an inline SVG counts as 'dynamic' (toggled by JavaScript or by state; reported, not deleted). Only a selector
// with a token that occurs nowhere outside the CSS itself is 'dead'. ALLOW names selectors kept on purpose, with the
// reason. Exit 1 when a dead selector exists outside ALLOW.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, basename } from 'node:path';

const ROOT = process.cwd();
const DOCS = join(ROOT, 'docs');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

/** Selectors that match nothing today and stay, each with its reason. */
export const ALLOW = {
  'html.js [data-reveal]': 'reveal.js: data-reveal is the documented attribute next to .rv; a room may use it',
  'html.js [data-reveal].in': 'reveal.js: see data-reveal',
};
const STATE = /:(hover|focus-visible|focus-within|focus|active|visited|target|checked|disabled|enabled|placeholder-shown|invalid|valid|required|optional|read-only|open|link|any-link|indeterminate|default|autofill|fullscreen)\b/g;

function walk(dir, ext, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { if (!['node_modules', '.git', 'vendor', 'fonts', '__pycache__'].includes(f)) walk(p, ext, out); }
    else if (ext.some(e => f.endsWith(e))) out.push(p);
  }
  return out;
}

/** Rules of one stylesheet: [{ selector, line }] with the structural selector to test and the raw one to report. */
export function parseSelectors(css) {
  const out = [];
  const src = css.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));   // keep line numbers
  const stack = [];   // nesting: 'cond' (media/supports/layer) or 'skip' (font-face, keyframes, page)
  let buf = '', line = 1, start = 1;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '\n') line++;
    if (ch === '{') {
      const head = buf.trim(); buf = '';
      if (head.startsWith('@')) stack.push(/^@(media|supports|layer|container)/.test(head) ? 'cond' : 'skip');
      else { stack.push('rule'); if (!stack.includes('skip')) for (const s of splitTop(head)) out.push({ raw: s.trim(), line: start }); }
      start = line;
    } else if (ch === '}') { stack.pop(); buf = ''; start = line; }
    else { if (!buf.trim()) start = line; buf += ch; }
  }
  return out;
}
function splitTop(s) {
  const parts = []; let depth = 0, cur = '';
  for (const ch of s) { if (ch === '(' || ch === '[') depth++; if (ch === ')' || ch === ']') depth--; if (ch === ',' && !depth) { parts.push(cur); cur = ''; } else cur += ch; }
  parts.push(cur);
  return parts.filter(p => p.trim());
}
/** The part of a selector that can be tested in a resting DOM. */
export function structural(sel) {
  let s = sel.replace(/::?-?[a-z-]+(\([^)]*\))?/gi, (m) => /^::/.test(m) || /^:(before|after|marker|selection|placeholder)$/.test(m) ? '' : m);
  s = s.replace(STATE, '');
  s = s.replace(/\s+>\s*$/, '').trim();
  return s || '*';
}
/** Is this class, id or attribute name born somewhere outside the CSS? Whole word; data-foo-bar also as dataset.fooBar;
 *  a hyphenated name also when its prefix is concatenated in a script ('mk-' + uit) and its suffix is a word there. */
export function known(t, corpus) {
  const word = (w) => new RegExp(`(^|[^\\w-])${w}([^\\w-]|$)`).test(corpus);
  if (word(t)) return true;
  if (t.startsWith('data-') && corpus.includes('dataset.' + t.slice(5).replace(/-([a-z])/g, (m, c) => c.toUpperCase()))) return true;
  const i = t.lastIndexOf('-');
  return i > 0 && new RegExp(`${t.slice(0, i + 1)}["'\`]\\s*\\+`).test(corpus) && word(t.slice(i + 1));
}
const tokens = (sel) => [...sel.matchAll(/[.#]([A-Za-z_][\w-]*)|\[([A-Za-z_][\w-]*)/g)].map(m => m[1] || m[2]);

async function main() {
  const req = createRequire(join(ROOT, 'package.json'));
  const { chromium } = req('playwright');
  const cssFiles = readdirSync(join(DOCS, 'assets', 'css')).filter(f => f.endsWith('.css')).map(f => join(DOCS, 'assets', 'css', f));
  const rules = [];
  for (const f of cssFiles) for (const r of parseSelectors(readFileSync(f, 'utf8'))) rules.push({ file: relative(ROOT, f), ...r, test: structural(r.raw) });
  const pages = walk(DOCS, ['.html']).map(p => relative(DOCS, p)).filter(p => !p.startsWith('demo/') && !p.startsWith('assets/'));
  // where a class, id or attribute may be born outside the CSS: scripts, inline SVG, sources, the build (not the QA harness)
  const corpus = [...walk(join(DOCS, 'assets', 'js'), ['.js']), ...walk(join(DOCS, 'assets', 'img'), ['.svg']), ...walk(join(ROOT, 'src'), ['.html', '.js', '.json']), ...walk(join(ROOT, 'scripts'), ['.py'])]
    .map(p => readFileSync(p, 'utf8')).join('\n');
  const port = Number(arg('--port', 8941));
  const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', DOCS], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 700));
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
  const matched = new Set();
  const tests = [...new Set(rules.map(r => r.test))];
  try {
    for (const profile of [{ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]) {
      const ctx = await browser.newContext({ ...profile, locale: 'nl-BE', colorScheme: 'dark' });
      await ctx.addInitScript(() => { try { sessionStorage.setItem('sts-pre', '1'); } catch (e) { /* blocked */ } });
      await ctx.route('**/*', r => /^https?:\/\/127\.0\.0\.1/.test(r.request().url()) ? r.continue() : r.abort());
      const tab = await ctx.newPage();
      for (const page of pages) {
        await tab.goto(`http://127.0.0.1:${port}/${page}`, { waitUntil: 'load' }).catch(() => {});
        await tab.waitForTimeout(400);
        await tab.evaluate(async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 30)); } scrollTo(0, 0); });
        const hits = await tab.evaluate((list) => list.filter(s => { try { return !!document.querySelector(s); } catch (e) { return true; } }), tests.filter(t => !matched.has(t)));
        for (const h of hits) matched.add(h);
      }
      await ctx.close();
    }
  } finally { await browser.close(); server.kill(); }
  const rows = rules.map(r => {
    if (matched.has(r.test)) return { ...r, status: 'live' };
    const missing = tokens(r.test).filter(t => !known(t, corpus));
    if (ALLOW[r.raw]) return { ...r, status: 'allowed', reason: ALLOW[r.raw] };
    return { ...r, status: missing.length ? 'dead' : 'dynamic', missing };
  });
  const dead = rows.filter(r => r.status === 'dead'), dyn = rows.filter(r => r.status === 'dynamic'), allowed = rows.filter(r => r.status === 'allowed');
  if (argv.includes('--json')) console.log(JSON.stringify({ pages: pages.length, rules: rules.length, dead, dynamic: dyn, allowed }, null, 1));
  else {
    console.log(`css-dead: ${rules.length} selectors in ${cssFiles.length} files, ${pages.length} pages; ${rules.length - dead.length - dyn.length - allowed.length} live, ${dyn.length} dynamic, ${allowed.length} allowed, ${dead.length} dead`);
    for (const r of dead) console.log(`DOOD     ${r.file}:${r.line}  ${r.raw}   (nergens: ${r.missing.join(', ')})`);
    if (argv.includes('--all')) for (const r of dyn) console.log(`dynamisch ${r.file}:${r.line}  ${r.raw}`);
    for (const r of allowed) console.log(`toegestaan ${r.file}:${r.line}  ${r.raw}  (${r.reason})`);
  }
  process.exit(dead.length ? 1 : 0);
}
if (process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))) main();
