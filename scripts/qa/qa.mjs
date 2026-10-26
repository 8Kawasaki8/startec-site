// Headless QA gate for the static site in docs/.
// Usage: node scripts/qa/qa.mjs [--quick] [--pages a.html,b.html] [--profile phone|desktop|tablet]
//        [--mode gl|gl-swift|nogl] [--variant default|reduced|lite] [--shots] [--no-lint]
//        [--no-a11y] [--out DIR] [--port N] [--report-only]
// Serves docs/ with python3 http.server, runs the matrix from profiles.mjs in three Chromium
// launch modes, classifies every finding (fail / known with WP / notice) with budget.mjs,
// writes .qa/report.json and renders docs/qa-report.html. Exit 1 when any run or lint fails.
import { createRequire } from 'node:module';
import { spawn, execSync } from 'node:child_process';
import { readdirSync, statSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { GL_MODES, PAGES_BASE, buildMatrix, runLabel } from './profiles.mjs';
import { loadBudget, KNOWN, budgetSummary } from './budget.mjs';
import { loadWoordenlijst, serialise } from './woorden.mjs';
import { lintCssFiles, defaultFiles as cssFiles } from './lint-css.mjs';
import { lintCopy, defaultFiles as copyFiles } from './lint-copy.mjs';
import { lintLines } from './lint-lines.mjs';
import { checkFixtures, checkSignFixtures } from './fixtures.mjs';
import { checkDataFiles } from './checks.mjs';
import { checkAssets } from './perf.mjs';   // WP-16: og.png, straat images, preloaded fonts
import { runOne } from './runner.mjs';
import { a11yPass } from './a11y.mjs';   // WP-19: contrast, names, headings, keyboard, dialog, zoom, motion
import { writeReportHtml } from './report.mjs';

const req = createRequire(import.meta.url);
const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true] : []).filter(x => x.length));
const ROOT = process.cwd();
const DOCS = join(ROOT, 'docs');
const OUT = args.out ? String(args.out) : join(ROOT, '.qa');
const REPORT = join(OUT, 'report.json');
const HTML = join(DOCS, 'qa-report.html');
mkdirSync(OUT, { recursive: true });

if (args['report-only']) {
  if (!existsSync(REPORT)) { console.error(`geen ${REPORT}; draai eerst npm run qa`); process.exit(1); }
  writeReportHtml(JSON.parse(readFileSync(REPORT, 'utf8')), HTML);
  console.log(`docs/qa-report.html vernieuwd uit ${relative(ROOT, REPORT)}`);
  process.exit(0);
}

function loadPlaywright() {
  for (const c of ['playwright', '/usr/lib/node_modules/playwright', '/usr/local/lib/node_modules/playwright']) { try { return req(c); } catch { /* next */ } }
  throw new Error('playwright niet gevonden: npm ci');
}
const { chromium } = loadPlaywright();
const exe = chromium.executablePath();
if (!existsSync(exe)) {
  console.error(`Chromium ontbreekt (${exe}).\nInstalleer met: npx playwright install --with-deps chromium\nOf wijs PLAYWRIGHT_BROWSERS_PATH naar een bestaande installatie.`);
  process.exit(2);
}

function listPages(dir) {
  const out = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { if (f !== 'assets') out.push(...listPages(p)); }
    else if (f.endsWith('.html')) out.push(relative(DOCS, p).split('\\').join('/'));
  }
  return out.sort();
}

function git(cmd) { try { return execSync(`git ${cmd}`, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } }

async function startServer(port) {
  for (let p = port; p < port + 10; p++) {
    const server = spawn('python3', ['-m', 'http.server', String(p), '--bind', '127.0.0.1', '--directory', DOCS], { stdio: 'ignore' });
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 100));
      try { const r = await fetch(`http://127.0.0.1:${p}/index.html`, { method: 'HEAD' }); if (r.ok) return { server, port: p }; } catch { /* not yet */ }
      if (server.exitCode !== null) break;
    }
    server.kill();
  }
  throw new Error(`geen vrije poort vanaf ${port}`);
}

const allPages = listPages(DOCS);
const pages = args.pages ? String(args.pages).split(',').map(s => s.trim()).filter(Boolean) : allPages;
for (const p of pages) if (!allPages.includes(p)) { console.error(`pagina ontbreekt in docs/: ${p}`); process.exit(2); }
const only = (k) => args[k] ? String(args[k]).split(',') : null;
const { runs, notices } = buildMatrix(pages, { quick: !!args.quick, modes: only('mode'), profiles: only('profile'), all: allPages });
const wantVariants = only('variant');
const matrix = wantVariants ? runs.filter(r => wantVariants.includes(r.variant)) : runs;

const budget = loadBudget(ROOT);
const rules = serialise(loadWoordenlijst(ROOT));
const { server, port } = await startServer(Number(args.port || 8765));
const base = `http://127.0.0.1:${port}/`;
const env = { base, pagesBase: PAGES_BASE, budget, rules, root: ROOT, out: OUT, shots: !!args.shots };

const browsers = {};
async function browserFor(mode) {
  if (!browsers[mode]) browsers[mode] = await chromium.launch({ args: GL_MODES[mode].args });
  return browsers[mode];
}

