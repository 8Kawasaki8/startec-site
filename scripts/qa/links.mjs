// WP-22: static link checker on the built site (docs/). Runs inside npm run lint and in the lint block of
// npm run qa, and on its own: node scripts/qa/links.mjs [--json] [--verbose]. Exit 1 on a broken link.
// For every built page (docs/*.html, docs/wijk, docs/dev, docs/demo/**; the QA report is skipped) it reads
// every href, src, srcset, poster, action, xlink:href and the meta refresh / og:image / twitter:image
// addresses, resolves them against the page (and its <base href>, which 404.html carries), and checks:
//  - a same-site address (relative, or absolute under PAGES_BASE) names a file that exists in docs/; a
//    folder resolves to its index.html;
//  - a fragment (#id) names an id or <a name> in the target document; '#' alone is a script hook and is
//    skipped; a query after the fragment ('#bericht?onderwerp=...') is carried state and is stripped;
//  - a legacy fragment that uithangbord.js maps to a room (LEGACY in that file, e.g. #contact -> #bericht)
//    resolves through that map and is reported as a notice, so the legal pages keep their wording until the
//    founder agrees to the href change (docs/CHECKLIST-SAKI.md C.6);
//  - an address on another host is listed as a notice (the harness forbids requests, not references; the
//    legal pages name the ombudsman and the data-protection authority).
// Scripts, stylesheets and fonts referenced from CSS or JavaScript are the business of perf.mjs (checkAssets)
// and the runtime matrix; this file reads markup only.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, basename, posix } from 'node:path';
import { PAGES_BASE } from './profiles.mjs';

const ROOT = process.cwd(), DOCS = join(ROOT, 'docs');
const SKIP_SCHEMES = /^(mailto|tel|sms|javascript|data|blob|whatsapp):/i;
const URL_ATTRS = ['href', 'src', 'poster', 'action', 'xlink:href', 'data'];

/** Every built HTML page under docs/, relative with forward slashes; the QA report is a generated page. */
export function builtPages(dir = '', out = []) {
  for (const f of readdirSync(join(DOCS, dir)).sort()) {
    const rel = dir ? `${dir}/${f}` : f;
    if (statSync(join(DOCS, rel)).isDirectory()) { if (!['assets', 'vendor'].includes(f)) builtPages(rel, out); }
    else if (f.endsWith('.html') && rel !== 'qa-report.html') out.push(rel);
  }
  return out;
}

/** The legacy fragment map of uithangbord.js (LEGACY = { contact: "bericht", ... }). */
export function legacyMap() {
  const src = readFileSync(join(DOCS, 'assets/js/uithangbord.js'), 'utf8');
  const m = /LEGACY\s*=\s*\{([^}]*)\}/.exec(src), out = {};
  if (m) for (const [, k, v] of m[1].matchAll(/(\w+)\s*:\s*"(\w+)"/g)) out[k] = v;
  return out;
}

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const attrsOf = (tag) => { const o = {}; for (const m of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) o[m[1].toLowerCase()] = decode(m[2]); return o; };

/** All addresses a page references in its markup: [{ attr, value, line }]. */
export function pageRefs(src) {
  const refs = [], push = (attr, value, line) => { if (value && value.trim()) refs.push({ attr, value: value.trim(), line }); };
  for (const m of src.matchAll(/<([a-zA-Z][\w:-]*)\b([^>]*)>/g)) {
    const tag = m[1].toLowerCase(), a = attrsOf(m[2]), line = src.slice(0, m.index).split('\n').length;
    if (tag === 'base') continue;   // handled by the caller
    for (const k of URL_ATTRS) if (a[k] !== undefined) push(k, a[k], line);
    if (a.srcset) for (const c of a.srcset.split(',')) push('srcset', c.trim().split(/\s+/)[0], line);
    if (tag === 'meta') {
      if (/^refresh$/i.test(a['http-equiv'] || '')) { const u = /url=(.*)$/i.exec(a.content || ''); if (u) push('meta refresh', u[1].trim(), line); }
      if (/^(og:image|twitter:image)$/.test(a.property || a.name || '')) push(a.property || a.name, a.content, line);
    }
  }
  return refs;
}

const ids = new Map();
function idsOf(rel) {
  if (!ids.has(rel)) {
    const src = readFileSync(join(DOCS, rel), 'utf8'), set = new Set();
    for (const m of src.matchAll(/\s(?:id|name)="([^"]+)"/g)) set.add(m[1]);
    ids.set(rel, set);
  }
  return ids.get(rel);
}

