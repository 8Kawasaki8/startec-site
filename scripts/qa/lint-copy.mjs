// Static copy lint: forbidden words per voice scope, sim labels (per room since WP-12), filled stars.
// The rules come from src/data/woordenlijst.json (woorden.mjs); the reasoning is in copy-regels.md.
// Usage: node scripts/qa/lint-copy.mjs [files...] [--json] [--selftest]
// Default scope: src/pages, src/partials, src/rooms and the generated-only pages docs/wijk, docs/dev.
// docs/demo is not STS voice and is not scanned. Exit 1 on failures; 'known' cases print but pass.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, basename, relative } from 'node:path';
import { parseHTML, walk, textOf, isSkipped, closest, pathOf } from './html-lite.mjs';
import { loadWoordenlijst, scanText, hasFiveStars, simLabelPresent, simRoomMissing } from './woorden.mjs';
import { classify, loadBudget } from './budget.mjs';
import { isLegalPage } from './profiles.mjs';
import { lintDeel } from './lint-deel.mjs';   // WP-27: the share texts ([data-share] -> STS_DEEL) ride along

const ROOT = process.cwd();
const ATTRS = ['alt', 'placeholder', 'aria-label', 'title', 'data-flap'];
/** The stars rule looks for 'voorbeeld' inside the nearest block, not the whole page. */
const BLOCK = new Set(['p', 'li', 'figure', 'figcaption', 'blockquote', 'div', 'article', 'section', 'td', 'th', 'dd', 'dt', 'summary', 'h1', 'h2', 'h3', 'h4', 'label', 'button']);

function htmlFiles(dir) {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs).filter(f => f.endsWith('.html')).map(f => join(dir, f)).filter(f => statSync(join(ROOT, f)).isFile());
}

export function defaultFiles() {
  return [...htmlFiles('src/pages'), ...htmlFiles('src/partials'), ...htmlFiles('src/rooms'), ...htmlFiles('docs/wijk'), ...htmlFiles('docs/dev')];
}

/** Text runs that are not part of the DOM: front matter title/description in src/pages. */
function frontMatter(src) {
  const m = /^\s*<!--([\s\S]*?)-->/.exec(src);
  if (!m) return [];
  const out = [];
  for (const line of m[1].split('\n')) { const mm = /^\s*(title|description)\s*:\s*(.+)$/.exec(line); if (mm) out.push({ where: 'front matter ' + mm[1], text: mm[2].trim() }); }
  return out;
}

function ctxFor(node, pageCtx) {
  const voiceEl = closest(node, n => n.attrs['data-voice'] !== undefined);
  const summary = closest(node, n => n.tag === 'summary');
  return {
    voice: voiceEl ? (voiceEl.attrs['data-voice'] || 'sts') : 'sts',
    faq: !!(summary && summary.parent && summary.parent.tag === 'details'),
    sim: !!closest(node, n => n.attrs['data-sim'] !== undefined),
    gevel: !!closest(node, n => n.attrs.id === 'gevel' || n.attrs['data-room'] === 'gevel'),
    wijk: pageCtx.wijk && !closest(node, n => n.attrs['data-sfeerzin'] !== undefined),   // WP-13: scope 'wijk' skips the founder's sentence
    legal: pageCtx.legal,
  };
}

