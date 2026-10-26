// Fixture check: the frozen contracts in scripts/qa/fixtures/*.json against the modules they describe.
// Usage: node scripts/qa/fixtures.mjs [--json]   (qa.mjs runs it with the other lints)
// names.json  -> STSNames.sanitise / aanspreek / bij (docs/assets/js/names.js), every output under 41 characters
// prefill.json -> STSBericht.phrase / compose (docs/assets/js/contact-prefill.js) with a stubbed DOM
import { readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';

/** Runs the two classic scripts in a sandbox with just enough window/document for load. */
function loadScripts(root) {
  const stub = {
    matchMedia: () => ({ matches: false }),
    location: { hash: '', search: '', href: 'http://127.0.0.1/index.html' },
    document: { querySelector: () => null, getElementById: () => null, addEventListener: () => {} },
    CustomEvent: function (type, init) { this.type = type; this.detail = init && init.detail; },
    Event: function (type) { this.type = type; },
    dispatchEvent: () => true, addEventListener: () => {},
    setTimeout, clearTimeout, console,
  };
  stub.window = stub; stub.globalThis = stub;
  const ctx = vm.createContext(stub);
  for (const f of ['names.js', 'contact-prefill.js']) {
    const file = join(root, 'docs', 'assets', 'js', f);
    vm.runInContext(readFileSync(file, 'utf8'), ctx, { filename: pathToFileURL(file).href });
  }
  return ctx;
}

export function checkFixtures({ root = process.cwd() } = {}) {
  const out = [];
  const fail = (file, text) => out.push({ check: 'fixture', file, text, severity: 'fail' });
  let w;
  try { w = loadScripts(root); } catch (e) { fail('docs/assets/js/names.js', `modules laden niet in node: ${e.message}`); return out; }
  const N = w.STSNames, B = w.STSBericht;

  const namesFile = 'scripts/qa/fixtures/names.json';
  const names = JSON.parse(readFileSync(join(root, namesFile), 'utf8'));
  for (const n of names.namen) {
    const got = N.sanitise(n.in);
    if (got !== n.verwacht) fail(namesFile, `sanitise(${JSON.stringify(n.in)}) gaf ${JSON.stringify(got)}, verwacht ${JSON.stringify(n.verwacht)}`);
    if (got.length > 40) fail(namesFile, `sanitise(${JSON.stringify(n.in)}) is ${got.length} tekens lang (maximum 40)`);
  }
  for (const [sector, want] of Object.entries(names.aanspreek || {})) {
    if (N.aanspreek(sector) !== want) fail(namesFile, `aanspreek(${JSON.stringify(sector)}) gaf ${N.aanspreek(sector)}, verwacht ${want}`);
  }
  for (const [sector, want] of Object.entries(names.bij || {})) {
    if (N.bij('', sector) !== want) fail(namesFile, `bij('', ${JSON.stringify(sector)}) gaf ${JSON.stringify(N.bij('', sector))}, verwacht ${JSON.stringify(want)}`);
  }

  const prefillFile = 'scripts/qa/fixtures/prefill.json';
  const pre = JSON.parse(readFileSync(join(root, prefillFile), 'utf8'));
  for (const [key, want] of Object.entries(pre.sleutels)) {
    if (B.phrase(key) !== want) fail(prefillFile, `phrase(${key}) wijkt af van de fixture`);
  }
  for (const key of Object.keys(B.KEYS)) if (!(key in pre.sleutels)) fail(prefillFile, `sleutel ${key} ontbreekt in de fixture`);
  w.STSState = { get: () => ({ zaak: "Frituur 't Pleintje", sector: 'horeca', gemeente: 'Deurne', g: 5, source: 'typed' }) };
  const withName = B.compose({ key: 'gevel' });
  if (withName !== pre.opening + pre.sleutels.gevel) fail(prefillFile, `compose met naam: ${JSON.stringify(withName.slice(0, 80))} begint niet met de opening ${JSON.stringify(pre.opening)}`);
  w.STSState = { get: () => ({ zaak: '', sector: '', gemeente: '', g: 0, source: '' }) };
  const noName = B.compose({ key: 'telefoon' });
  if (noName !== pre.openingZonderNaam + pre.sleutels.telefoon) fail(prefillFile, `compose zonder naam: ${JSON.stringify(noName.slice(0, 40))} begint niet met ${JSON.stringify(pre.openingZonderNaam)}`);
  w.STSState = { get: () => ({ zaak: 'Kinesist Els', sector: 'praktijk', gemeente: '', g: 0, source: 'typed' }) };
  const praktijk = B.compose({ key: 'algemeen' });
  if (!praktijk.startsWith('Dag Snymis, ik ben van Kinesist Els (Praktijk). ')) fail(prefillFile, `compose praktijk zonder gemeente: ${JSON.stringify(praktijk.slice(0, 60))}`);
  return out;
}

if (process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))) {
  const results = checkFixtures();
  if (process.argv.includes('--json')) console.log(JSON.stringify(results, null, 2));
  else {
    for (const r of results) console.log(`FOUT   ${r.file} ${r.text}`);
    console.log(`fixtures: ${results.length} fout(en)`);
  }
  process.exit(results.length ? 1 : 0);
}
