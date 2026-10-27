// WP-26: static audit of CSS and JS features newer than the support floor (Safari 15.4 / Chrome 100), with the
// fallback each one has. Pure node, no browser. `auditFeatures(root)` returns { rows, issues }: one row per feature
// (where it occurs, how it degrades) and an issue (severity notice) for every occurrence that lacks the fallback the
// table demands. The table is the list in scripts/qa/README.md; keep the two in step.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** CSS features. need: 'fallback' (a same-property declaration must precede it, in the rule or in base.css for the same
 *  selector), 'none' (drops harmlessly or is supported at the floor), 'prefix' (a -webkit- twin must sit beside it). */
export const CSS_FEATURES = [
  { id: 'viewport-units', re: /\b\d+(?:\.\d+)?(?:dvh|svh|lvh|dvw|svw|lvw)\b/g, since: 'Safari 15.4, Chrome 108', need: 'fallback', how: 'dezelfde eigenschap eerst in vh/vw (zelfde regel, of base.css voor dezelfde selector)' },
  { id: 'color-mix', re: /color-mix\(/g, since: 'Safari 16.2, Chrome 111', need: 'fallback', how: 'dezelfde eigenschap eerst zonder color-mix' },
  { id: 'has', re: /:has\(/g, since: 'Safari 15.4, Chrome 105', need: 'forbid', how: 'niet gebruiken: de hele selector valt weg' },
  { id: 'container', re: /@container\b/g, since: 'Safari 16, Chrome 105', need: 'forbid', how: 'niet gebruiken' },
  { id: 'layer', re: /@layer\b/g, since: 'Safari 15.4, Chrome 99', need: 'forbid', how: 'niet gebruiken' },
  { id: 'nesting', re: /^\s*&[.:#\[ ]/gm, since: 'Safari 17.2, Chrome 120', need: 'forbid', how: 'niet gebruiken (geneste @media mag, geneste selectors niet)' },
  { id: 'property', re: /@property\b/g, since: 'Safari 16.4, Chrome 85', need: 'forbid', how: 'niet gebruiken' },
  { id: 'text-wrap', re: /text-wrap\s*:/g, since: 'Safari 17.5, Chrome 114', need: 'none', how: 'valt weg: gewone regelafbreking' },
  { id: 'scrollbar', re: /scrollbar-(?:width|color)\s*:/g, since: 'Safari 18.2, Chrome 121', need: 'none', how: 'valt weg: de standaard schuifbalk (::-webkit-scrollbar staat ernaast)' },
  { id: 'hyphens', re: /(?<!-)\bhyphens\s*:\s*auto/g, since: 'Safari 17 zonder prefix', need: 'prefix', how: '-webkit-hyphens ernaast' },
  { id: 'inset', re: /\binset\s*:/g, since: 'Safari 14.1, Chrome 87', need: 'none', how: 'onder de vloer, geen terugval nodig' },
  { id: 'aspect-ratio', re: /aspect-ratio\s*:/g, since: 'Safari 15, Chrome 88', need: 'none', how: 'onder de vloer' },
  { id: 'overflow-wrap-anywhere', re: /overflow-wrap\s*:\s*anywhere/g, since: 'Safari 15.4, Chrome 80', need: 'none', how: 'op de vloer; valt anders terug op normal' },
  { id: 'focus-visible', re: /:focus-visible/g, since: 'Safari 15.4, Chrome 86', need: 'none', how: 'op de vloer; eronder blijft de UA-focusring' },
  { id: 'size-adjust', re: /(?:size-adjust|ascent-override|descent-override|line-gap-override)\s*:/g, since: 'Safari 17, Chrome 92', need: 'none', how: 'valt weg: het lokale terugvalfont zonder metriek-correctie' },
  { id: 'mask-image', re: /(?<!-webkit-)\bmask-image\s*:/g, since: 'Safari 15.4 (prefix), Chrome 120', need: 'prefix', how: '-webkit-mask-image ernaast' },
];

/** JS features. need: 'guard' (the line must test for the feature), 'forbid' (never), 'none' (at or under the floor). */
export const JS_FEATURES = [
  { id: 'structuredClone', re: /\bstructuredClone\(/g, since: 'Safari 15.4, Chrome 98', need: 'forbid', how: 'niet gebruiken' },
  { id: 'array-at', re: /\.at\(\s*-?\d/g, since: 'Safari 15.4, Chrome 92', need: 'forbid', how: 'niet gebruiken: slice of een index' },
  { id: 'top-level-await', re: /^await\s/gm, since: 'Safari 15, Chrome 89', need: 'forbid', how: 'niet gebruiken in de modules' },
  { id: 'importmap', re: /type=["']importmap["']/g, since: 'Safari 16.4, Chrome 89', need: 'forbid', how: 'niet gebruiken: relatieve imports' },
  { id: 'lookbehind', re: /\(\?<[=!]/g, since: 'Safari 16.4, Chrome 62', need: 'forbid', how: 'niet gebruiken: een regex met lookbehind breekt het hele script bij het parsen' },
  { id: 'private-fields', re: /(?:^|[^\w$])this\.#\w|^\s+#\w+\s*[=;(]|static\s*\{/gm, since: 'Safari 14.1 / 16.4 (static blocks), Chrome 94', need: 'forbid', how: 'niet gebruiken' },
  { id: 'logical-assign', re: /(?:\?\?|\|\||&&)=/g, since: 'Safari 14, Chrome 85', need: 'none', how: 'onder de vloer' },
  { id: 'new-array-methods', re: /\.(?:toSorted|toReversed|toSpliced|findLast|findLastIndex|group|groupBy)\(/g, since: 'Safari 15.4 / 16, Chrome 97 / 110', need: 'forbid', how: 'niet gebruiken' },
  { id: 'object-hasown', re: /Object\.hasOwn\(/g, since: 'Safari 15.4, Chrome 93', need: 'forbid', how: 'hasOwnProperty' },
  { id: 'roundRect', re: /\.roundRect\(/g, since: 'Safari 16, Chrome 99', need: 'guard', how: 'if (ctx.roundRect) ... else rect' },
  { id: 'requestIdleCallback', re: /requestIdleCallback\(/g, since: 'Safari 18, Chrome 47', need: 'guard', how: 'setTimeout als terugval' },
  { id: 'OffscreenCanvas', re: /\bOffscreenCanvas\b/g, since: 'Safari 16.4, Chrome 69', need: 'forbid', how: 'niet gebruiken' },
  { id: 'checkVisibility', re: /\.checkVisibility\(/g, since: 'Safari 17.4, Chrome 105', need: 'forbid', how: 'getBoundingClientRect + getComputedStyle' },
  { id: 'scrollend', re: /["']scrollend["']/g, since: 'Chrome 114, Safari geen', need: 'forbid', how: 'scroll + timeout' },
  { id: 'PerformanceObserver', re: /new PerformanceObserver\(/g, since: 'longtask: Chrome 58, Safari geen', need: 'guard', how: 'try/catch rond observe (signdom.js countLongTasks)' },
  { id: 'navigator-share', re: /navigator\.share\b/g, since: 'Safari 12.1, Chrome 89 (desktop)', need: 'guard', how: 'if (navigator.share) ... else klembord of tonen' },
  { id: 'clipboard', re: /navigator\.clipboard\b/g, since: 'Safari 13.1, Chrome 66', need: 'guard', how: 'if (navigator.clipboard && writeText) ... else selecteren' },
  { id: 'visualViewport', re: /window\.visualViewport\b/g, since: 'Safari 13, Chrome 61', need: 'guard', how: 'if (vv) ...' },
  { id: 'IntersectionObserver', re: /new IntersectionObserver\(/g, since: 'Safari 12.2, Chrome 51', need: 'none', how: 'onder de vloer; reveal.js en uithangbord.js testen het toch' },
  { id: 'nullish', re: /\?\?(?!=)/g, since: 'Safari 13.1, Chrome 80', need: 'none', how: 'onder de vloer' },
  { id: 'optional-chaining', re: /\?\.\w/g, since: 'Safari 13.1, Chrome 80', need: 'none', how: 'onder de vloer' },
  { id: 'queueMicrotask', re: /queueMicrotask\(/g, since: 'Safari 12.1, Chrome 71', need: 'none', how: 'onder de vloer' },
  { id: 'dynamic-import', re: /\bimport\(/g, since: 'Safari 11.1, Chrome 63', need: 'none', how: 'onder de vloer; alleen op de GL-route' },
];

function walk(dir, ext, out = []) {
  for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) walk(p, ext, out); else if (f.endsWith(ext)) out.push(p); }
  return out;
}

/** Rough CSS rule split: [{selector, decls:[{prop, value}], file, line}] (nested @media bodies are flattened). */
function cssRules(text, file) {
  const rules = [];
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(clean))) {
    const sel = m[1].trim().split('\n').pop().trim();
    if (!sel || sel.startsWith('@')) continue;
    const line = clean.slice(0, m.index).split('\n').length;
    const decls = m[2].split(';').map(d => d.trim()).filter(Boolean).map(d => { const i = d.indexOf(':'); return { prop: d.slice(0, i).trim(), value: d.slice(i + 1).trim() }; });
    rules.push({ selector: sel, decls, file, line });
  }
  return rules;
}

/** Does `decl` in `rule` have a fallback: an earlier declaration of the same property in the rule, or one in base.css
 *  (the shared file, loaded first) for the identical selector? */
function hasFallback(rule, idx, baseRules, test, ownRules) {
  const prop = rule.decls[idx].prop;
  for (let i = 0; i < idx; i++) if (rule.decls[i].prop === prop && !test(rule.decls[i].value)) return true;
  const sameSel = (b) => b.selector.split(',').map(s => s.trim()).includes(rule.selector) || b.selector === rule.selector;
  const plain = (b) => b.decls.some(d => d.prop === prop && !test(d.value));
  // an earlier rule in the same file for the same selector (rooms.css writes .buur-gevel twice), or base.css
  if (ownRules.some(b => b !== rule && b.line < rule.line && sameSel(b) && plain(b))) return true;
  return baseRules.some(b => sameSel(b) && plain(b));
}

export function auditFeatures(root = process.cwd()) {
  const cssDir = join(root, 'docs', 'assets', 'css'), jsDir = join(root, 'docs', 'assets', 'js');
  const cssFiles = walk(cssDir, '.css'), jsFiles = walk(jsDir, '.js');
  const rows = [], issues = [];
  const rel = (p) => relative(root, p).split('\\').join('/');
  const baseRules = cssRules(readFileSync(join(cssDir, 'base.css'), 'utf8'), 'base.css');
  for (const f of CSS_FEATURES) {
    const where = [];
    for (const file of cssFiles) {
      const text = readFileSync(file, 'utf8');
      const n = (text.match(f.re) || []).length;
      if (!n) continue;
      where.push(`${rel(file)} (${n})`);
      if (f.need === 'forbid') issues.push({ check: 'audit', text: `${rel(file)}: ${f.id} (${f.since}) ${n}x; ${f.how}`, severity: 'notice' });
      if (f.need === 'prefix') {
        const lines = text.split('\n');
        lines.forEach((l, i) => { if (f.re.test(l) && !/-webkit-/.test(l)) issues.push({ check: 'audit', text: `${rel(file)}:${i + 1}: ${f.id} zonder -webkit- twin`, severity: 'notice' }); f.re.lastIndex = 0; });
      }
      if (f.need === 'fallback') {
        const test = (v) => { f.re.lastIndex = 0; const hit = f.re.test(v); f.re.lastIndex = 0; return hit; };
        const own = cssRules(text, rel(file));
        for (const rule of own) rule.decls.forEach((d, i) => {
          if (test(d.value) && !hasFallback(rule, i, baseRules, test, own)) issues.push({ check: 'audit', text: `${rule.file}:${rule.line} ${rule.selector}{${d.prop}:${d.value}}: ${f.id} zonder terugval (${f.how})`, severity: 'notice' });
        });
      }
    }
    rows.push({ kind: 'css', id: f.id, since: f.since, need: f.need, how: f.how, where });
  }
  for (const f of JS_FEATURES) {
    const where = [];
    for (const file of jsFiles) {
      // block comments blanked (line count kept), line comments dropped: only code is audited
      const lines = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).split('\n');
      let n = 0;
      lines.forEach((l, i) => {
        if (/^\s*\/\//.test(l)) return;
        f.re.lastIndex = 0; if (!f.re.test(l)) return; f.re.lastIndex = 0;
        n++;
        if (f.need === 'forbid') issues.push({ check: 'audit', text: `${rel(file)}:${i + 1}: ${f.id} (${f.since}); ${f.how}`, severity: 'notice' });
        if (f.need === 'guard') {
          const ctx = lines.slice(Math.max(0, i - 3), i + 3).join('\n');   // the test may sit on the line after an assignment
          const assigned = /(?:var|let|const)\s+(\w+)\s*=\s*(?:window\.)?\w+(?:\.\w+)?\s*[,;]/.exec(l);   // var vv = window.visualViewport: tested later as if (vv)
          const tested = assigned && new RegExp(`(?:if \\(!?${assigned[1]}\\b|\\b${assigned[1]} &&|!${assigned[1]}\\b)`).test(lines.join('\n'));
          if (!tested && !/\b(if|try|typeof|&&|\?|in window)\b/.test(ctx)) issues.push({ check: 'audit', text: `${rel(file)}:${i + 1}: ${f.id} zonder test ervoor (${f.how})`, severity: 'notice' });
        }
      });
      if (n) where.push(`${rel(file)} (${n})`);
    }
    rows.push({ kind: 'js', id: f.id, since: f.since, need: f.need, how: f.how, where });
  }
  // the vendor build of three.js is reported, never gated: its syntax floor is what it is
  const three = join(root, 'docs', 'assets', 'vendor', 'three.module.min.js');
  try {
    const t = readFileSync(three, 'utf8');
    const syntax = { 'private-fields': /this\.#\w/.test(t), 'static-block': /static\{/.test(t), 'top-level-await': /^await /m.test(t), 'lookbehind': /\(\?<[=!]/.test(t), 'array-at': /\.at\(-?\d/.test(t), structuredClone: /structuredClone/.test(t) };
    rows.push({ kind: 'vendor', id: 'three.module.min.js', since: 'gemeld', need: 'none', how: Object.entries(syntax).map(([k, v]) => `${k} ${v ? 'ja' : 'nee'}`).join(', '), where: ['docs/assets/vendor/three.module.min.js'] });
  } catch (e) { /* no vendor three */ }
  return { rows, issues };
}

/** Markdown table for the README. */
export function auditTable(rows) {
  const line = (r) => `| ${r.kind} | ${r.id} | ${r.since} | ${r.where.length ? r.where.join(', ') : 'nergens'} | ${r.how} |`;
  return ['| soort | kenmerk | sinds | waar | terugval |', '| --- | --- | --- | --- | --- |', ...rows.map(line)].join('\n');
}