/** Lints one HTML file; returns raw issues (not yet classified). */
export function lintFile(file, list) {
  const src = readFileSync(join(ROOT, file), 'utf8');
  const page = file.startsWith('docs/') ? relative('docs', file) : basename(file);
  const pageCtx = { legal: isLegalPage(page), wijk: page.startsWith('wijk/') };   // wijk: docs/wijk/*.html (WP-13)
  const issues = [];
  const seen = new Set();
  const push = (i) => { const k = `${i.rule}|${i.line}|${i.match}`; if (seen.has(k)) return; seen.add(k); issues.push({ page, file, ...i }); };

  for (const fm of frontMatter(src)) {
    for (const hit of scanText(fm.text, { voice: 'sts', legal: pageCtx.legal }, list)) push({ check: 'copy', rule: hit.rule, match: hit.match, line: 1, where: fm.where, text: `'${hit.match}' in ${fm.where} (${hit.note})` });
  }
  const tree = parseHTML(src);
  walk(tree, (node) => {
    if (node.text !== undefined) {
      if (isSkipped(node) || !node.text.trim()) return;
      const ctx = ctxFor(node, pageCtx);
      const where = pathOf(node);
      for (const hit of scanText(node.text, ctx, list)) {
        push({ check: 'copy', rule: hit.rule, match: hit.match, line: node.line, where, text: `'${hit.match}' in ${where} (${hit.note})` });
      }
      if (hasFiveStars(node.text, list)) {
        const block = closest(node, n => BLOCK.has(n.tag)) || node.parent;
        if (!textOf(block).toLowerCase().includes(list.stars.required)) push({ check: 'stars', rule: 'stars', match: '★★★★★', line: node.line, where, text: `vijf gevulde sterren zonder '${list.stars.required}' in ${where}` });
      }
      return;
    }
    const ctx = ctxFor(node, pageCtx);
    for (const a of ATTRS) {
      if (!node.attrs[a]) continue;
      for (const hit of scanText(node.attrs[a], ctx, list)) push({ check: 'copy', rule: hit.rule, match: hit.match, line: node.line, where: `${pathOf(node)}[${a}]`, text: `'${hit.match}' in attribuut ${a} van ${pathOf(node)} (${hit.note})` });
    }
    if (node.tag === 'meta' && node.attrs.name === 'description' && node.attrs.content) {
      for (const hit of scanText(node.attrs.content, { voice: 'sts', legal: pageCtx.legal }, list)) push({ check: 'copy', rule: hit.rule, match: hit.match, line: node.line, where: 'meta description', text: `'${hit.match}' in meta description (${hit.note})` });
    }
    if (node.attrs['data-sim'] !== undefined) {
      const simText = textOf(node);
      if (!simLabelPresent(simText, list)) push({ check: 'sim-required', rule: 'sim-required', match: '', line: node.line, where: pathOf(node), text: `[data-sim] ${pathOf(node)} bevat 'gesimuleerd' noch 'fictief'` });
      // sim.perRoom: the words this particular room must all carry; key = data-proef-bron, the element's id, or the room file name
      const roomKey = node.attrs['data-proef-bron'] || node.attrs.id || (file.startsWith('src/rooms/') ? basename(file, '.html') : '');
      const missing = simRoomMissing(simText, roomKey, list);
      if (missing.length) push({ check: 'sim-required', rule: 'sim-room', match: missing.join(', '), line: node.line, where: pathOf(node), text: `[data-sim] kamer '${roomKey}' mist de verplichte woorden: ${missing.join(', ')} (woordenlijst sim.perRoom)` });
    }
  });
  return issues;
}

export function lintCopy(files, { root = ROOT } = {}) {
  const list = loadWoordenlijst(root);
  const budget = loadBudget(root);
  const results = [];
  for (const file of files) {
    for (const raw of lintFile(file, list)) results.push(classify(raw, { root, budget, page: raw.page }));
  }
  for (const raw of lintDeel(list, { root })) results.push(classify(raw, { root, budget, page: raw.page }));   // WP-27
  return { source: list.source, results };
}

function print(results) {
  for (const r of results) {
    const tag = r.severity === 'fail' ? 'FOUT  ' : r.severity === 'known' ? `BEKEND` : 'NOTITIE';
    console.log(`${tag} ${r.file}:${r.line} ${r.text}${r.wp ? ` [${r.wp}: ${r.note}]` : ''}`);
  }
}

function selftest() {
  const fixture = 'scripts/qa/fixtures/broken.html';
  const { results } = lintCopy([fixture]);
  const fails = results.filter(r => r.severity === 'fail');
  const rules = new Set(fails.map(r => r.rule));
  const wantPrice = rules.has('euro-teken') || rules.has('euro');
  const wantStars = rules.has('stars');
  const wantJullie = fails.filter(r => r.rule === 'jullie');
  const visitorLeak = wantJullie.some(r => /data-voice|visitor|\.visitor/.test(r.where || ''));
  print(results);
  const ok = wantPrice && wantStars && wantJullie.length === 1 && !visitorLeak && fails.length === 3;
  console.log(ok
    ? `\nzelftest geslaagd: fixture faalt op prijs, sterren en 'jullie' (3 fouten); de regel met data-voice=visitor passeert`
    : `\nzelftest MISLUKT: verwacht precies 3 fouten (prijs, sterren, jullie in STS-stem), gevonden ${fails.length}: ${[...rules].join(', ')}`);
  return ok;
}

if (process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))) {
  const argv = process.argv.slice(2);
  if (argv.includes('--selftest')) process.exit(selftest() ? 0 : 1);
  const files = argv.filter(a => !a.startsWith('--'));
  const target = files.length ? files : defaultFiles();
  const { source, results } = lintCopy(target);
  if (argv.includes('--json')) { console.log(JSON.stringify({ source, results }, null, 2)); }
  else {
    console.log(`lint-copy: ${target.length} bestanden, woordenlijst: ${source}`);
    print(results);
  }
  const fails = results.filter(r => r.severity === 'fail').length;
  const known = results.filter(r => r.severity === 'known').length;
  console.log(`\nlint-copy: ${fails} fout(en), ${known} bekend (met WP), ${target.length} bestanden`);
  process.exit(fails ? 1 : 0);
}
