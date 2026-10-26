// Line counter: every source file must stay under 500 lines (split modules instead).
// Usage: node scripts/qa/lint-lines.mjs [--json] [--strict]
// Scope: src/, scripts/ and docs/assets/{css,js}; vendor folders, fonts, images and node_modules are skipped.
// --strict (or gate lineLimitsStrict) also enforces the WP-15 limits: scene files < 300, CSS < 400.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, basename, extname } from 'node:path';
import { classify, loadBudget } from './budget.mjs';

const ROOT = process.cwd();
export const MAX_LINES = 500;           // a file with 500 or more lines fails
export const STRICT = { scene: 300, css: 400 };
// scripts/workflows holds generated plan data (json/md), not code.
const SKIP_DIRS = new Set(['vendor', 'node_modules', 'fonts', 'img', '__pycache__', '.git', 'three-addons', 'workflows']);
const TEXT_EXT = new Set(['.js', '.mjs', '.css', '.html', '.py', '.json', '.md', '.sh', '.svg', '.txt', '.yml', '.yaml']);

function files(dir, out = []) {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return out;
  for (const f of readdirSync(abs)) {
    const p = join(abs, f);
    const st = statSync(p);
    if (st.isDirectory()) { if (!SKIP_DIRS.has(f)) files(join(dir, f), out); }
    else if (TEXT_EXT.has(extname(f)) && !/\.min\./.test(f)) out.push(join(dir, f));
  }
  return out;
}

export function countLines(file) {
  const src = readFileSync(join(ROOT, file), 'utf8');
  if (!src.length) return 0;
  return src.split('\n').length - (src.endsWith('\n') ? 1 : 0);
}

export function lintLines({ root = ROOT, strict = false } = {}) {
  const budget = loadBudget(root);
  const list = [...files('src'), ...files('scripts'), ...files('docs/assets/css'), ...files('docs/assets/js')];
  const rows = list.map(f => ({ file: f.split('\\').join('/'), lines: countLines(f) })).sort((a, b) => b.lines - a.lines);
  const results = [];
  for (const r of rows) {
    if (r.lines >= MAX_LINES) results.push(classify({ check: 'lines', file: r.file, text: `${r.file}: ${r.lines} regels (maximum ${MAX_LINES - 1})` }, { root, budget, page: '' }));
    const isScene = /assets\/js\/scene(\/|\.js$)/.test(r.file);
    const isCss = r.file.endsWith('.css');
    const limit = isScene ? STRICT.scene : isCss ? STRICT.css : null;
    if (limit && r.lines >= limit && r.lines < MAX_LINES) {
      const raw = { check: 'lines-strict', file: r.file, text: `${r.file}: ${r.lines} regels (eindaudit-limiet ${limit - 1} voor ${isScene ? 'scene' : 'CSS'})` };
      results.push(strict ? { ...raw, severity: 'fail' } : classify(raw, { root, budget, page: '' }));
    }
  }
  return { rows, results };
}

if (process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))) {
  const argv = process.argv.slice(2);
  const { rows, results } = lintLines({ strict: argv.includes('--strict') });
  if (argv.includes('--json')) console.log(JSON.stringify({ rows, results }, null, 2));
  else {
    console.log(`lint-lines: ${rows.length} bestanden, grootste eerst`);
    for (const r of rows.slice(0, 12)) console.log(`${String(r.lines).padStart(5)}  ${r.file}`);
    for (const r of results) console.log(`${r.severity === 'fail' ? 'FOUT  ' : 'BEKEND'} ${r.text}${r.wp ? ` [${r.wp}: ${r.note}]` : ''}`);
  }
  const fails = results.filter(r => r.severity === 'fail').length;
  console.log(`\nlint-lines: ${fails} fout(en), ${results.length - fails} bekend, ${rows.length} bestanden`);
  process.exit(fails ? 1 : 0);
}
