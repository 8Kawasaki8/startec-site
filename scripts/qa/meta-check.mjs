// WP-27: discoverability check on the built site (docs/). Runs after npm run build, inside npm run lint,
// and on its own: node scripts/qa/meta-check.mjs [--json]. Exit 1 on a failure. It checks:
//  - every page (docs/*.html, docs/wijk/*.html, docs/dev/*.html): one <title> under 60 characters and one
//    meta description under 155, both unique across the site; a canonical link; og:title, og:description,
//    og:image, og:url and twitter:card on every indexable page;
//  - every JSON-LD block parses, has @context and @type, carries no empty, null or placeholder value
//    ('TODO', 'xxx', '...', 'Straat 1') and no priceRange; index.html has a LocalBusiness, every wijk page a
//    BreadcrumbList whose last item is its own canonical address;
//  - sitemap.xml: every indexable page once, lastmod equal to 'updated:' in its front matter (src/pages or
//    src/templates/wijk.html), no 404, noindex or redirect page;
//  - every room (src/rooms/*.html) links to at least two other rooms, and every room link in a built page
//    points at an id that exists in the target page (no dead anchors).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { PAGES_BASE } from './profiles.mjs';

const ROOT = process.cwd(), DOCS = join(ROOT, 'docs');
export const TITLE_MAX = 60, DESC_MAX = 155;
const PLACEHOLDER = /\b(TODO|TBD|xxx+|lorem|placeholder|Straat 1\b|0123\.456\.789|voorbeeld@)/i;
// a room is reached by these addresses (from any page: the canonical page plus the hash; on index the bare hash)
export const ROOM_LINKS = {
  gevel: ['index.html#gevel', '#gevel'], telefoon: ['index.html#telefoon', '#telefoon'], buren: ['index.html#buren', '#buren'],
  verder: ['index.html#verder', '#verder'], bericht: ['index.html#bericht', '#bericht'],
  doorlichting: ['simulatie.html'], gereedschap: ['gereedschap.html'],
  radar: ['werkwijze.html#radar', '#radar'], straat: ['werkwijze.html#straat', '#straat'],
  kaart: ['werkwijze.html#kaart', '#kaart'], snymis: ['werkwijze.html#snymis', '#snymis'],
};
const ROOM_PAGE = { gevel: 'index', rit: 'index', telefoon: 'index', buren: 'index', verder: 'index', bericht: 'index', doorlichting: 'simulatie', gereedschap: 'gereedschap', radar: 'werkwijze', straat: 'werkwijze', kaart: 'werkwijze', snymis: 'werkwijze' };

const html = (rel) => readFileSync(join(DOCS, rel), 'utf8');
const files = (sub) => { const d = join(DOCS, sub); return existsSync(d) ? readdirSync(d).filter(f => f.endsWith('.html') && f !== 'qa-report.html').map(f => sub ? `${sub}/${f}` : f) : []; };
const attr = (tag, name) => (new RegExp(`\\s${name}="([^"]*)"`).exec(tag) || [])[1];
const metas = (src, key, val) => [...src.matchAll(/<meta\s[^>]*>/g)].map(m => m[0]).filter(t => attr(t, key) === val).map(t => attr(t, 'content'));
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

function frontMatter(file) {
  const m = /^\s*<!--([\s\S]*?)-->/.exec(readFileSync(file, 'utf8')), out = {};
  for (const line of (m ? m[1] : '').split('\n')) { const i = line.indexOf(':'); if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
  return out;
}
function walkJson(v, path, bad) {
  if (v === null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length)) bad.push(`${path} is leeg`);
  else if (typeof v === 'string') { if (PLACEHOLDER.test(v)) bad.push(`${path} ziet eruit als een plaatshouder: '${v}'`); }
  else if (typeof v === 'object') for (const [k, x] of Object.entries(v)) walkJson(x, `${path}.${k}`, bad);
}