const started = Date.now();
const results = [];
console.log(`QA: ${pages.length} pagina's, ${matrix.length} runs${args.quick ? ' (quick)' : ''}, budget: ${budget.source}, woordenlijst: ${rules.source || 'inline'}`);
for (const n of notices) console.log(`notitie: ${n}`);
for (const run of matrix) {
  const browser = await browserFor(run.mode);
  const t0 = Date.now();
  const rec = await runOne(browser, run, env);
  rec.ms = Date.now() - t0;
  results.push(rec);
  const fails = rec.issues.filter(i => i.severity === 'fail'), known = rec.issues.filter(i => i.severity === 'known');
  const tag = rec.status === 'fail' ? 'FOUT  ' : rec.status === 'known' ? 'BEKEND' : 'ok    ';
  console.log(`${tag} ${runLabel(run)} ${rec.loadMs}ms raf=${rec.rafCount} scene=${rec.scene ? rec.scene.event : '-'} ${known.length ? `bekend=${known.length} ` : ''}${fails.length ? `fouten=${fails.length}` : ''}`);
  for (const i of fails) console.log(`   - ${i.text}`);
}
// WP-19: the accessibility pass on every STS page (desktop and phone, mode gl); fails only on contrast and missing names
let a11y = null;
if (!args['no-a11y']) {
  a11y = await a11yPass(await browserFor('gl'), pages, { base, verbose: !!args.verbose });
  for (const s of a11y.skipped) console.log(`notitie: ${s}`);
  console.log(`a11y: ${a11y.runs.length} runs, ${a11y.fails} fout(en), ${a11y.notices} notitie(s)`);
}
for (const b of Object.values(browsers)) await b.close();
server.kill();

// static lints ride along so one report covers everything the publish guard needs
let lint = { skipped: true };
if (!args['no-lint']) {
  const css = lintCssFiles(cssFiles(), { root: ROOT });
  const copy = lintCopy(copyFiles(), { root: ROOT }).results;
  const lines = lintLines({ root: ROOT }).results;
  const fixtures = [...checkFixtures({ root: ROOT }), ...await checkSignFixtures({ root: ROOT }), ...checkDataFiles(ROOT), ...checkAssets(ROOT, budget)];   // WP-09: panden, capabilities, radar-bericht; WP-16: assets
  lint = { css, copy, lines, fixtures, fails: [...css, ...copy, ...lines, ...fixtures].filter(i => i.severity === 'fail').length };
  console.log(`lint: css ${css.length} bevindingen, copy ${copy.length}, regels ${lines.length}, fixtures ${fixtures.length}; ${lint.fails} fout(en)`);
}

const knownSummary = {};
for (const r of results) for (const i of r.issues) if (i.severity === 'known') { const k = `${i.wp}|${i.note}`; knownSummary[k] = (knownSummary[k] || 0) + 1; }
for (const list of [lint.css, lint.copy, lint.lines, lint.fixtures]) for (const i of list || []) if (i.severity === 'known') { const k = `${i.wp}|${i.note}`; knownSummary[k] = (knownSummary[k] || 0) + 1; }
const failing = results.filter(r => r.status === 'fail').length + (lint.fails || 0) + (a11y ? a11y.fails : 0);
const report = {
  generated: new Date().toISOString(), commit: git('rev-parse HEAD'), branch: git('branch --show-current'),
  // dirty: the report describes the working tree, which differs from `commit` (prepush.sh and the report header show it)
  dirty: git('status --porcelain -- src docs scripts') !== '',
  dirtyFiles: git('status --porcelain -- src docs scripts').split('\n').filter(Boolean).length,
  node: process.version, playwright: req('playwright/package.json').version, chromium: exe, durationMs: Date.now() - started,
  budget: budget.source, woordenlijst: rules.source || 'inline',
  // WP-15: the measured budget behind the gates, for the report's Budget section
  budgetInfo: { source: budget.source, measuredOn: budget.measuredOn || null, measuredAt: budget.measuredAt || null, workingTreeDirty: !!budget.workingTreeDirty, marginBytes: budget.marginBytes, marginCalls: budget.marginCalls, phoneRawBytesMax: budget.phoneRawBytesMax, jsGzipLiteMax: budget.jsGzipLiteMax, gates: budget.gates, rows: budgetSummary(budget) },
  // partial: a subset (--pages, --profile, --mode or --variant) is never a publishable report, whatever its colour
  matrix: { quick: !!args.quick, partial: pages.length < allPages.length || !!(args.profile || args.mode || args.variant), pages: pages.length, pagesTotal: allPages.length, runs: matrix.length, modes: Object.keys(GL_MODES) },
  notices, summary: {
    runs: results.length, pass: results.filter(r => r.status === 'pass').length, known: results.filter(r => r.status === 'known').length,
    fail: results.filter(r => r.status === 'fail').length, lintFails: lint.fails || 0, a11yFails: a11y ? a11y.fails : null, a11yNotices: a11y ? a11y.notices : null, status: failing ? 'red' : 'green',
  },
  a11y,
  known: Object.entries(knownSummary).map(([k, count]) => { const [wp, note] = k.split('|'); return { wp, note, count }; }).sort((a, b) => a.wp.localeCompare(b.wp)),
  knownRules: KNOWN.map(k => ({ wp: k.wp, note: k.note })), lint, runs: results,
};
writeFileSync(REPORT, JSON.stringify(report, null, 2));
writeReportHtml(report, HTML);
console.log(`\n${failing ? 'QA ROOD' : 'QA GROEN'}: ${results.length} runs, ${report.summary.fail} rode runs, ${report.summary.known} met bekende punten, lint ${lint.fails || 0} fout(en), a11y ${a11y ? `${a11y.fails} fout(en), ${a11y.notices} notitie(s)` : 'overgeslagen'}, ${Math.round(report.durationMs / 1000)} s. Rapport: ${relative(ROOT, REPORT)} en docs/qa-report.html`);
process.exit(failing ? 1 : 0);
