// Static CSS lint for the weak-GPU rules.
// Usage: node scripts/qa/lint-css.mjs [files...] [--json]
// Default scope: docs/assets/css/*.css and src/**/*.css (never vendor, never docs/demo).
// Fails on: transition or @keyframes touching filter, backdrop-filter, box-shadow, background-position;
// 'transition: all'; a full-page mix-blend-mode; a DOM filter:url(#...) (liquid goo).
// Flags (known until WP-04, gate 'backdropFilter'): backdrop-filter in any non-legal CSS.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { classify, loadBudget } from './budget.mjs';

const ROOT = process.cwd();
export const HEAVY_PROPS = ['filter', 'backdrop-filter', 'box-shadow', 'background-position'];

function cssFiles(dir) {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return [];
  const out = [];
  for (const f of readdirSync(abs)) {
    const p = join(abs, f);
    if (statSync(p).isDirectory()) { if (f !== 'vendor' && f !== 'node_modules' && f !== 'demo') out.push(...cssFiles(join(dir, f))); }
    else if (f.endsWith('.css')) out.push(join(dir, f));
  }
  return out;
}

export function defaultFiles() {
  return [...cssFiles('docs/assets/css'), ...cssFiles('src')];
}

const lineAt = (src, idx) => src.slice(0, idx).split('\n').length;
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));

/** Lints one CSS file; returns raw issues. */
export function lintCss(file) {
  const raw = readFileSync(join(ROOT, file), 'utf8');
  const src = strip(raw);
  const issues = [];
  const push = (check, idx, text, extra = {}) => issues.push({ check, file, line: lineAt(src, idx), text, ...extra });
  const legal = /legal/.test(file);

  // transition shorthand or transition-property listing a heavy property
  const trans = /transition(?:-property)?\s*:\s*([^;}]*)/g;
  let m;
  while ((m = trans.exec(src))) {
    const props = m[1].split(',').map(s => s.trim().split(/\s+/)[0]).filter(Boolean);
    if (props.includes('all')) push('lint-css', m.index, `transition: all (noem de eigenschappen; nooit filter/box-shadow)`);
    for (const p of props) if (HEAVY_PROPS.includes(p) || p === '-webkit-backdrop-filter') push('lint-css', m.index, `transition op ${p}`);
  }
  // @keyframes blocks that set a heavy property
  const kf = /@keyframes\s+([\w-]+)\s*\{/g;
  while ((m = kf.exec(src))) {
    let depth = 1, k = m.index + m[0].length;
    for (; k < src.length && depth; k++) { if (src[k] === '{') depth++; else if (src[k] === '}') depth--; }
    const body = src.slice(m.index + m[0].length, k);
    for (const p of HEAVY_PROPS) {
      const re = new RegExp(`(?:^|[\\s;{])${p}\\s*:`, 'i');
      if (re.test(body)) push('lint-css', m.index, `@keyframes ${m[1]} animeert ${p}`);
    }
  }
  // DOM filter: url(#goo) etc.
  const goo = /(?:^|[\s;{])filter\s*:\s*url\(/g;
  while ((m = goo.exec(src))) push('lint-css', m.index, 'SVG-filter op een DOM-element (liquid/goo): te zwaar voor een zwakke GPU');
  // full-page blend modes
  const blend = /(?:html|body|\.page|main)[^{}]*\{[^{}]*mix-blend-mode\s*:\s*(?!normal)/g;
  while ((m = blend.exec(src))) push('lint-css', m.index, 'mix-blend-mode op een paginabrede laag');
  // backdrop-filter anywhere outside legal CSS (flag until WP-04)
  if (!legal) {
    const bf = /(?:^|[\s;{])backdrop-filter\s*:\s*(?!none)/g;
    while ((m = bf.exec(src))) push('backdrop-filter', m.index, 'backdrop-filter (nooit boven de canvas; vlak rgba-paneel met 1px lijn)');
  }
  // will-change on anything but transform/opacity
  const wc = /will-change\s*:\s*([^;}]*)/g;
  while ((m = wc.exec(src))) {
    const bad = m[1].split(',').map(s => s.trim()).filter(v => v && !['transform', 'opacity', 'auto'].includes(v));
    if (bad.length) push('lint-css', m.index, `will-change: ${bad.join(', ')} (alleen transform/opacity)`);
  }
  return issues;
}

export function lintCssFiles(files, { root = ROOT } = {}) {
  const budget = loadBudget(root);
  const results = [];
  for (const f of files) for (const raw of lintCss(f)) results.push(classify(raw, { root, budget, page: '' }));
  return results;
}

if (process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))) {
  const argv = process.argv.slice(2);
  const files = argv.filter(a => !a.startsWith('--'));
  const target = files.length ? files : defaultFiles();
  const results = lintCssFiles(target);
  if (argv.includes('--json')) console.log(JSON.stringify(results, null, 2));
  else {
    console.log(`lint-css: ${target.length} bestanden`);
    for (const r of results) console.log(`${r.severity === 'fail' ? 'FOUT  ' : 'BEKEND'} ${r.file}:${r.line} ${r.text}${r.wp ? ` [${r.wp}: ${r.note}]` : ''}`);
  }
  const fails = results.filter(r => r.severity === 'fail').length;
  console.log(`\nlint-css: ${fails} fout(en), ${results.length - fails} bekend (met WP), ${target.length} bestanden`);
  process.exit(fails ? 1 : 0);
}