export function metaCheck() {
  const fails = [], notes = [], pages = [...files(''), ...files('wijk'), ...files('dev')];
  const titles = new Map(), descs = new Map();
  const fail = (page, text) => fails.push({ page, text });
  for (const page of pages) {
    const src = html(page);
    const t = [...src.matchAll(/<title>([^<]*)<\/title>/g)].map(m => decode(m[1]));
    if (t.length !== 1) fail(page, `${t.length} <title>-elementen`);
    const title = t[0] || '';
    if (title.length >= TITLE_MAX) fail(page, `titel ${title.length} tekens (maximum ${TITLE_MAX - 1}): ${title}`);
    if (titles.has(title)) fail(page, `titel ook op ${titles.get(title)}: ${title}`); titles.set(title, page);
    const d = metas(src, 'name', 'description').map(decode);
    if (d.length !== 1) fail(page, `${d.length} meta descriptions`);
    const desc = d[0] || '';
    if (desc.length >= DESC_MAX) fail(page, `beschrijving ${desc.length} tekens (maximum ${DESC_MAX - 1})`);
    if (descs.has(desc)) fail(page, `beschrijving ook op ${descs.get(desc)}`); descs.set(desc, page);
    const noindex = /<meta name="robots" content="noindex/.test(src), redirect = /http-equiv="refresh"/.test(src);
    const canon = (/<link rel="canonical" href="([^"]*)"/.exec(src) || [])[1];
    if (!canon) fail(page, 'geen canonical');
    if (!noindex && !redirect) {
      if (canon !== PAGES_BASE + (page === 'index.html' ? '' : page)) fail(page, `canonical ${canon} wijst niet naar deze pagina`);
      for (const [k, v] of [['property', 'og:title'], ['property', 'og:description'], ['property', 'og:image'], ['property', 'og:url'], ['name', 'twitter:card'], ['name', 'twitter:title'], ['property', 'og:locale']]) if (metas(src, k, v).length !== 1) fail(page, `${v} ontbreekt of staat dubbel`);
      if (decode(metas(src, 'property', 'og:title')[0] || '') !== title) fail(page, 'og:title wijkt af van de titel');
    }
    const blocks = [...src.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => m[1]);
    const types = [];
    for (const b of blocks) {
      let j; try { j = JSON.parse(b); } catch (e) { fail(page, `JSON-LD is geen geldige JSON: ${e.message}`); continue; }
      if (!j['@context'] || !j['@type']) fail(page, 'JSON-LD zonder @context of @type');
      if (/priceRange|aggregateRating|review/.test(b)) fail(page, 'JSON-LD met prijs of beoordeling');
      const bad = []; walkJson(j, j['@type'], bad); for (const x of bad) fail(page, `JSON-LD: ${x}`);
      types.push(j['@type']);
      if (j['@type'] === 'BreadcrumbList') { const last = j.itemListElement[j.itemListElement.length - 1]; if (last.item !== canon) fail(page, `kruimelpad eindigt op ${last.item}, niet op de canonical`); }
    }
    if (page === 'index.html' && !types.includes('LocalBusiness')) fail(page, 'geen LocalBusiness in de JSON-LD');
    if (page.startsWith('wijk/') && !types.includes('BreadcrumbList')) fail(page, 'geen BreadcrumbList');
    if (!page.startsWith('wijk/') && page !== 'index.html' && types.length) notes.push(`${page}: JSON-LD ${types.join(', ')}`);
  }
  // sitemap against the front matter
  const sm = readFileSync(join(DOCS, 'sitemap.xml'), 'utf8');
  const entries = new Map([...sm.matchAll(/<loc>([^<]*)<\/loc><lastmod>([^<]*)<\/lastmod>/g)].map(m => [m[1], m[2]]));
  for (const page of pages) {
    const src = html(page), skip = /noindex|http-equiv="refresh"/.test(src) || page === '404.html';
    const loc = PAGES_BASE + (page === 'index.html' ? '' : page);
    if (skip) { if (entries.has(loc)) fail(page, 'staat in sitemap.xml maar is noindex, redirect of 404'); continue; }
    if (!entries.has(loc)) { fail(page, 'ontbreekt in sitemap.xml'); continue; }
    const srcFile = page.startsWith('wijk/') ? join(ROOT, 'src/templates/wijk.html') : join(ROOT, 'src/pages', page);
    const fm = existsSync(srcFile) ? frontMatter(srcFile) : {};
    if (!fm.updated) fail(page, "geen 'updated:' in de front matter, dus lastmod is de bouwdatum");
    else if (fm.updated !== entries.get(loc)) fail(page, `lastmod ${entries.get(loc)} is niet 'updated: ${fm.updated}'`);
  }
  if (entries.size !== pages.filter(p => !(/noindex|http-equiv="refresh"/.test(html(p)) || p === '404.html')).length) fail('sitemap.xml', `${entries.size} adressen, maar niet elk daarvan is een gebouwde pagina`);
  // rooms link to two other rooms; room anchors exist
  const rooms = readdirSync(join(ROOT, 'src/rooms')).filter(f => f.endsWith('.html')).map(f => basename(f, '.html'));
  for (const room of rooms) {
    const src = readFileSync(join(ROOT, 'src/rooms', room + '.html'), 'utf8');
    const hrefs = [...src.matchAll(/href="([^"]*)"/g)].map(m => m[1].replace(/\?[^#]*/, '')).filter(h => h && h !== '#')
      .map(h => h.replace(/^(simulatie|gereedschap)\.html#.*/, '$1.html'));   // a loket or the doorlichting: the page is the room
    const linked = new Set();
    for (const [other, forms] of Object.entries(ROOM_LINKS)) if (other !== room && hrefs.some(h => forms.includes(h))) linked.add(other);
    if (linked.size < 2) fail(`src/rooms/${room}.html`, `linkt naar ${linked.size} andere kamer(s) (${[...linked].join(', ') || 'geen'}); twee is het minimum`);
    else notes.push(`kamer ${room} -> ${[...linked].join(', ')}`);
    for (const h of hrefs) {
      const m = /^(index|simulatie|gereedschap|werkwijze)\.html#([\w-]+)$/.exec(h) || (h.startsWith('#') ? [h, ROOM_PAGE[room], h.slice(1)] : null);
      if (m && !new RegExp(`\\sid="${m[2]}"`).test(html(m[1] + '.html'))) fail(`src/rooms/${room}.html`, `anker ${h} bestaat niet op ${m[1]}.html`);
    }
  }
  return { pages: pages.length, fails, notes };
}

if (process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))) {
  const r = metaCheck();
  if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 2));
  else { for (const n of r.notes) console.log(`       ${n}`); for (const f of r.fails) console.log(`FOUT   ${f.page}: ${f.text}`); }
  console.log(`\nmeta-check: ${r.pages} pagina's, ${r.fails.length} fout(en)`);
  process.exit(r.fails.length ? 1 : 0);
}