/** Resolve one reference from `page` (with optional <base href>) to { kind, target, hash } . */
export function resolveRef(page, baseHref, value) {
  if (SKIP_SCHEMES.test(value)) return { kind: 'scheme' };
  if (value === '#') return { kind: 'hook' };
  const [beforeHash, ...rest] = value.split('#');
  const hash = rest.length ? rest.join('#').replace(/\?.*$/, '') : null;
  let path = beforeHash.replace(/\?.*$/, '');
  if (!path) return { kind: 'local', target: page, hash };   // '#id' on the page itself
  if (path.startsWith(PAGES_BASE)) path = path.slice(PAGES_BASE.length);
  else if (/^(https?:)?\/\//i.test(path)) return { kind: 'external', target: path };
  else if (path.startsWith('/')) return { kind: 'rooted', target: path };   // Pages serves a subpath: never root-relative
  else {
    const dir = baseHref && baseHref.startsWith(PAGES_BASE) ? posix.dirname(baseHref.slice(PAGES_BASE.length) || 'index.html') : posix.dirname(page);
    path = posix.normalize(posix.join(dir === '.' ? '' : dir, path));
  }
  if (path === '' || path === '.' || path.endsWith('/')) path = posix.join(path === '.' ? '' : path, 'index.html');
  return { kind: 'local', target: decodeURIComponent(path), hash };
}

export function linkCheck({ verbose = false } = {}) {
  const fails = [], notes = [], pages = builtPages(), legacy = legacyMap();
  const externals = new Map();
  let refs = 0, anchors = 0;
  for (const page of pages) {
    const src = readFileSync(join(DOCS, page), 'utf8');
    const baseHref = (/<base\s+href="([^"]*)"/.exec(src) || [])[1];
    if (baseHref && !baseHref.startsWith(PAGES_BASE)) fails.push({ page, text: `<base href="${baseHref}"> wijst niet naar ${PAGES_BASE}` });
    for (const r of pageRefs(src)) {
      refs++;
      const res = resolveRef(page, baseHref, r.value);
      if (res.kind === 'scheme' || res.kind === 'hook') continue;
      if (res.kind === 'external') { externals.set(res.target, (externals.get(res.target) || 0) + 1); continue; }
      if (res.kind === 'rooted') { fails.push({ page, text: `regel ${r.line}: ${r.attr}="${r.value}" is een adres vanaf de root; de site staat onder een subpad` }); continue; }
      if (res.target.startsWith('..')) { fails.push({ page, text: `regel ${r.line}: ${r.attr}="${r.value}" wijst buiten docs/` }); continue; }
      const file = join(DOCS, res.target);
      if (!existsSync(file) || statSync(file).isDirectory()) { fails.push({ page, text: `regel ${r.line}: ${r.attr}="${r.value}" -> docs/${res.target} bestaat niet` }); continue; }
      if (res.hash === null || res.hash === undefined) continue;
      if (!res.target.endsWith('.html')) continue;   // a fragment on an image or SVG file (sprite) is not a page anchor
      anchors++;
      const set = idsOf(res.target);
      if (set.has(res.hash)) continue;
      if (legacy[res.hash] && set.has(legacy[res.hash])) { notes.push(`${page}: regel ${r.line}: #${res.hash} bestaat niet op ${res.target}; uithangbord.js stuurt het door naar #${legacy[res.hash]} (CHECKLIST-SAKI C.6)`); continue; }
      fails.push({ page, text: `regel ${r.line}: ${r.attr}="${r.value}": geen element met id of name '${res.hash}' op docs/${res.target}` });
    }
  }
  for (const [host, n] of [...externals].sort()) notes.push(`extern adres in de opmaak (${n}x): ${host}`);
  if (verbose) notes.push(`${pages.length} pagina's, ${refs} verwijzingen, ${anchors} ankers`);
  return { pages: pages.length, refs, anchors, fails, notes };
}

if (process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))) {
  const r = linkCheck({ verbose: process.argv.includes('--verbose') });
  if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 2));
  else { for (const n of r.notes) console.log(`       ${n}`); for (const f of r.fails) console.log(`FOUT   ${f.page}: ${f.text}`); }
  console.log(`\nlinks: ${r.pages} pagina's, ${r.refs} verwijzingen, ${r.anchors} ankers, ${r.fails.length} gebroken`);
  process.exit(r.fails.length ? 1 : 0);
}
