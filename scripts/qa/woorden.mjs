// Word rules for the copy scans, shared by lint-copy.mjs (static HTML) and checks.mjs (rendered text).
// The list is loaded from src/data/woordenlijst.json when that file exists (WP-12);
// until then the inline list below is the single source of truth.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** Rules in STS voice. `legalOk` marks words that are allowed on the legal pages. */
const STS_INLINE = [
  { id: 'euro-teken', pattern: '€', note: 'geen prijzen of prijsankers op de site' },
  { id: 'euro', pattern: '\\beuro\\b', flags: 'i', legalOk: true, note: 'geen prijzen buiten de juridische pagina\'s' },
  { id: 'gegarandeerd', pattern: '\\bgegarandeerd\\b', flags: 'i', note: 'geen garanties beloven' },
  { id: 'plaatsen', pattern: '\\bnog\\s+\\d+\\s+plaatsen\\b', flags: 'i', note: 'geen schaarste' },
  { id: 'ons-team', pattern: '\\bons team\\b', flags: 'i', note: 'STS is een persoon met agenten, geen team' },
  { id: 'medewerker', pattern: '\\been medewerker\\b', flags: 'i', note: 'Snymis leest zelf; er is geen medewerker' },
  { id: 'mobieltje', pattern: '\\bmobieltje\\b', flags: 'i', note: 'nl-BE: gsm' },
  { id: 'leuk', pattern: '\\bleuk\\b', flags: 'i', note: 'nl-BE toonregel' },
  { id: 'ai-powered', pattern: 'AI-powered', flags: 'i', note: 'geen marketingjargon' },
  { id: 'leads', pattern: '\\bleads\\b', flags: 'i', note: 'geen verkoopjargon' },
  { id: 'funnel', pattern: '\\bfunnels?\\b', flags: 'i', note: 'geen verkoopjargon' },
  { id: 'jullie', pattern: '\\bjullie\\b', flags: 'i', note: 'STS spreekt een uitbater nooit met jullie aan' },
  { id: 'doei', pattern: '\\bdoei\\b', flags: 'i', note: 'nl-BE toonregel' },
  { id: 'conversie', pattern: '\\bconversies?\\b', flags: 'i', note: 'geen verkoopjargon' },
  { id: 'onboarding', pattern: '\\bonboarding\\b', flags: 'i', note: 'geen verkoopjargon' },
  { id: 'slim', pattern: '\\bslim(me)?\\b', flags: 'i', note: 'geen marketingjargon' },
  { id: 'revolutionair', pattern: '\\brevolutionair(e)?\\b', flags: 'i', note: 'geen marketingjargon' },
  { id: 'solutions', pattern: '\\bsolutions\\b', flags: '', note: 'geen marketingjargon (de merknaam Star.Tec.Solutions schrijft het met hoofdletter)' },
  { id: 'kvk', pattern: '\\bKvK\\b', flags: '', note: 'nl-NL: in België is het de KBO' },
  { id: 'ideal', pattern: '\\biDEAL\\b', flags: '', note: 'nl-NL: in België Bancontact of Payconiq' },
  { id: 'randstad', pattern: '\\bRandstad\\b', flags: 'i', note: 'nl-NL: de site is voor Antwerpen en Vlaanderen' },
  // scope 'gevel': only inside the gevel room (#gevel or [data-room=gevel]); the sketch promises only what the free example holds
  { id: 'gevel-belofte', pattern: '\\bgarantie\\b|\\blive uit je agenda\\b|\\b24 uur\\b', flags: 'i', scope: 'gevel', note: 'de gevelschets belooft geen garantie, agenda-koppeling of 24 uur' },
];

/** Rules inside [data-sim] rooms: no borrowed authority. */
const SIM_INLINE = {
  forbidden: [
    { id: 'studie', pattern: '\\bstudies?\\b', flags: 'i', note: 'geen studies aanhalen in een simulatie' },
    { id: 'onderzoek-toont', pattern: '\\bonderzoek toont\\b', flags: 'i', note: 'geen onderzoeksclaims in een simulatie' },
    { id: 'rapport', pattern: '\\brapport(en)?\\b', flags: 'i', note: 'geen rapporten aanhalen in een simulatie' },
  ],
  required: ['gesimuleerd', 'fictief'],
};

/** Five filled stars are only allowed next to the word 'voorbeeld'. */
const STARS_INLINE = { pattern: '(?:[\\u2605\\u2B50\\uD83C\\uDF1F]\\s*){5}', required: 'voorbeeld' };

/** data-voice values that are not STS speaking: visitor prefills, customer chips, the QA report itself. */
const EXEMPT_VOICES_INLINE = ['visitor', 'customer', 'qa'];

export function loadWoordenlijst(root = process.cwd()) {
  const file = join(root, 'src', 'data', 'woordenlijst.json');
  let data = null;
  if (existsSync(file)) {
    try { data = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { throw new Error(`woordenlijst.json is geen geldige JSON: ${e.message}`); }
  }
  return {
    source: data ? 'src/data/woordenlijst.json' : 'inline (tot WP-12)',
    sts: (data && data.sts) || STS_INLINE,
    sim: (data && data.sim) || SIM_INLINE,
    stars: (data && data.stars) || STARS_INLINE,
    exemptVoices: (data && data.voices && data.voices.exempt) || EXEMPT_VOICES_INLINE,
  };
}

/** Compiles a rule list into RegExp objects (global flag added for scanning). */
export function compile(rules) {
  return rules.map(r => ({ ...r, re: new RegExp(r.pattern, (r.flags || '').replace('g', '') + 'g') }));
}

/** Serialisable form for page.evaluate: regex sources only. */
export function serialise(list) {
  return {
    sts: list.sts.map(r => ({ id: r.id, pattern: r.pattern, flags: r.flags || '', legalOk: !!r.legalOk, scope: r.scope || '', note: r.note || '' })),
    simForbidden: list.sim.forbidden.map(r => ({ id: r.id, pattern: r.pattern, flags: r.flags || '', note: r.note || '' })),
    simRequired: list.sim.required,
    stars: list.stars,
    exemptVoices: list.exemptVoices,
  };
}

/**
 * Scans one text run. `ctx` says where the text sits:
 *  voice: 'sts' or a data-voice value; faq: inside details>summary; sim: inside [data-sim]; legal: legal page;
 *  gevel: inside the gevel room (rules with scope 'gevel' apply only there).
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
