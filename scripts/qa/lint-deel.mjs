// WP-27: the share texts. A button [data-share=<key>] (src/rooms, src/pages) shares window.STS_DEEL.<key>,
// registered in docs/assets/js/*-data.js (sim-data-2.js included) or src/data/*.js as one double-quoted string on one line.
// Rules: every button has a text and every text a button; no key twice; the text with {site} filled in
// (the Pages address) and {score} at its widest ('100') stays under MAX characters; no word from the
// woordenlijst in STS voice (the owner forwards it, but we wrote it). Runs inside lint-copy (npm run lint,
// npm run qa) and on its own: node scripts/qa/lint-deel.mjs
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { loadWoordenlijst, scanText } from './woorden.mjs';
import { PAGES_BASE } from './profiles.mjs';

export const MAX_CHARS = 300;
const TEXT_RE = /window\.STS_DEEL\.(\w+)\s*=\s*"((?:[^"\\]|\\.)*)"\s*;/g;
const BUTTON_RE = /data-share="([^"]+)"/g;

function dir(root, rel, re) {
  const abs = join(root, rel);
  return existsSync(abs) ? readdirSync(abs).filter(f => re.test(f)).map(f => join(rel, f)) : [];
}
export const dataFiles = (root = process.cwd()) => [...dir(root, 'docs/assets/js', /-data(-\d+)?\.js$/), ...dir(root, 'src/data', /\.js$/)];
export const htmlFiles = (root = process.cwd()) => [...dir(root, 'src/rooms', /\.html$/), ...dir(root, 'src/pages', /\.html$/)];

/** { key: [{ file, line, text }] } from the data files. */
export function deelTexts(root = process.cwd()) {
  const out = {};
  for (const file of dataFiles(root)) {
    const src = readFileSync(join(root, file), 'utf8');
    for (const m of src.matchAll(TEXT_RE)) {
      const line = src.slice(0, m.index).split('\n').length;
      (out[m[1]] ||= []).push({ file, line, text: JSON.parse('"' + m[2] + '"') });
    }
  }
  return out;
}

/** { key: [{ file, line }] } from the buttons in the sources. */
export function deelButtons(root = process.cwd()) {
  const out = {};
  for (const file of htmlFiles(root)) {
    const src = readFileSync(join(root, file), 'utf8');
    for (const m of src.matchAll(BUTTON_RE)) (out[m[1]] ||= []).push({ file, line: src.slice(0, m.index).split('\n').length });
  }
  return out;
}

export const filled = (text) => text.replace(/\{site\}/g, PAGES_BASE).replace(/\{score\}/g, '100');

/** Raw issues (check 'deel'), not yet classified. */
export function lintDeel(list, { root = process.cwd() } = {}) {
  const texts = deelTexts(root), buttons = deelButtons(root), issues = [];
  const push = (file, line, rule, text) => issues.push({ check: 'deel', rule, match: '', line, file, page: '', where: file, text });
  for (const [key, hits] of Object.entries(texts)) {
    if (hits.length > 1) push(hits[1].file, hits[1].line, 'deel-dubbel', `deeltekst '${key}' staat twee keer (ook in ${hits[0].file}:${hits[0].line})`);
    const { file, line, text } = hits[0], full = filled(text);
    if (!buttons[key]) push(file, line, 'deel-knop', `deeltekst '${key}' heeft geen knop [data-share="${key}"] in src/rooms of src/pages`);
    if (full.length >= MAX_CHARS) push(file, line, 'deel-lengte', `deeltekst '${key}' is ${full.length} tekens met het adres ingevuld (maximum ${MAX_CHARS - 1})`);
    if (!/\{site\}/.test(text)) push(file, line, 'deel-adres', `deeltekst '${key}' draagt geen {site}: zonder adres kan de collega niets openen`);
    for (const hit of scanText(text, { voice: 'sts' }, list)) push(file, line, hit.rule, `'${hit.match}' in deeltekst '${key}' (${hit.note})`);
  }
  for (const [key, hits] of Object.entries(buttons)) {
    if (!texts[key]) push(hits[0].file, hits[0].line, 'deel-tekst', `knop [data-share="${key}"] heeft geen tekst window.STS_DEEL.${key} in een databestand`);
  }
  return issues;
}

if (process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))) {
  const list = loadWoordenlijst();
  const issues = lintDeel(list);
  const texts = deelTexts();
  for (const [k, h] of Object.entries(texts)) console.log(`${k.padEnd(13)} ${String(filled(h[0].text).length).padStart(3)} tekens  ${h[0].file}`);
  for (const i of issues) console.log(`FOUT   ${i.file}:${i.line} ${i.text}`);
  console.log(`\nlint-deel: ${Object.keys(texts).length} deelteksten, ${issues.length} fout(en)`);
  process.exit(issues.length ? 1 : 0);
}
