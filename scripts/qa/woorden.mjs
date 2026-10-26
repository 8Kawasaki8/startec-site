// Word rules for the copy scans, shared by lint-copy.mjs (static HTML) and checks.mjs (rendered text).
// Since WP-12 the single source of truth is src/data/woordenlijst.json (documented in copy-regels.md);
// this module only loads, compiles and applies it. No inline list: a missing or broken file stops the lint.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const WOORDENLIJST = join('src', 'data', 'woordenlijst.json');

export function loadWoordenlijst(root = process.cwd()) {
  const file = join(root, WOORDENLIJST);
  if (!existsSync(file)) throw new Error(`${WOORDENLIJST} ontbreekt: de woordenlijst is sinds WP-12 de enige bron van de copyregels`);
  let data;
  try { data = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { throw new Error(`${WOORDENLIJST} is geen geldige JSON: ${e.message}`); }
  for (const k of ['sts', 'sim', 'stars', 'voices']) if (!data[k]) throw new Error(`${WOORDENLIJST} mist het veld '${k}'`);
  if (!Array.isArray(data.sim.forbidden) || !Array.isArray(data.sim.required)) throw new Error(`${WOORDENLIJST}: sim.forbidden en sim.required moeten lijsten zijn`);
  for (const r of [...data.sts, ...data.sim.forbidden]) {
    try { new RegExp(r.pattern, (r.flags || '').replace('g', '')); } catch (e) { throw new Error(`${WOORDENLIJST}: regel '${r.id}' heeft een ongeldig patroon (${e.message})`); }
  }
  return {
    source: WOORDENLIJST,
    sts: data.sts,
    sim: { forbidden: data.sim.forbidden, required: data.sim.required, perRoom: data.sim.perRoom || {} },
    stars: data.stars,
    exemptVoices: data.voices.exempt || [],
  };
}

/** Compiles a rule list into RegExp objects (global flag added for scanning). */
export function compile(rules) {
  return rules.map(r => ({ ...r, re: new RegExp(r.pattern, (r.flags || '').replace('g', '') + 'g') }));
}

/** Serialisable form for page.evaluate: regex sources only. */
export function serialise(list) {
  return {
    source: list.source,
    sts: list.sts.map(r => ({ id: r.id, pattern: r.pattern, flags: r.flags || '', legalOk: !!r.legalOk, scope: r.scope || '', note: r.note || '' })),
    simForbidden: list.sim.forbidden.map(r => ({ id: r.id, pattern: r.pattern, flags: r.flags || '', note: r.note || '' })),
    simRequired: list.sim.required,
    simPerRoom: list.sim.perRoom,
    stars: list.stars,
    exemptVoices: list.exemptVoices,
  };
}

/**
 * Scans one text run. `ctx` says where the text sits:
 *  voice: 'sts' or a data-voice value; faq: inside details>summary; sim: inside [data-sim]; legal: legal page;
 *  gevel: inside the gevel room; wijk: a wijk page outside [data-sfeerzin] (rules with a scope apply only there).
 * Returns issues as { rule, match, note }.
 */
export function scanText(text, ctx, list) {
  const out = [];
  if (!text || !text.trim()) return out;
  const exempt = ctx.voice && ctx.voice !== 'sts' && list.exemptVoices.includes(ctx.voice);
  if (!exempt && !ctx.faq) {
    for (const r of list.sts) {
      if (r.legalOk && ctx.legal) continue;
      if (r.scope && !ctx[r.scope]) continue;
      const re = new RegExp(r.pattern, (r.flags || '').replace('g', '') + 'g');
      const m = re.exec(text);
      if (m) out.push({ rule: r.id, match: m[0], note: r.note || '' });
    }
  }
  if (ctx.sim) {
    for (const r of list.sim.forbidden) {
      const re = new RegExp(r.pattern, (r.flags || '').replace('g', '') + 'g');
      const m = re.exec(text);
      if (m) out.push({ rule: 'sim-' + r.id, match: m[0], note: r.note || '' });
    }
  }
  return out;
}

export function hasFiveStars(text, list) {
  return new RegExp(list.stars.pattern, 'u').test(text || '');
}

export function simLabelPresent(text, list) {
  const t = (text || '').toLowerCase();
  return list.sim.required.some(w => t.includes(w.toLowerCase()));
}

/** The words a named simulation room must all contain (sim.perRoom); [] when the room has no own list. */
export function simRoomMissing(text, roomKey, list) {
  const want = (roomKey && list.sim.perRoom[roomKey]) || [];
  const t = (text || '').toLowerCase();
  return want.filter(w => !t.includes(w.toLowerCase()));
}
